import { CompanyIdentityBlock } from '@/components/site/CompanyIdentityBlock';
import { Link } from '@/i18n/routing';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#f6f4ea] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(10,61,46,.08)] sm:p-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0A3D2E]/70">
            Contact
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#0A3D2E] sm:text-5xl">
            Reach RECETE LTD directly.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-700">
            If you need commercial information, legal details, data protection clarification, or product support
            questions about the Recete platform, use the contact details below.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
            <section className="rounded-[28px] border border-black/5 bg-[#fcfbf5] p-6 sm:p-7">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0A3D2E]">Direct channels</h2>
              <div className="mt-6 space-y-5 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">General</p>
                  <a href="mailto:hello@recete.co.uk" className="mt-2 block font-medium text-[#0A3D2E] hover:underline">
                    hello@recete.co.uk
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Support</p>
                  <a href="mailto:support@recete.co.uk" className="mt-2 block font-medium text-[#0A3D2E] hover:underline">
                    support@recete.co.uk
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Legal & privacy</p>
                  <a href="mailto:legal@recete.co.uk" className="mt-2 block font-medium text-[#0A3D2E] hover:underline">
                    legal@recete.co.uk
                  </a>
                  <a href="mailto:privacy@recete.co.uk" className="mt-1 block font-medium text-[#0A3D2E] hover:underline">
                    privacy@recete.co.uk
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Phone</p>
                  <a href="tel:+447915922506" className="mt-2 block font-medium text-[#0A3D2E] hover:underline">
                    +44 7915 922506
                  </a>
                </div>
              </div>
            </section>

            <CompanyIdentityBlock compact showLinks={false} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/privacy" className="rounded-full border border-[#0A3D2E]/15 px-5 py-3 text-sm font-semibold text-[#0A3D2E]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="rounded-full border border-[#0A3D2E]/15 px-5 py-3 text-sm font-semibold text-[#0A3D2E]">
              Terms of Service
            </Link>
            <Link href="/" className="rounded-full bg-[#0A3D2E] px-5 py-3 text-sm font-semibold text-[#f8f5e6]">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
