import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>Shopify shell</p>
          <h1 className={styles.heading}>Recete for Shopify</h1>
          <p className={styles.text}>
            Embedded post-purchase support, buyer retention workflows, and
            merchant operations built specifically for Shopify stores.
          </p>
          <div className={styles.callouts}>
            <span>Embedded in Shopify Admin</span>
            <span>Shopify-managed billing</span>
            <span>GDPR-aware customer workflows</span>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.kicker}>Shopify merchants</p>
            <h2 className={styles.panelTitle}>Connect your store</h2>
            <p className={styles.panelText}>
              Sign in with your <code>myshopify.com</code> domain to start the
              official embedded install flow.
            </p>
          </div>

          {showForm ? (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Shop domain</span>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="example.myshopify.com"
                  autoComplete="on"
                />
                <span className={styles.helpText}>
                  Use the store&apos;s permanent Shopify domain.
                </span>
              </label>
              <button className={styles.button} type="submit">
                Connect Shopify store
              </button>
            </Form>
          ) : null}

          <div className={styles.divider} />

          <div className={styles.secondaryBlock}>
            <p className={styles.kicker}>Non-Shopify merchants</p>
            <p className={styles.secondaryText}>
              Looking for the standalone Recete platform outside the Shopify
              shell?
            </p>
            <a className={styles.secondaryLink} href="https://recete.co.uk">
              Go to recete.co.uk
            </a>
          </div>
        </div>

        <div className={styles.grid}>
          <article className={styles.card}>
            <p className={styles.cardLabel}>Buyer support</p>
            <h3>Keep post-purchase conversations inside one merchant workflow.</h3>
            <p>
              Recete helps Shopify merchants manage product guidance,
              conversation handling, and retention moments from the embedded
              app.
            </p>
          </article>
          <article className={styles.card}>
            <p className={styles.cardLabel}>Operational clarity</p>
            <h3>Route Shopify installs into the official shell, not the standalone app.</h3>
            <p>
              This domain is reserved for Shopify merchants. Standalone Recete
              customers continue on the main product site.
            </p>
          </article>
          <article className={styles.card}>
            <p className={styles.cardLabel}>Review-safe path</p>
            <h3>Clear separation between Shopify and non-Shopify customer journeys.</h3>
            <p>
              Reviewers and merchants should be able to understand the product
              boundary immediately when landing on this route.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
