'use client';

import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8">Terms of Service</h1>
          <p className="text-sm text-zinc-600 mb-8">Last updated: January 20, 2026</p>

          <div className="prose prose-zinc max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Agreement to Terms</h2>
              <p className="text-zinc-700 mb-4">
                By accessing or using Recete Retention Agent ("Service"), you agree to be bound by these
                Terms of Service. If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. Description of Service</h2>
              <p className="text-zinc-700 mb-4">
                Recete is a white-label SaaS platform that provides post-purchase AI assistance via WhatsApp.
                The Service includes:
              </p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>AI-powered customer support via WhatsApp</li>
                <li>Automated message scheduling and check-ins</li>
                <li>Product knowledge base management</li>
                <li>Analytics and reporting</li>
                <li>Integration with e-commerce platforms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. User Accounts</h2>
              <p className="text-zinc-700 mb-4">
                You are responsible for:
              </p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Ensuring compliance with WhatsApp Business API policies</li>
                <li>Obtaining necessary consents from end users</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Acceptable Use</h2>
              <p className="text-zinc-700 mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Use the Service for illegal or unauthorized purposes</li>
                <li>Send spam, unsolicited messages, or violate anti-spam laws</li>
                <li>Impersonate others or provide false information</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Use the Service to violate any third-party rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Payment and Billing</h2>
              <p className="text-zinc-700 mb-4">
                Subscription fees are billed in advance. You agree to pay all fees associated with your
                subscription plan. We reserve the right to change pricing with 30 days notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Intellectual Property</h2>
              <p className="text-zinc-700 mb-4">
                The Service and its original content are owned by Recete and protected by international
                copyright laws. You retain ownership of your data and content.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">7. Limitation of Liability</h2>
              <p className="text-zinc-700 mb-4">
                To the maximum extent permitted by law, Recete shall not be liable for any indirect,
                incidental, special, or consequential damages arising from your use of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">8. Termination</h2>
              <p className="text-zinc-700 mb-4">
                We may terminate or suspend your account immediately, without prior notice, for conduct that
                we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">9. Changes to Terms</h2>
              <p className="text-zinc-700 mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of any material
                changes via email or through the Service. Your continued use constitutes acceptance of the
                modified Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">10. Contact Information</h2>
              <p className="text-zinc-700 mb-4">
                For questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@recete.ai" className="text-blue-600 hover:underline">
                  legal@recete.ai
                </a>
              </p>
            </section>
          </div>

          <div className="mt-8 pt-8 border-t border-zinc-200">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
