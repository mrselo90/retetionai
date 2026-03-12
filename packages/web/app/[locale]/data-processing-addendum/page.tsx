'use client';

import Link from 'next/link';

export default function DataProcessingAddendumPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8">Data Processing Addendum</h1>
          <p className="text-sm text-zinc-600 mb-8">Last updated: March 12, 2026</p>

          <div className="prose prose-zinc max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Scope</h2>
              <p className="text-zinc-700 mb-4">
                This Addendum applies when Recete Retention Agent processes merchant customer personal data
                on behalf of a merchant using the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. Roles</h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Merchant acts as the controller of customer personal data.</li>
                <li>Recete acts as a processor, handling personal data only on the merchant&apos;s behalf.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. Processing Purposes</h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Consent-aware post-purchase WhatsApp workflows</li>
                <li>Customer support conversations and merchant replies</li>
                <li>Product guidance, order-linked context, and merchant analytics</li>
                <li>GDPR export, deletion, and consent-management requests</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Data Categories</h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Customer name</li>
                <li>Customer phone number</li>
                <li>Order and delivery context</li>
                <li>Consent status</li>
                <li>Conversation content</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Processor Commitments</h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Process personal data only for merchant-requested service functionality</li>
                <li>Apply encryption in transit and encryption at rest for sensitive data</li>
                <li>Maintain tenant isolation and role-limited internal access</li>
                <li>Support merchant export, deletion, and consent-management requests</li>
                <li>Notify affected merchants without undue delay after confirming a personal data incident</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Contact</h2>
              <p className="text-zinc-700 mb-4">
                For merchant data protection questions, contact{' '}
                <a href="mailto:legal@recete.co.uk" className="text-blue-600 hover:underline">
                  legal@recete.co.uk
                </a>.
              </p>
            </section>
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
