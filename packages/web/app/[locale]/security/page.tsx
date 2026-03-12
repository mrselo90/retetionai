'use client';

import Link from 'next/link';

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-8">Security Overview</h1>
          <p className="text-sm text-zinc-600 mb-8">Last updated: March 12, 2026</p>

          <div className="prose prose-zinc max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Core Controls</h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>Encryption in transit and encryption at rest for sensitive data</li>
                <li>Tenant isolation controls for merchant data</li>
                <li>Structured logging for sensitive customer-data access paths</li>
                <li>Authenticated access to merchant and customer administration surfaces</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. Access Management</h2>
              <p className="text-zinc-700 mb-4">
                Access to production systems and customer personal data is limited to authorized personnel with
                a legitimate operational need. We require strong passwords for merchant-facing account access.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. Incident Handling</h2>
              <p className="text-zinc-700 mb-4">
                We maintain internal incident-response procedures for detection, containment, remediation,
                recovery, and merchant notification where required.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Backups and Recovery</h2>
              <p className="text-zinc-700 mb-4">
                We maintain documented backup and recovery procedures. Backup encryption status should be
                confirmed against the active production environment before making compliance attestations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Contact</h2>
              <p className="text-zinc-700 mb-4">
                For security questions, contact{' '}
                <a href="mailto:security@recete.co.uk" className="text-blue-600 hover:underline">
                  security@recete.co.uk
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
