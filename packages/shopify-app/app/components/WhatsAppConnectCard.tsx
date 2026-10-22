/**
 * Link the store's own WhatsApp number by QR code, inside the Shopify admin.
 * Talks to the /app/whatsapp resource route: polls its loader while a QR is
 * showing, posts connect / disconnect to its action.
 */

import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { useAppBridge } from '@shopify/app-bridge-react';
import { Modal, Text } from '@shopify/polaris';
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
  const shopify = useAppBridge();
  const pairingRef = useRef(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

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
      shopify.toast.show('WhatsApp linked. Recete will now message your customers from this number.', {
        duration: 6000,
      });
    }
  }, [status?.status, shopify]);

  if (!status) {
    return (
      <s-section>
        <s-paragraph color="subdued">
          We couldn&apos;t load your WhatsApp connection. Refresh the page to try again.
        </s-paragraph>
      </s-section>
    );
  }

  const busy = actor.state !== 'idle';
  const submit = (intent: 'connect' | 'disconnect') => {
    pairingRef.current = intent === 'connect';
    actor.submit({ intent }, { method: 'post', action: '/app/whatsapp' });
  };
  const connected = status.status === 'connected';
  const problem = errorText(status);
  const actionError = actor.data && !actor.data.ok ? actor.data.error : null;

  // Account connection composition: the service, its status, a short
  // description and the one Connect / Disconnect action.
  return (
    <s-section>
      <s-stack gap="base">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-stack gap="small-300">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-heading>WhatsApp</s-heading>
              {connected ? <s-badge tone="success">Connected</s-badge> : null}
              {status.status === 'qr' ? <s-badge tone="warning">Waiting for scan</s-badge> : null}
              {status.status === 'connecting' && status.phone ? (
                <s-badge tone="warning">Reconnecting</s-badge>
              ) : null}
              {!status.available ? <s-badge>Not available yet</s-badge> : null}
            </s-stack>
            <s-paragraph color="subdued">
              {connected
                ? `Messages go from ${status.phone ?? 'your linked number'}.`
                : status.available
                  ? "Link your store's own WhatsApp number by scanning a QR code, the way you link WhatsApp Web. Customers get messages from the number they already know."
                  : 'Linking a WhatsApp number is not available yet. Until then Recete cannot send WhatsApp messages.'}
            </s-paragraph>
          </s-stack>
          {connected ? (
            <s-button onClick={() => setConfirmUnlink(true)} loading={busy || undefined}>
              Unlink
            </s-button>
          ) : pairing ? (
            <s-button
              variant="tertiary"
              onClick={() => submit('disconnect')}
              loading={busy || undefined}
            >
              Cancel
            </s-button>
          ) : status.available ? (
            <s-button
              variant="primary"
              onClick={() => submit('connect')}
              loading={busy || undefined}
            >
              Link WhatsApp
            </s-button>
          ) : null}
        </s-grid>

        {actionError ? <s-banner tone="critical">{actionError}</s-banner> : null}
        {problem ? <s-banner tone="warning">{problem}</s-banner> : null}

        {pairing ? (
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-box
              background="base"
              borderRadius="base"
              border="base"
              padding="small"
              minInlineSize="224px"
              minBlockSize="224px"
            >
              {status.qr ? (
                <s-box inlineSize="208px" blockSize="208px">
                  <s-image src={status.qr} alt="WhatsApp link QR code" aspectRatio="1/1" />
                </s-box>
              ) : (
                <s-grid
                  justifyItems="center"
                  alignItems="center"
                  inlineSize="208px"
                  blockSize="208px"
                >
                  <s-paragraph color="subdued">Starting the connection…</s-paragraph>
                </s-grid>
              )}
            </s-box>
            <s-stack gap="small-300">
              <s-text type="strong">Scan with the phone that has this number</s-text>
              <s-paragraph color="subdued">
                Open WhatsApp → Settings → Linked devices → Link a device, then point the camera at
                this code. It refreshes on its own.
              </s-paragraph>
            </s-stack>
          </s-stack>
        ) : null}

        {!connected && status.available ? (
          <s-paragraph color="subdued">
            <s-text type="strong">Before you link:</s-text> this links your number as a device, like
            WhatsApp Web. It is not WhatsApp&apos;s official Business API, and WhatsApp can restrict
            numbers that send automated messages. Use a number that belongs to your store, not a
            personal one. Recete paces messages, caps how many first messages a new link sends per
            day, and only messages customers who opted in.
          </s-paragraph>
        ) : null}
      </s-stack>
      <Modal
        open={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        title="Unlink this WhatsApp number?"
        primaryAction={{
          content: 'Unlink',
          destructive: true,
          loading: busy,
          onAction: () => {
            setConfirmUnlink(false);
            submit('disconnect');
          },
        }}
        secondaryActions={[{ content: 'Keep linked', onAction: () => setConfirmUnlink(false) }]}
      >
        <Modal.Section>
          <Text as="p">
            Recete will stop sending and receiving WhatsApp messages for your store. You can link a
            number again at any time.
          </Text>
        </Modal.Section>
      </Modal>
    </s-section>
  );
}
