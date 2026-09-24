/**
 * Meta WhatsApp Embedded Signup in the browser.
 *
 * Loads Meta's JS SDK, opens the signup popup (the merchant logs in with
 * Facebook and picks or creates their WhatsApp Business number) and resolves
 * with what our API needs to finish the connection: the one-time code from
 * FB.login, plus the WhatsApp Business Account and phone number ids that the
 * popup posts back as a WA_EMBEDDED_SIGNUP message. The two arrive separately
 * and in either order.
 *
 * Copy of packages/web/lib/metaEmbeddedSignup.ts for the Shopify embedded app;
 * keep the two in step.
 */

export type EmbeddedSignupConfig = { appId: string; configId: string; graphVersion: string };

export type EmbeddedSignupResult =
  | { status: 'finished'; code: string; wabaId: string; phoneNumberId: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

type FacebookSdk = {
  init: (options: Record<string, unknown>) => void;
  login: (
    callback: (response: { authResponse?: { code?: string } | null }) => void,
    options: Record<string, unknown>
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<FacebookSdk> | null = null;

function loadSdk(config: EmbeddedSignupConfig): Promise<FacebookSdk> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: config.graphVersion,
      });
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB!.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: config.graphVersion,
      });
      resolve(window.FB!);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      sdkPromise = null;
      reject(
        new Error(
          'Could not load Facebook sign-in. Check that pop-ups and third-party scripts are allowed.'
        )
      );
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export async function runEmbeddedSignup(
  config: EmbeddedSignupConfig,
  options: { coexistence: boolean }
): Promise<EmbeddedSignupResult> {
  const FB = await loadSdk(config);

  return new Promise((resolve) => {
    let code: string | null = null;
    let session: { wabaId: string; phoneNumberId: string } | null = null;
    let settled = false;

    const finish = (result: EmbeddedSignupResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      resolve(result);
    };
    const tryComplete = () => {
      if (code && session) finish({ status: 'finished', code, ...session });
    };

    const onMessage = (event: MessageEvent) => {
      let origin: string;
      try {
        origin = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (origin !== 'facebook.com' && !origin.endsWith('.facebook.com')) return;

      let payload: {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string; error_message?: string };
      } | null;
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (typeof payload.event === 'string' && payload.event.startsWith('FINISH')) {
        const wabaId = payload.data?.waba_id;
        const phoneNumberId = payload.data?.phone_number_id;
        if (wabaId && phoneNumberId) {
          session = { wabaId: String(wabaId), phoneNumberId: String(phoneNumberId) };
          tryComplete();
        } else {
          finish({
            status: 'error',
            message: 'Signup finished without a phone number. Please try again and pick a number.',
          });
        }
      } else if (payload.event === 'CANCEL') {
        finish({ status: 'cancelled' });
      } else if (payload.event === 'ERROR') {
        finish({
          status: 'error',
          message: payload.data?.error_message || 'Meta reported an error during signup.',
        });
      }
    };
    window.addEventListener('message', onMessage);

    FB.login(
      (response) => {
        const receivedCode = response?.authResponse?.code;
        if (!receivedCode) {
          finish({ status: 'cancelled' });
          return;
        }
        code = receivedCode;
        tryComplete();
      },
      {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: '3',
          // Moves a number the merchant already uses in the WhatsApp Business
          // app (they confirm it with a QR code in the app) instead of
          // registering a new one.
          ...(options.coexistence ? { featureType: 'whatsapp_business_app_onboarding' } : {}),
        },
      }
    );
  });
}
