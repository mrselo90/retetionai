'use client';

import { Link } from '@/i18n/routing';

type CompanyIdentityBlockProps = {
  compact?: boolean;
  showLinks?: boolean;
};

const companyFacts = {
  legalName: 'RECETE LTD',
  address: '71-75 Shelton Street, Covent Garden, London, WC2H 9JQ',
  companyNumber: '17082027',
  phone: '+44 7915 922506',
  email: 'hello@recete.co.uk',
};

export function CompanyIdentityBlock({
  compact = false,
  showLinks = true,
}: CompanyIdentityBlockProps) {
  const wrapperClass = compact
    ? 'rounded-2xl border border-[#0A3D2E]/10 bg-[#f6f4ea] p-4'
    : 'rounded-[28px] border border-[#0A3D2E]/10 bg-[#f6f4ea] p-6 sm:p-7';

  return (
    <section className={wrapperClass}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0A3D2E]/70">
            Registered Company
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0A3D2E] sm:text-3xl">
            {companyFacts.legalName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700 sm:text-[15px]">
            Incorporated in England and Wales on 10 March 2026 as a private company limited by shares.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Registered office</p>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-800">{companyFacts.address}</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Company number</p>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-800">{companyFacts.companyNumber}</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Phone</p>
            <a href={`tel:${companyFacts.phone.replace(/\s+/g, '')}`} className="mt-2 block text-sm font-medium leading-6 text-zinc-800 hover:text-[#0A3D2E]">
              {companyFacts.phone}
            </a>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Email</p>
            <a href={`mailto:${companyFacts.email}`} className="mt-2 block text-sm font-medium leading-6 text-zinc-800 hover:text-[#0A3D2E]">
              {companyFacts.email}
            </a>
          </div>
        </div>

        {showLinks ? (
          <div className="flex flex-wrap gap-3 text-sm font-medium text-[#0A3D2E]">
            <Link href="/about" className="rounded-full border border-[#0A3D2E]/15 px-4 py-2 hover:bg-white">
              About Recete
            </Link>
            <Link href="/contact" className="rounded-full border border-[#0A3D2E]/15 px-4 py-2 hover:bg-white">
              Contact
            </Link>
            <Link href="/privacy" className="rounded-full border border-[#0A3D2E]/15 px-4 py-2 hover:bg-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="rounded-full border border-[#0A3D2E]/15 px-4 py-2 hover:bg-white">
              Terms of Service
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
