'use client';

import Link from 'next/link';
import { CompanyIdentityBlock } from '@/components/site/CompanyIdentityBlock';
import { CookiePreferencesButton } from '@/components/analytics/CookiePreferencesButton';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--recete-cream))] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8">Cookie Policy</h1>
          <p className="text-sm text-zinc-600 mb-8">Last updated: August 25, 2026</p>

          <div className="prose prose-zinc max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. What Are Cookies</h2>
              <p className="text-zinc-700 mb-4">
                Cookies are small text files stored on your device when you visit our website. They
                help us provide, protect, and improve our Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. How We Use Cookies</h2>
              <p className="text-zinc-700 mb-4">We use cookies for:</p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>
                  <strong>Authentication:</strong> To keep you logged in and secure your session
                </li>
                <li>
                  <strong>Preferences:</strong> To remember your settings and preferences
                </li>
                <li>
                  <strong>Analytics:</strong> To understand how our website and product are used.
                  Only set if you accept analytics cookies.
                </li>
                <li>
                  <strong>Security:</strong> To protect against fraud and abuse
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. Types of Cookies</h2>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">3.1 Essential Cookies</h3>
              <p className="text-zinc-700 mb-4">
                These cookies are necessary for the Service to function and cannot be disabled.
              </p>

              <h3 className="text-xl font-semibold text-zinc-900 mb-3">3.2 Functional Cookies</h3>
              <p className="text-zinc-700 mb-4">
                These cookies enable enhanced functionality and personalization.
              </p>

              <h3 className="text-xl font-semibold text-zinc-900 mb-3">3.3 Analytics Cookies</h3>
              <p className="text-zinc-700 mb-4">
                These cookies help us understand how visitors interact with our website and product
                — which pages are visited, which features are used, and where people run into
                trouble. They are set only after you accept them, and never before. If you decline,
                none are written and the Service works exactly as it otherwise would.
              </p>
              <p className="text-zinc-700 mb-4">
                We use <strong>PostHog</strong> for this, hosted in the European Union. Where you
                are signed in, the analytics record is linked to your account so we can see how
                merchants use the product over time; this means the data is not anonymous. Where you
                are not signed in, it is not linked to any identity we hold. PostHog does not record
                your screen, and we do not sell or share analytics data for advertising.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Managing Cookies</h2>
              <p className="text-zinc-700 mb-4">
                You choose whether to allow analytics cookies the first time you visit, and you can
                change that choice at any time using the button below — withdrawing consent is as
                easy as giving it. Declining or withdrawing stops all analytics collection and
                clears the analytics identifier already stored on your device.
              </p>
              <div className="mb-4">
                <CookiePreferencesButton />
              </div>
              <p className="text-zinc-700 mb-4">
                Essential cookies keep you signed in and cannot be turned off here, since the
                Service cannot function without them. You can still clear or block any cookie
                through your browser settings, though blocking essential cookies will stop you being
                able to sign in.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Third-Party Cookies</h2>
              <p className="text-zinc-700 mb-4">
                We may use third-party services that set their own cookies. These are governed by
                their respective privacy policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Contact Us</h2>
              <p className="text-zinc-700 mb-4">
                For questions about our use of cookies, please contact us at{' '}
                <a href="mailto:privacy@recete.co.uk" className="text-blue-600 hover:underline">
                  privacy@recete.co.uk
                </a>
              </p>
              <p className="text-zinc-700 mb-4">
                RECETE LTD, 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ. Company number
                17082027.
              </p>
            </section>
          </div>

          <div className="mt-8">
            <CompanyIdentityBlock compact />
          </div>

          <div className="mt-8 pt-8 border-t border-zinc-200">
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
