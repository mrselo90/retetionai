import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState} from 'preact/hooks';

// The embedded app that records consent in Shopify (app/routes/public.whatsapp-optin.tsx).
const ENDPOINT = 'https://shop.recete.co.uk/public/whatsapp-optin';

// The block hides itself whenever it can't offer the opt-in; these logs are the
// only way to tell why from the buyer's browser console.
const log = (...args) => console.info('[recete whatsapp-optin]', ...args);

// The status check runs here, before render, not in a useEffect: on the live
// Thank you page the extension rendered with both ids set but its effect never
// sent the request (blackeagletest, recete-18).
export default async function extension() {
  const orderId = shopify.orderConfirmation.value?.order?.id;
  const checkoutToken = shopify.checkoutToken.value;
  if (!orderId || !checkoutToken) {
    log('hidden: missing', {orderId: Boolean(orderId), checkoutToken: Boolean(checkoutToken)});
    return;
  }

  const slow = setTimeout(() => console.warn('[recete whatsapp-optin] status check still pending after 10s'), 10000);
  let status;
  try {
    status = await call('GET', {orderId, checkoutToken});
  } catch (error) {
    console.warn('[recete whatsapp-optin] hidden: status check failed', String(error && error.message ? error.message : error));
    return;
  } finally {
    clearTimeout(slow);
  }
  if (!status.ok || !status.body.eligible) {
    log('hidden:', status.ok ? status.body.reason : 'request refused');
    return;
  }

  render(
    <Extension
      orderId={orderId}
      checkoutToken={checkoutToken}
      initialState={status.body.subscribed ? 'subscribed' : 'ready'}
    />,
    document.body,
  );
}

async function call(method, params) {
  const token = await shopify.sessionToken.get();
  const url = method === 'GET' ? `${ENDPOINT}?${new URLSearchParams(params)}` : ENDPOINT;
  const response = await fetch(url, {
    method,
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: method === 'POST' ? JSON.stringify(params) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  return {ok: response.ok, body};
}

function Extension({orderId, checkoutToken, initialState}) {
  const t = (key) => shopify.i18n.translate(key);
  // ready | saving | subscribed | error
  const [state, setState] = useState(initialState);

  async function optIn(event) {
    if (!event.currentTarget.checked) return;
    setState('saving');
    try {
      const {ok, body} = await call('POST', {orderId, checkoutToken});
      setState(ok && body.subscribed ? 'subscribed' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'subscribed') {
    return (
      <s-banner tone="success" heading={t('subscribedHeading')}>
        <s-text>{t('subscribedBody')}</s-text>
      </s-banner>
    );
  }

  return (
    <s-stack gap="small-200">
      <s-heading>{t('heading')}</s-heading>
      <s-checkbox
        label={t('label')}
        disabled={state === 'saving'}
        onChange={optIn}
      />
      <s-text color="subdued">{t('details')}</s-text>
      {state === 'error' ? <s-text tone="critical">{t('error')}</s-text> : null}
    </s-stack>
  );
}
