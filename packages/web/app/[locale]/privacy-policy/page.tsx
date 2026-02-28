'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8">Privacy Policy</h1>
          <p className="text-sm text-zinc-600 mb-8">Last updated: January 20, 2026</p>

          <div className="prose prose-zinc max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Introduction</h2>
              <p className="text-zinc-700 mb-4">
                Recete Retention Agent ("we", "our", or "us") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">2.1 Merchant Information</h3>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Business name and contact information</li>
                <li>Email address and password (encrypted)</li>
                <li>API keys and integration credentials</li>
                <li>Product information and knowledge base data</li>
              </ul>

              <h3 className="text-xl font-semibold text-zinc-900 mb-3">2.2 End User Information</h3>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Phone numbers (encrypted at rest)</li>
                <li>Names and order information</li>
                <li>Conversation history</li>
                <li>Consent status</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>To provide and maintain our service</li>
                <li>To process WhatsApp messages and provide AI assistance</li>
                <li>To send scheduled messages and check-ins</li>
                <li>To analyze usage and improve our service</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Data Security</h2>
              <p className="text-zinc-700 mb-4">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Encryption of sensitive data (phone numbers, API keys)</li>
                <li>Multi-tenant data isolation (Row Level Security)</li>
                <li>Secure API authentication</li>
                <li>Regular security audits</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Your Rights (GDPR)</h2>
              <p className="text-zinc-700 mb-4">Under GDPR, you have the right to:</p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>
                  <strong>Access:</strong> Request a copy of your personal data
                </li>
                <li>
                  <strong>Rectification:</strong> Correct inaccurate data
                </li>
                <li>
                  <strong>Erasure:</strong> Request deletion of your data
                </li>
                <li>
                  <strong>Portability:</strong> Receive your data in a portable format
                </li>
                <li>
                  <strong>Objection:</strong> Object to processing of your data
                </li>
                <li>
                  <strong>Withdraw Consent:</strong> Withdraw consent at any time
                </li>
              </ul>
              <p className="text-zinc-700 mb-4">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:privacy@recete.co.uk" className="text-blue-600 hover:underline">
                  privacy@recete.co.uk
                </a>{' '}
                or use the data export/deletion features in your dashboard.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Data Retention</h2>
              <p className="text-zinc-700 mb-4">
                We retain your data for as long as necessary to provide our service and comply with legal
                obligations. When you request deletion, we will:
              </p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Schedule deletion with a 30-day grace period</li>
                <li>Permanently delete data after the grace period</li>
                <li>Retain anonymized analytics data for service improvement</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">7. Third-Party Services</h2>
              <p className="text-zinc-700 mb-4">We use the following third-party services:</p>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>
                  <strong>Supabase:</strong> Database and authentication (EU/US data centers)
                </li>
                <li>
                  <strong>OpenAI:</strong> AI/LLM services (US-based)
                </li>
                <li>
                  <strong>WhatsApp Business API:</strong> Messaging service
                </li>
                <li>
                  <strong>Redis:</strong> Queue management
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">8. Contact Us</h2>
              <p className="text-zinc-700 mb-4">
                If you have questions about this Privacy Policy, please contact us:
              </p>
              <ul className="list-none text-zinc-700 mb-4">
                <li>Email: privacy@recete.co.uk</li>
                <li>Support: support@recete.co.uk</li>
              </ul>
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
