/**
 * Connect the store's own WhatsApp Business number (Meta Embedded Signup),
 * inside the Shopify admin. The popup runs in the browser; the route action
 * (intent connectWhatsApp / disconnectWhatsApp) finishes it on the platform.
 */

import { useState } from 'react';
import { useFetcher } from 'react-router';
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Text,
} from '@shopify/polaris';
import { runEmbeddedSignup } from '../lib/metaEmbeddedSignup.client';
import type { WhatsAppConnection } from '../platform.server';

type ActionResult = { ok?: boolean; error?: string; intent?: string };

export function WhatsAppConnectCard({ connection }: { connection: WhatsAppConnection | null }) {
  const fetcher = useFetcher<ActionResult>();
  const [coexistence, setCoexistence] = useState(false);
  const [popupBusy, setPopupBusy] = useState(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);

  const busy = popupBusy || fetcher.state !== 'idle';
  const result = fetcher.data;

  if (!connection) {
    return (
      <Card padding="400">
        <Text as="p" tone="subdued">
          We couldn&apos;t load your WhatsApp connection. Refresh the page to try again.
        </Text>
      </Card>
    );
  }

  const { config, status } = connection;

  const connect = async () => {
    if (!config.enabled) return;
    setPopupMessage(null);
    setPopupBusy(true);
    try {
      const signup = await runEmbeddedSignup(config, { coexistence });
      if (signup.status === 'cancelled') {
        setPopupMessage('Connection cancelled. Nothing was changed.');
        return;
      }
      if (signup.status === 'error') {
        setPopupMessage(signup.message);
        return;
      }
      fetcher.submit(
        {
          intent: 'connectWhatsApp',
          code: signup.code,
          wabaId: signup.wabaId,
          phoneNumberId: signup.phoneNumberId,
          coexistence: coexistence ? '1' : '0',
        },
        { method: 'post' }
      );
    } catch (error) {
      setPopupMessage(
        error instanceof Error ? error.message : 'Could not open the Facebook sign-in.'
      );
    } finally {
      setPopupBusy(false);
    }
  };

  return (
    <Card padding="500" roundedAbove="sm">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingMd">
              WhatsApp Business
            </Text>
            {status.connected ? <Badge tone="success">Connected</Badge> : null}
            {!config.enabled ? <Badge>Coming soon</Badge> : null}
          </InlineStack>
          {status.connected ? (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="disconnectWhatsApp" />
              <Button submit loading={fetcher.state !== 'idle'} tone="critical" variant="plain">
                Disconnect
              </Button>
            </fetcher.Form>
          ) : config.enabled ? (
            <Button variant="primary" onClick={connect} loading={busy}>
              Connect WhatsApp
            </Button>
          ) : null}
        </InlineStack>

        <Text as="p" tone="subdued">
          {status.connected
            ? `Customer messages go from ${status.phoneNumberDisplay || 'your number'}${
                status.verifiedName ? ` (${status.verifiedName})` : ''
              }.`
            : config.enabled
              ? "Connect your store's own WhatsApp Business number. You sign in with Facebook and pick your number — no API keys, about two minutes."
              : 'Connecting your own WhatsApp number with a Facebook sign-in is coming soon. Until then Recete cannot send WhatsApp messages.'}
        </Text>

        {!status.connected && config.enabled ? (
          <BlockStack gap="150">
            <Checkbox
              label="I already use this number in the WhatsApp Business app"
              helpText="Keep using the app: you confirm the move with a QR code in WhatsApp Business, and your chats stay there too."
              checked={coexistence}
              onChange={setCoexistence}
              disabled={busy}
            />
            <Text as="p" variant="bodySm" tone="subdued">
              A Facebook window opens: sign in, choose or create your business account, pick the
              number, and confirm.
            </Text>
          </BlockStack>
        ) : null}

        {popupMessage ? (
          <Banner tone="warning">
            <p>{popupMessage}</p>
          </Banner>
        ) : null}
        {result?.error ? (
          <Banner tone="critical">
            <p>{result.error}</p>
          </Banner>
        ) : null}
        {result?.ok && result.intent === 'connectWhatsApp' ? (
          <Banner tone="success">
            <p>WhatsApp connected. Recete will now message your customers from this number.</p>
          </Banner>
        ) : null}
      </BlockStack>
    </Card>
  );
}
