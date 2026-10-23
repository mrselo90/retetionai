import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

// The embedded app that records consent in Shopify (app/routes/public.whatsapp-optin.tsx).
const ENDPOINT = 'https://shop.recete.co.uk/public/whatsapp-optin';

export default function extension() {
  render(<Extension />, document.body);
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

function Extension() {
  const t = (key) => shopify.i18n.translate(key);
  const orderId = shopify.orderConfirmation.value?.order?.id;
  const checkoutToken = shopify.checkoutToken.value;
  // loading | hidden | ready | saving | subscribed | error
  const [state, setState] = useState('loading');

  useEffect(() => {
    // The block hides itself whenever it can't offer the opt-in; these logs are
    // the only way to tell why from the buyer's browser console.
    if (!orderId || !checkoutToken) {
      console.info('[recete whatsapp-optin] hidden: missing', {orderId: Boolean(orderId), checkoutToken: Boolean(checkoutToken)});
      setState('hidden');
      return;
    }
    let cancelled = false;
    const slow = setTimeout(() => console.warn('[recete whatsapp-optin] status check still pending after 10s'), 10000);
    call('GET', {orderId, checkoutToken})
      .finally(() => clearTimeout(slow))
      .then(({ok, body}) => {
        if (cancelled) return;
        if (!ok || !body.eligible) {
          console.info('[recete whatsapp-optin] hidden:', ok ? body.reason : 'request refused');
          setState('hidden');
        } else setState(body.subscribed ? 'subscribed' : 'ready');
      })
      .catch((error) => {
        console.warn('[recete whatsapp-optin] hidden: status check failed', String(error && error.message ? error.message : error));
        if (!cancelled) setState('hidden');
      });
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [orderId, checkoutToken]);

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

  if (state === 'loading' || state === 'hidden') return null;

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
