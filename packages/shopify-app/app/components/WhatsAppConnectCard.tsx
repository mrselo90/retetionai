/**
 * Link the store's own WhatsApp number by QR code, inside the Shopify admin.
 * Talks to the /app/whatsapp resource route: polls its loader while a QR is
 * showing, posts connect / disconnect to its action.
 */

import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Badge, Banner, BlockStack, Box, Button, Card, InlineStack, Text } from '@shopify/polaris';
import type { WhatsAppConnectionStatus } from '../platform.server';

type LoaderResult = { ok: true; status: WhatsAppConnectionStatus } | { ok: false; error: string };
type ActionResult =
  | { ok: true; intent: string; status: WhatsAppConnectionStatus }
  | { ok: false; intent: string; error: string };

const POLL_MS = 2000;

const ERROR_TEXT: Record<string, string> = {
  qr_timeout: 'The code expired before it was scanned. Start again when your phone is at hand.',
  pair_refused:
    'WhatsApp refused to link a new device. Check that fewer than four devices are linked, wait a few minutes, and try again.',
  number_taken: 'This number is already linked to another store.',
  stream_replaced: 'The session was opened somewhere else. Link again to continue.',
  client_outdated:
    'WhatsApp needs a newer connection version. We have been notified; please try again later.',
  unreachable: 'We lost the connection to WhatsApp. Link again to continue.',
};

function errorText(status: WhatsAppConnectionStatus): string | null {
  if (status.status === 'connected' || status.status === 'qr' || status.status === 'connecting') {
    return null;
  }
  if (status.lastError) {
    return ERROR_TEXT[status.lastError] ?? 'The last connection attempt failed. Try again.';
  }
  if (status.status === 'logged_out') {
    return 'The number was unlinked from the phone. Link it again to continue.';
  }
  return null;
}

export function WhatsAppConnectCard({ initial }: { initial: WhatsAppConnectionStatus | null }) {
  const poller = useFetcher<LoaderResult>();
  const actor = useFetcher<ActionResult>();
  const [status, setStatus] = useState<WhatsAppConnectionStatus | null>(initial);
  const [justLinked, setJustLinked] = useState(false);
  const pairingRef = useRef(false);

  // The page loader revalidates after navigation and focus; take its answer.
  useEffect(() => {
    if (initial) setStatus(initial);
  }, [initial]);
  useEffect(() => {
    if (poller.data?.ok) setStatus(poller.data.status);
  }, [poller.data]);
  useEffect(() => {
    if (actor.data?.ok) setStatus(actor.data.status);
  }, [actor.data]);

  const pairing = status?.status === 'qr' || status?.status === 'connecting';

  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => {
      if (poller.state === 'idle') poller.load('/app/whatsapp');
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // poller is stable across renders; its state is read inside the tick.
  }, [pairing]);

  useEffect(() => {
    if (status?.status === 'connected' && pairingRef.current) {
      pairingRef.current = false;
      setJustLinked(true);
    }
  }, [status?.status]);

  if (!status) {
    return (
      <Card padding="400">
        <Text as="p" tone="subdued">
          We couldn&apos;t load your WhatsApp connection. Refresh the page to try again.
        </Text>
      </Card>
    );
  }

  const busy = actor.state !== 'idle';
  const submit = (intent: 'connect' | 'disconnect') => {
    pairingRef.current = intent === 'connect';
    setJustLinked(false);
    actor.submit({ intent }, { method: 'post', action: '/app/whatsapp' });
  };
  const connected = status.status === 'connected';
  const problem = errorText(status);
  const actionError = actor.data && !actor.data.ok ? actor.data.error : null;

  return (
    <Card padding="400">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h3" variant="headingMd">
                WhatsApp
              </Text>
              {connected ? <Badge tone="success">Connected</Badge> : null}
              {status.status === 'qr' ? <Badge tone="attention">Waiting for scan</Badge> : null}
              {status.status === 'connecting' && status.phone ? (
                <Badge tone="attention">Reconnecting</Badge>
              ) : null}
              {!status.available ? <Badge>Not available yet</Badge> : null}
            </InlineStack>
            <Text as="p" tone="subdued">
              {connected
                ? `Messages go from ${status.phone ?? 'your linked number'}.`
                : status.available
                  ? "Link your store's own WhatsApp number by scanning a QR code, the way you link WhatsApp Web. Customers get messages from the number they already know."
                  : 'Linking a WhatsApp number is not available yet. Until then Recete cannot send WhatsApp messages.'}
            </Text>
          </BlockStack>
          {connected ? (
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    'Unlink this WhatsApp number? Recete will stop sending and receiving messages for your store.'
                  )
                ) {
                  submit('disconnect');
                }
              }}
              loading={busy}
            >
              Unlink
            </Button>
          ) : pairing ? (
            <Button variant="tertiary" onClick={() => submit('disconnect')} loading={busy}>
              Cancel
            </Button>
          ) : status.available ? (
            <Button variant="primary" onClick={() => submit('connect')} loading={busy}>
              Link WhatsApp
            </Button>
          ) : null}
        </InlineStack>

        {justLinked ? (
          <Banner tone="success" onDismiss={() => setJustLinked(false)}>
            <p>WhatsApp linked. Recete will now message your customers from this number.</p>
          </Banner>
        ) : null}
        {actionError ? (
          <Banner tone="critical">
            <p>{actionError}</p>
          </Banner>
        ) : null}
        {problem ? (
          <Banner tone="warning">
            <p>{problem}</p>
          </Banner>
        ) : null}

        {pairing ? (
          <InlineStack gap="400" blockAlign="center" wrap>
            <Box
              background="bg-surface"
              borderRadius="200"
              borderWidth="025"
              borderColor="border"
              padding="200"
              minWidth="224px"
              minHeight="224px"
            >
              {status.qr ? (
                <img
                  src={status.qr}
                  alt="WhatsApp link QR code"
                  width={208}
                  height={208}
                  style={{ display: 'block' }}
                />
              ) : (
                <Text as="p" tone="subdued" alignment="center">
                  Starting the connection…
                </Text>
              )}
            </Box>
            <BlockStack gap="100">
              <Text as="p" fontWeight="semibold">
                Scan with the phone that has this number
              </Text>
              <Text as="p" tone="subdued">
                Open WhatsApp → Settings → Linked devices → Link a device, then point the camera at
                this code. It refreshes on its own.
              </Text>
            </BlockStack>
          </InlineStack>
        ) : null}

        {!connected && status.available ? (
          <Text as="p" variant="bodySm" tone="subdued">
            <strong>Before you link:</strong> this links your number as a device, like WhatsApp Web.
            It is not WhatsApp&apos;s official Business API, and WhatsApp can restrict numbers that
            send automated messages. Use a number that belongs to your store, not a personal one.
            Recete paces messages, caps how many first messages a new link sends per day, and only
            messages customers who opted in.
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}
