'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CompanyIdentityBlock } from '@/components/site/CompanyIdentityBlock';
import { OPT_OUT_KEYWORDS_DISPLAY, PRIVACY_NOTICE_SNIPPET } from '@/lib/whatsappCompliance';

/**
 * What a merchant needs to know before Recete messages their customers on
 * WhatsApp. Every statement about product behaviour here is what the code does
 * (consent source, opt-out handling, where data is processed) — keep it that
 * way when either changes.
 */
export default function WhatsAppGdprPage() {
  const [copied, setCopied] = useState(false);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(PRIVACY_NOTICE_SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="legal-page min-h-screen bg-[hsl(var(--recete-cream))] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-3">WhatsApp messaging &amp; GDPR</h1>
          <p className="text-zinc-700 mb-2">
            What you, as a merchant, need to have in place before Recete messages your customers on
            WhatsApp — and what Recete does for you.
          </p>
          <p className="text-sm text-zinc-600 mb-8">Last updated: September 24, 2026</p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-sm text-amber-900">
            This page explains how the service works and what the law and WhatsApp&apos;s rules
            generally expect. It is not legal advice. If you are unsure about your situation, speak
            to a data protection adviser.
          </div>

          <div className="prose prose-zinc max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
                Checklist before you go live
              </h2>
              <ol className="list-decimal pl-6 text-zinc-700 mb-4 space-y-2">
                <li>
                  <strong>Connect your own WhatsApp Business number.</strong> In Recete, go to
                  Integrations and sign in with Facebook. Messages to your customers come from this
                  number.
                </li>
                <li>
                  <strong>Ask for consent at checkout, and mention WhatsApp.</strong> Recete only
                  messages customers whose Shopify record shows they accepted marketing. Make sure
                  the wording they agree to says you may contact them on WhatsApp after their
                  purchase.
                </li>
                <li>
                  <strong>Update your privacy notice.</strong> Tell customers you use WhatsApp for
                  post-purchase messages and that Recete processes their data for you. You can copy
                  the paragraph below.
                </li>
                <li>
                  <strong>Accept the Data Processing Addendum.</strong> It is part of our merchant
                  terms and sets out Recete&apos;s role as your processor.{' '}
                  <Link href="/data-processing-addendum" className="text-blue-600 hover:underline">
                    Read the DPA
                  </Link>
                  .
                </li>
                <li>
                  <strong>Tell customers how to stop messages.</strong> Replying STOP always works —
                  see below. Mentioning it in your welcome message is good practice.
                </li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
                Who is responsible for what
              </h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>
                  <strong>You (the merchant)</strong> are the controller of your customers&apos;
                  data. You decide to message them, and you need a lawful basis to do so.
                </li>
                <li>
                  <strong>Recete</strong> is your processor. We handle customer data only to run the
                  messaging and support you configure.
                </li>
                <li>
                  <strong>Meta (WhatsApp)</strong> delivers the messages from your own connected
                  number. The providers Recete relies on are listed in our{' '}
                  <Link href="/privacy#sub-processors" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
                Which messages Recete sends
              </h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>A welcome message with usage guidance once an order is delivered.</li>
                <li>Check-ins a few days and about two weeks after delivery.</li>
                <li>On plans that include it, a product suggestion or reorder reminder.</li>
                <li>Replies whenever the customer writes to you.</li>
              </ul>
              <p className="text-zinc-700 mb-4">
                The first three start only for customers with marketing consent in Shopify.
                Customers without it receive nothing from Recete unless they message you first.
                Consent is checked again right before each scheduled message is sent, so a later
                opt-out always wins.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
                How customers stop messages
              </h2>
              <p className="text-zinc-700 mb-4">
                A customer can reply with any of these words, on its own, to opt out:
              </p>
              <p className="text-zinc-700 mb-4 font-mono text-sm">{OPT_OUT_KEYWORDS_DISPLAY}</p>
              <p className="text-zinc-700 mb-4">
                Asking in their own words (&ldquo;please stop messaging me&rdquo;) works too. Either
                way, Recete confirms the opt-out, records it, and cancels every message still
                scheduled for that customer.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
                What data is used, and where
              </h2>
              <ul className="list-disc pl-6 text-zinc-700 mb-4">
                <li>
                  Customer name, phone number (encrypted at rest), order and delivery details,
                  consent status, and the WhatsApp conversation.
                </li>
                <li>Recete&apos;s database and application run in London, United Kingdom.</li>
                <li>
                  To write replies, the message and the relevant product information are sent to
                  OpenAI in the United States.
                </li>
                <li>
                  Messages are delivered through Meta&apos;s WhatsApp Business Platform, from the
                  WhatsApp Business number you connected.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Customer data requests</h2>
              <p className="text-zinc-700 mb-4">
                When a customer asks you for their data or asks you to delete it, Shopify passes the
                request on to Recete and we handle it automatically. When you uninstall Recete,
                Shopify asks us to erase your store&apos;s data, and we do. You can also export or
                delete data yourself under Settings → GDPR in the Recete dashboard.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">
                Paragraph for your privacy notice
              </h2>
              <p className="text-zinc-700 mb-4">
                Adapt it to your store and add it to your own privacy policy.
              </p>
              <blockquote className="border-l-4 border-zinc-300 bg-zinc-50 p-4 text-zinc-800 whitespace-pre-line not-italic">
                {PRIVACY_NOTICE_SNIPPET}
              </blockquote>
              <button
                type="button"
                onClick={copySnippet}
                className="mt-3 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                {copied ? 'Copied' : 'Copy paragraph'}
              </button>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Questions</h2>
              <p className="text-zinc-700 mb-4">
                Contact{' '}
                <a href="mailto:privacy@recete.co.uk" className="text-blue-600 hover:underline">
                  privacy@recete.co.uk
                </a>
                .
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
