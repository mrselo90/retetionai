import { Link } from '@/i18n/routing';
import { CompanyIdentityBlock } from '@/components/site/CompanyIdentityBlock';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f6f4ea] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(10,61,46,.08)] sm:p-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0A3D2E]/70">
            About RECETE LTD
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-[#0A3D2E] sm:text-5xl">
            We build WhatsApp-first post-purchase support for modern commerce brands.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-700">
            Recete helps merchants answer product questions, send proactive delivery guidance, reduce avoidable
            returns, and improve customer retention through grounded AI conversations. Our platform is built for
            real operational support, not generic chatbot demos.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-[28px] border border-black/5 bg-[#fcfbf5] p-6 sm:p-7">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0A3D2E]">What we do</h2>
              <div className="mt-5 space-y-5 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                <p>
                  We provide a merchant platform that combines product knowledge, structured facts, order-aware
                  retrieval, and WhatsApp automation into one customer-facing support system.
                </p>
                <p>
                  Our primary focus is practical post-purchase support: usage guidance, product clarification,
                  return prevention, and faster customer answers that remain grounded in merchant-approved data.
                </p>
                <p>
                  The platform is operated by <strong>RECETE LTD</strong>, a company registered in England and Wales.
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#0A3D2E]/10 bg-[#0A3D2E] p-6 text-[#f8f5e6] sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f8f5e6]/70">
                Compliance posture
              </p>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-[#f8f5e6]/90 sm:text-[15px]">
                <li>Merchant-controlled product knowledge and customer support flows</li>
                <li>Privacy, terms, security, and data-processing documentation publicly available</li>
                <li>Customer communications via approved WhatsApp and e-commerce integrations</li>
              </ul>
            </section>
          </div>

          <div className="mt-10">
            <CompanyIdentityBlock />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-full bg-[#0A3D2E] px-5 py-3 text-sm font-semibold text-[#f8f5e6]">
              Contact RECETE LTD
            </Link>
            <Link href="/" className="rounded-full border border-[#0A3D2E]/15 px-5 py-3 text-sm font-semibold text-[#0A3D2E]">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
