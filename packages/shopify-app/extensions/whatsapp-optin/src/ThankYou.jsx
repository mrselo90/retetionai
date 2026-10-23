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
    if (!orderId || !checkoutToken) {
      setState('hidden');
      return;
    }
    let cancelled = false;
    call('GET', {orderId, checkoutToken})
      .then(({ok, body}) => {
        if (cancelled) return;
        if (!ok || !body.eligible) setState('hidden');
        else setState(body.subscribed ? 'subscribed' : 'ready');
      })
      .catch(() => !cancelled && setState('hidden'));
    return () => {
      cancelled = true;
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
