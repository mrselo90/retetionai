// @shopify/app-bridge-types adds its elements to the global JSX namespace, but
// @types/react 19 resolves JSX through React.JSX, so they are invisible to TSX.
// Re-declare the App Bridge element the app renders.
import type { SAppNavAttributes } from '@shopify/app-bridge-types';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      's-app-nav': SAppNavAttributes;
    }
  }
}
