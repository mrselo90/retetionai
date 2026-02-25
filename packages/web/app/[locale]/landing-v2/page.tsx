import Image from 'next/image';
import { Link } from '@/i18n/routing';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Globe2,
  Languages,
  LineChart,
  MessageCircleMore,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';

const navItems = [
  { href: '#problem', label: 'Problem' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
] as const;

const trustLogos = ['AURA LABS', 'DERM.ATELIER', 'SKINFORM', 'LUMA CARE', 'VELA BEAUTY'] as const;

const problemItems = [
  {
    title: 'Customers need usage guidance after delivery',
    body: 'Cosmetic products often need timing, sequence, and frequency guidance. Without it, outcomes feel worse and confidence drops fast.',
  },
  {
    title: 'Returns start as confusion, not as tickets',
    body: 'By the time support sees the issue, the customer has already formed a negative product experience and context is missing.',
  },
  {
    title: 'Replenishment timing is usually guessed',
    body: 'Brands often miss the reorder window because outreach is campaign-based instead of tied to expected product usage cycles.',
  },
  {
    title: 'Support teams repeat the same post-purchase answers',
    body: 'Operators spend time on routine questions that should be handled earlier and more consistently.',
  },
] as const;

const solutionItems = [
  'Shopify product/order context + knowledge-based AI (RAG) for grounded post-purchase answers',
  'WhatsApp-first proactive guidance after purchase or delivery, timed to customer need',
  'Routine suggestions and usage support for cosmetic product questions',
  'Replenishment timing prompts tied to likely usage windows, not generic campaign schedules',
  'Structured return reason capture to improve retention and product education',
  'Merchant-facing visibility into engagement and retention outcomes',
] as const;

const loopSteps = [
  {
    title: 'Connect Shopify',
    body: 'Install and sync products/orders so Recete can use real store context instead of generic scripts.',
    example: '"Connected. Your catalog is ready for post-purchase guidance."',
    icon: Store,
    tone: 'emerald',
  },
  {
    title: 'Check in after purchase / delivery',
    body: 'Recete reaches out when customers need help, not as a promotional blast. The first message starts with product support.',
    example: '"Your order arrived. Want a quick guide for how to use this serum?"',
    icon: MessageCircleMore,
    tone: 'amber',
  },
  {
    title: 'Answer product questions with AI',
    body: 'Customers ask in their own language. Recete responds using product-aware context and practical guidance.',
    example: '"Start 2 nights this week, then increase slowly if your skin tolerates it."',
    icon: Bot,
    tone: 'ink',
  },
  {
    title: 'Track likely usage cycles',
    body: 'The agent estimates when a customer may be running low based on product type, timing, and conversation signals.',
    example: '"You may be nearing the end of your bottle. Want a reminder next week?"',
    icon: Clock3,
    tone: 'emerald',
  },
  {
    title: 'Nudge reorders and learn from returns',
    body: 'Recete supports retention with timely reorder prompts and captures structured feedback if a return is requested.',
    example: '"Was the issue irritation, texture, results, or something else?"',
    icon: RefreshCcw,
    tone: 'amber',
  },
] as const;

const featureCards = [
  {
    title: 'Post-Delivery WhatsApp Check-ins',
    desc: 'Reach customers when confusion usually starts: after the product arrives and usage begins.',
    chips: ['Timed outreach', 'WhatsApp-first', 'Not campaign blasts'],
    variant: 'light',
  },
  {
    title: 'Product-Aware AI Conversations',
    desc: 'Knowledge-based AI (RAG) uses catalog and product knowledge context for more grounded answers.',
    chips: ['RAG answers', 'Catalog context', 'Grounded replies'],
    variant: 'dark',
  },
  {
    title: 'Cosmetic Usage Routine Guidance',
    desc: 'Help customers understand how to use products consistently with practical next-step guidance.',
    chips: ['Usage guidance', 'Routine support', 'Clear instructions'],
    variant: 'light',
  },
  {
    title: 'Replenishment Timing Intelligence',
    desc: 'Prompt reorders around likely product depletion windows instead of guessing campaign timing.',
    chips: ['Usage cycles', 'Reorder nudges', 'Retention timing'],
    variant: 'sand',
  },
  {
    title: 'Return Feedback Capture',
    desc: 'Capture structured reasons when customers are unhappy so teams can improve education and product fit.',
    chips: ['Return reasons', 'Structured feedback', 'Team visibility'],
    variant: 'light',
  },
  {
    title: 'ROI & Retention Visibility',
    desc: 'Give operators a clear view of engagement and retention signals without drowning them in vanity metrics.',
    chips: ['Ops metrics', 'ROI context', 'Team reporting'],
    variant: 'sand',
  },
  {
    title: 'Multilingual by Default',
    desc: 'Customers can ask questions in their own language and get in-language support from the AI agent.',
    chips: ['Language-aware', 'Global stores', 'Lower support friction'],
    variant: 'light',
  },
  {
    title: 'Shopify-Native Setup',
    desc: 'Positioned for fast merchant onboarding with Shopify-first operator workflows and low setup overhead.',
    chips: ['Shopify-first', 'Fast onboarding', 'Operator-friendly'],
    variant: 'dark',
  },
] as const;

const comparisonRows = [
  {
    label: 'Primary job',
    campaign: 'Promotional sends and lifecycle campaigns',
    support: 'Tickets, inboxes, and support agent workflows',
    recete: 'Product usage guidance, return prevention, and replenishment timing',
  },
  {
    label: 'When it starts',
    campaign: 'Campaign schedule or segment trigger',
    support: 'After a customer contacts support',
    recete: 'After purchase / delivery, before frustration escalates',
  },
  {
    label: 'Product understanding',
    campaign: 'Template-level messaging',
    support: 'Depends on agent knowledge',
    recete: 'Knowledge-based AI with product context (RAG)',
  },
  {
    label: 'Return prevention',
    campaign: 'Indirect',
    support: 'Reactive',
    recete: 'Core workflow goal',
  },
] as const;

const pricingPlans = [
  {
    name: 'Starter',
    price: 'From EUR49',
    note: 'Placeholder pricing for low-volume Shopify brands',
    desc: 'For merchants validating post-purchase retention workflows.',
    bullets: ['Shopify integration', 'WhatsApp check-ins', 'Core AI guidance', 'Basic reporting'],
    featured: false,
  },
  {
    name: 'Growth',
    price: 'From EUR149',
    note: 'Placeholder pricing for scaling DTC operations',
    desc: 'For teams that need broader AI coverage and stronger operational visibility.',
    bullets: ['Everything in Starter', 'Advanced product-aware AI', 'ROI/retention dashboard', 'Escalation controls'],
    featured: true,
  },
  {
    name: 'Scale',
    price: 'From EUR399',
    note: 'Placeholder pricing for high-volume brands',
    desc: 'For larger teams requiring deeper controls and higher throughput.',
    bullets: ['Everything in Growth', 'Higher usage limits', 'Multi-team workflow support', 'Priority support'],
    featured: false,
  },
] as const;

const faqs = [
  {
    q: 'How long does setup take?',
    a: 'Most merchants can connect Shopify quickly and start from default post-purchase messaging, then refine timing and copy later.',
  },
  {
    q: 'Is this landing concept Shopify-only?',
    a: 'Yes. This v2 preview is intentionally optimized for Shopify positioning and Shopify App Store readiness.',
  },
  {
    q: 'Does Recete replace Klaviyo or Gorgias?',
    a: 'No. Recete is positioned as a post-purchase retention and product-usage agent. It complements campaign and support tools.',
  },
  {
    q: 'Is WhatsApp required?',
    a: 'The core product positioning here is WhatsApp-first. Final channel setup depends on your operational configuration.',
  },
  {
    q: 'How does the AI know my products?',
    a: 'Recete uses store product context and knowledge content so responses can be more specific than generic chatbot answers.',
  },
  {
    q: 'Can customers write in different languages?',
    a: 'Yes. Recete is positioned for multilingual customer conversations and in-language responses.',
  },
  {
    q: 'How does this reduce returns?',
    a: 'By delivering proactive usage guidance and product-aware answers early, it helps prevent avoidable confusion before it becomes a return request.',
  },
  {
    q: 'What about human handoff?',
    a: 'You can keep operator control for sensitive or complex cases. The goal is to reduce repetitive workload, not remove human oversight.',
  },
  {
    q: 'How should security/privacy be described on the landing page?',
    a: 'Use high-level, accurate language (merchant controls, secure handling practices, GDPR-aligned workflows) and keep legal specifics in policy pages.',
  },
  {
    q: 'Does Recete provide medical advice for skincare?',
    a: 'No. Recete should be positioned as product-usage guidance and customer support automation, not medical diagnosis or prescription advice.',
  },
] as const;

const testimonials = [
  {
    quote:
      'We stopped treating post-purchase as a generic campaign step. Customers got clearer usage guidance and our team handled fewer repetitive questions.',
    name: 'Ece Demir',
    role: 'Founder, skincare brand',
    metric: '-22% avoidable returns (example)',
  },
  {
    quote:
      'The biggest difference was timing. Support happened earlier, before customers gave up on the product.',
    name: 'Mark Jensen',
    role: 'Operations lead, DTC beauty store',
    metric: '2.0x faster issue resolution (example)',
  },
  {
    quote:
      'Recete made post-purchase retention easier to explain internally because it is clearly not a campaign tool or a helpdesk clone.',
    name: 'Selin Kaya',
    role: 'E-commerce manager, wellness brand',
    metric: '+14% repeat purchase lift (example)',
  },
] as const;

function sectionHeader(eyebrow: string, title: string, subtitle?: string, align: 'left' | 'center' = 'left') {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <span className="inline-flex items-center rounded-full border border-[#0a3d2e]/10 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[#0a3d2e] shadow-sm">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl lg:text-4xl">{title}</h2>
      {subtitle ? (
        <p className={`mt-2 text-sm leading-relaxed text-zinc-600 sm:text-base ${align === 'center' ? 'mx-auto max-w-3xl' : 'max-w-3xl'}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function toneClasses(tone: 'emerald' | 'amber' | 'ink') {
  if (tone === 'amber') {
    return {
      shell: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-700',
      badge: 'border-amber-200 bg-amber-100 text-amber-800',
    };
  }
  if (tone === 'ink') {
    return {
      shell: 'border-[#0a3d2e]/15 bg-[#0a3d2e]/5',
      icon: 'text-[#0a3d2e]',
      badge: 'border-[#0a3d2e]/15 bg-white text-[#0a3d2e]',
    };
  }
  return {
    shell: 'border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-700',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  };
}

function featureVariantClasses(variant: 'light' | 'dark' | 'sand') {
  if (variant === 'dark') {
    return {
      card: 'border-[#0a3d2e]/10 bg-[#0a3d2e] text-[#f8f5e6] shadow-[0_18px_50px_rgba(10,61,46,.12)]',
      icon: 'bg-white/8 text-emerald-200 border-white/10',
      title: 'text-[#f8f5e6]',
      desc: 'text-[#f8f5e6]/78',
      chip: 'border-white/12 bg-white/5 text-[#f8f5e6]',
    };
  }
  if (variant === 'sand') {
    return {
      card: 'border-black/5 bg-[#fbf8ee] text-[#16231d] shadow-[0_14px_40px_rgba(10,61,46,.05)]',
      icon: 'bg-white text-[#0a3d2e] border-black/5',
      title: 'text-[#0a3d2e]',
      desc: 'text-zinc-600',
      chip: 'border-black/8 bg-white text-zinc-700',
    };
  }
  return {
    card: 'border-black/5 bg-white text-[#16231d] shadow-[0_14px_40px_rgba(10,61,46,.05)]',
    icon: 'bg-[#f5f1e5] text-[#0a3d2e] border-black/5',
    title: 'text-[#0a3d2e]',
    desc: 'text-zinc-600',
    chip: 'border-black/8 bg-[#faf8f0] text-zinc-700',
  };
}

export default function LandingV2Page() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f4efe2] text-[#16231d]">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(16,185,129,.16),transparent_38%),radial-gradient(circle_at_90%_8%,rgba(245,158,11,.14),transparent_36%),radial-gradient(circle_at_55%_38%,rgba(10,61,46,.06),transparent_48%)]" />
        <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(to_right,#0a3d2e_1px,transparent_1px),linear-gradient(to_bottom,#0a3d2e_1px,transparent_1px)] [background-size:30px_30px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f4efe2]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="inline-flex items-center rounded-xl border border-black/5 bg-white/85 px-2 py-1.5 shadow-sm">
              <Image src="/recete-logo.svg" alt="Recete" width={130} height={34} className="h-7 w-auto" />
            </Link>
            <span className="hidden rounded-full border border-[#0a3d2e]/10 bg-white px-3 py-1 text-xs font-semibold text-[#0a3d2e] md:inline-flex">
              Landing V2 Preview
            </span>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Landing sections">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-white hover:text-zinc-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#0a3d2e] shadow-sm hover:bg-[#fbf8ee] sm:inline-flex"
            >
              Current Landing
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0a3d2e] px-3.5 py-2 text-sm font-semibold text-[#f8f5e6] shadow-[0_12px_28px_rgba(10,61,46,.18)] hover:bg-[#0d4a38]"
            >
              Install on Shopify
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:pb-14">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[1.05fr_.95fr] lg:gap-5">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-[#0a3d2e]/10 bg-white p-5 shadow-[0_20px_70px_rgba(10,61,46,.08)] sm:p-7 lg:p-8">
            <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-50 to-transparent" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Shopify-only AI retention agent for cosmetic brands
              </div>

              <h1 className="mt-4 text-3xl font-extrabold leading-[1.02] tracking-tight text-[#0a3d2e] sm:text-4xl lg:text-[3.65rem]">
                Post-purchase retention,
                <span className="block text-[#1b6f58]">built around product usage.</span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 sm:text-base">
                Recete guides Shopify customers on WhatsApp after purchase, answers product-specific questions with knowledge-based AI, and helps reduce avoidable returns.
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                It is not a campaign tool and not a helpdesk. It is a product-usage and replenishment agent for the period after checkout.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0a3d2e] px-5 py-3.5 text-sm font-semibold text-[#f8f5e6] shadow-[0_14px_40px_rgba(10,61,46,.2)] hover:bg-[#0d4a38]"
                >
                  Install on Shopify
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-[#fbf8ee] px-5 py-3.5 text-sm font-semibold text-[#0a3d2e] hover:bg-white"
                >
                  Book a demo
                </Link>
                <Link href="#features" className="inline-flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
                  Explore the workflow
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                {[
                  'Shopify-native positioning',
                  'WhatsApp-first',
                  'No credit card required',
                  'Placeholder metrics labeled below',
                ].map((item) => (
                  <span key={item} className="rounded-full border border-black/8 bg-white px-3 py-1 text-zinc-600">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  { label: 'Focus', value: 'Retention after checkout' },
                  { label: 'Channel', value: 'WhatsApp-first guidance' },
                  { label: 'AI', value: 'Product-aware (RAG)' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-black/5 bg-[#faf8f0] p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{item.label}</p>
                    <p className="mt-1 text-sm font-bold text-[#0a3d2e]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-[0_20px_70px_rgba(10,61,46,.08)]">
              <div className="border-b border-black/5 bg-[#faf8f0] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  <div className="ml-2 truncate rounded-lg border border-black/5 bg-white px-2.5 py-1 text-xs text-zinc-500">
                    Recete agent preview / dashboard placeholder
                  </div>
                </div>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Shopify', value: 'Native' },
                    { label: 'Channel', value: 'WA' },
                    { label: 'Mode', value: 'Post-purchase' },
                    { label: 'AI', value: 'RAG' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border border-black/5 bg-[#faf8f0] p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{kpi.label}</div>
                      <div className="mt-1 text-sm font-bold text-[#0a3d2e]">{kpi.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 overflow-hidden rounded-2xl border border-black/5 bg-white">
                  <Image
                    src="/dashboard-preview.png"
                    alt="Recete dashboard preview placeholder for landing v2"
                    width={1200}
                    height={750}
                    className="h-auto w-full object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 560px"
                  />
                </div>
                <p className="px-1 pt-3 text-xs leading-relaxed text-zinc-500">
                  Placeholder screenshot: replace with dedicated Shopify App Store visuals (merchant dashboard, AI conversation preview, retention/ROI summary).
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#0a3d2e]/10 bg-[#0a3d2e] p-4 text-[#f8f5e6] shadow-[0_20px_65px_rgba(10,61,46,.18)] sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f8f5e6]/65">Agent Loop Snapshot</p>
                  <p className="mt-1 text-base font-bold sm:text-lg">Helpful timing, not generic campaigns</p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-xs font-semibold">Example messages</span>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  { t: 'T+0', msg: 'Want a quick usage guide for your new serum?' },
                  { t: 'T+3', msg: 'How is your routine going? I can help adjust frequency.' },
                  { t: 'T+21', msg: 'You may be running low soon. Want a reorder reminder?' },
                ].map((item) => (
                  <div key={item.t} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-emerald-200">
                      {item.t}
                    </span>
                    <p className="text-sm leading-relaxed text-[#f8f5e6]/92">{item.msg}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-2 sm:px-6 sm:py-3">
        <div className="mx-auto w-full max-w-7xl rounded-[1.5rem] border border-black/5 bg-white/85 p-4 shadow-[0_10px_34px_rgba(10,61,46,.05)] backdrop-blur sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <p className="text-sm font-semibold leading-relaxed text-[#0a3d2e]">
              Trust / credibility bar (placeholder): Shopify-native positioning, product-aware AI, multilingual support, and GDPR-aligned workflow messaging.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {trustLogos.map((logo) => (
                <div key={logo} className="rounded-xl border border-black/5 bg-[#faf8f0] px-3 py-2 text-center text-[11px] font-bold tracking-[0.14em] text-zinc-500">
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="problem">
        <div className="mx-auto w-full max-w-7xl">
          {sectionHeader(
            'Problem',
            'Cosmetic brands lose margin after checkout when product usage fails',
            'The issue is not only messaging volume. It is timing, product guidance quality, and whether help arrives before a return request starts.',
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_.95fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {problemItems.map((item) => (
                <article key={item.title} className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_12px_36px_rgba(10,61,46,.05)]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
                    <CircleAlert className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-base font-bold tracking-tight text-[#0a3d2e]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.body}</p>
                </article>
              ))}
            </div>

            <div className="rounded-3xl border border-[#0a3d2e]/10 bg-gradient-to-br from-white to-[#fbf8ee] p-5 shadow-[0_16px_50px_rgba(10,61,46,.07)] sm:p-6">
              <div className="grid gap-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Why typical tools fail here</p>
                  <p className="mt-2 text-sm leading-relaxed text-amber-900">
                    Campaign tools are built to send. Helpdesks are built to respond. Neither is built specifically to manage product usage success after delivery.
                  </p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">What merchants actually need</p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                    {[
                      'Product-aware post-purchase guidance',
                      'Earlier intervention before dissatisfaction grows',
                      'Replenishment timing tied to usage cycles',
                      'Return feedback that improves future retention',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 sm:pb-16" id="solution">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[.95fr_1.05fr]">
          <div className="rounded-3xl border border-[#0a3d2e]/12 bg-[#0a3d2e] p-6 text-[#f8f5e6] shadow-[0_18px_60px_rgba(10,61,46,.18)] sm:p-7">
            <p className="inline-flex rounded-full border border-white/15 bg-white/6 px-3 py-1 text-xs font-semibold text-emerald-200">
              Solution: Recete AI Agent
            </p>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              A post-purchase agent for product usage success and repeat purchases
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#f8f5e6]/85 sm:text-base">
              Recete is positioned as a Shopify-first retention agent focused on what happens after checkout: usage guidance, product-aware answers, replenishment timing, and return prevention.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { icon: MessageCircleMore, label: 'WhatsApp-first engagement' },
                { icon: Globe2, label: 'Shopify-native workflow' },
                { icon: Languages, label: 'Multilingual support' },
                { icon: LineChart, label: 'Retention visibility' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <Icon className="h-4 w-4 text-emerald-200" aria-hidden />
                    <p className="mt-2 text-sm font-semibold text-[#f8f5e6]">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-[0_16px_50px_rgba(10,61,46,.06)] sm:p-6">
            <ul className="space-y-2.5">
              {solutionItems.map((item, idx) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                    <span className="text-[11px] font-bold text-emerald-700">{idx + 1}</span>
                  </span>
                  <span className="text-sm leading-relaxed text-zinc-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="how-it-works">
        <div className="mx-auto w-full max-w-7xl">
          {sectionHeader(
            'How It Works (Agent Loop)',
            'Five steps designed for the period after purchase',
            'This preview uses the 5-step flow from your document but presents it with stronger visual hierarchy, clearer examples, and better mobile readability.',
            'center',
          )}

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[.85fr_1.15fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">What makes the loop different</p>
                <div className="mt-4 space-y-3">
                  {[
                    'Starts with product help, not promotions',
                    'Uses product-aware AI for grounded answers',
                    'Tracks likely usage cycles and replenishment timing',
                    'Captures return reasons for future improvements',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl border border-black/5 bg-[#faf8f0] p-3 text-sm text-zinc-700">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {loopSteps.map((step, index) => {
                const Icon = step.icon;
                const tone = toneClasses(step.tone);
                return (
                  <article key={step.title} className="rounded-3xl border border-black/5 bg-white p-4 shadow-[0_12px_36px_rgba(10,61,46,.05)] sm:p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr] md:items-start">
                      <div className="flex items-center gap-3 md:block">
                        <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border ${tone.shell}`}>
                          <Icon className={`h-5 w-5 ${tone.icon}`} aria-hidden />
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold md:mt-2 ${tone.badge}`}>
                          Step {index + 1}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
                        <div>
                          <h3 className="text-base font-bold tracking-tight text-[#0a3d2e] sm:text-lg">{step.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.body}</p>
                        </div>
                        <div className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Example message</p>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-700">{step.example}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="features">
        <div className="mx-auto w-full max-w-7xl">
          {sectionHeader(
            'Feature Grid',
            'A stronger UI layout for the document-defined feature set',
            'The feature grid now uses clearer contrast, consistent card sizing, and a less repetitive visual rhythm while staying product-led.',
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature, idx) => {
              const variant = featureVariantClasses(feature.variant);
              const tall = idx === 1 || idx === 7;
              return (
                <article
                  key={feature.title}
                  className={`group flex h-full flex-col rounded-3xl border p-5 transition-all hover:-translate-y-1 ${variant.card} ${tall ? 'xl:min-h-[270px]' : ''}`}
                >
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${variant.icon}`}>
                    {idx % 2 === 0 ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  </span>
                  <h3 className={`mt-4 text-base font-bold tracking-tight ${variant.title}`}>{feature.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${variant.desc}`}>{feature.desc}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    {feature.chips.map((chip) => (
                      <span key={chip} className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${variant.chip}`}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="differentiation">
        <div className="mx-auto w-full max-w-7xl rounded-3xl border border-black/5 bg-white p-5 shadow-[0_16px_50px_rgba(10,61,46,.06)] sm:p-7">
          {sectionHeader(
            'Differentiation',
            'Campaign tools send. Helpdesks react. Recete manages product usage after checkout.',
            'This section is intentionally explicit so merchants understand the category quickly and do not misclassify Recete as another generic messaging or support tool.',
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
              <p className="text-sm font-semibold text-zinc-700">Campaign Tools (Klaviyo)</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">Strong for promotional sends and lifecycle campaigns. Not built around product usage support after delivery.</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
              <p className="text-sm font-semibold text-zinc-700">Support Tools (Gorgias / Zendesk)</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">Strong for inboxes and agents. Mostly starts after a customer reports a problem.</p>
            </div>
            <div className="rounded-2xl border border-[#0a3d2e]/12 bg-[#0a3d2e] p-4 text-[#f8f5e6]">
              <p className="text-sm font-semibold">Recete (Retention Agent)</p>
              <p className="mt-1 text-sm leading-relaxed text-[#f8f5e6]/80">Designed for proactive post-purchase product guidance, return prevention, and replenishment timing.</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-black/5">
            {comparisonRows.map((row, index) => (
              <div key={row.label} className={`grid grid-cols-1 gap-0 border-b border-black/5 md:grid-cols-[220px_1fr_1fr_1fr] ${index === comparisonRows.length - 1 ? 'border-b-0' : ''}`}>
                <div className="bg-[#faf8f0] px-4 py-3 text-sm font-semibold text-[#0a3d2e]">{row.label}</div>
                <div className="px-4 py-3 text-sm text-zinc-600 md:border-l md:border-black/5">{row.campaign}</div>
                <div className="px-4 py-3 text-sm text-zinc-600 md:border-l md:border-black/5">{row.support}</div>
                <div className="bg-[#0a3d2e]/[0.03] px-4 py-3 text-sm text-zinc-700 md:border-l md:border-[#0a3d2e]/10">{row.recete}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="case-study">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-7">
            {sectionHeader(
              'Mini Case Study (Example Results)',
              'A realistic example for investor / merchant review',
              'Use this as placeholder framing until you replace it with validated merchant outcomes. The UI now makes that disclaimer much harder to miss.',
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Before</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  <li>Generic post-purchase messaging</li>
                  <li>Support answers repeated manually</li>
                  <li>Reorders depend on campaign guesses</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">After (example)</p>
                <ul className="mt-3 space-y-2 text-sm text-emerald-900">
                  <li>Earlier usage guidance after delivery</li>
                  <li>More product-aware answers without added headcount</li>
                  <li>Reorder prompts tied closer to likely product usage</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              Disclaimer: All metrics in this section are example results for landing-page positioning. Replace with validated data before production launch.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Repeat purchase rate', value: '+14% (example)', tone: 'emerald' },
              { label: 'Avoidable returns', value: '-22% (example)', tone: 'amber' },
              { label: 'Repetitive support volume', value: '-31% (example)', tone: 'ink' },
            ].map((metric) => {
              const t = toneClasses(metric.tone as 'emerald' | 'amber' | 'ink');
              return (
                <div key={metric.label} className={`rounded-3xl border p-5 shadow-[0_12px_36px_rgba(10,61,46,.05)] ${t.shell}`}>
                  <p className="text-sm font-medium text-zinc-600">{metric.label}</p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#0a3d2e]">{metric.value}</p>
                </div>
              );
            })}
            <div className="rounded-3xl border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Positioning lines (options)</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                <li>&ldquo;They manage messages. Recete manages product usage.&rdquo;</li>
                <li>&ldquo;Built for Shopify cosmetic brands.&rdquo;</li>
                <li>&ldquo;No flows. No rules. Just better product usage and repeat customers.&rdquo;</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="integrations">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-7">
            {sectionHeader(
              'Integrations',
              'Shopify-native setup with low operational friction',
              'This section is now easier to scan: core integration claims are surfaced as operator-facing bullets instead of dense paragraphs.',
            )}
            <ul className="mt-5 space-y-2.5">
              {[
                'Shopify-native onboarding and product/order sync',
                'WhatsApp-first customer engagement for post-purchase guidance',
                'No-code / low-code setup messaging for operator confidence',
                'Optional channel mentions only when they support the retention workflow',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border border-black/5 bg-[#faf8f0] p-3 text-sm text-zinc-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-7">
            {sectionHeader(
              'Security & Privacy (High-Level)',
              'Reassure merchants without legal overclaiming',
              'The design now separates legal-sounding topics into clear cards so the section reads like responsible product messaging, not unverifiable compliance marketing.',
            )}
            <div className="mt-5 space-y-3">
              {[
                {
                  title: 'Merchant controls and access boundaries',
                  body: 'Describe secure operational practices and merchant controls in product terms, without implying legal guarantees you have not documented.',
                },
                {
                  title: 'GDPR-aligned workflow messaging',
                  body: 'Use wording such as “designed to support GDPR-aligned workflows” unless a reviewed legal claim is available.',
                },
                {
                  title: 'Uninstall / data handling (high-level)',
                  body: 'Keep the landing page high-level and direct merchants to policy pages for legal details.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
                  <p className="text-sm font-semibold text-[#0a3d2e]">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="pricing">
        <div className="mx-auto w-full max-w-7xl">
          {sectionHeader(
            'Pricing',
            'Start lean. Upgrade when retention volume grows.',
            'Pricing remains placeholder-based, but the UI now communicates plan progression more clearly and keeps the featured plan visually dominant without overwhelming the page.',
            'center',
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-3xl border p-5 shadow-[0_16px_46px_rgba(10,61,46,.06)] sm:p-6 ${
                  plan.featured ? 'border-[#0a3d2e]/15 bg-[#0a3d2e] text-[#f8f5e6]' : 'border-black/5 bg-white'
                }`}
              >
                {plan.featured ? (
                  <span className="absolute -top-2 left-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-[#0a3d2e]">
                    Most Popular
                  </span>
                ) : null}

                <h3 className={`text-lg font-bold tracking-tight ${plan.featured ? 'text-[#f8f5e6]' : 'text-[#0a3d2e]'}`}>{plan.name}</h3>
                <p className={`mt-1 text-sm ${plan.featured ? 'text-[#f8f5e6]/75' : 'text-zinc-600'}`}>{plan.desc}</p>

                <div className="mt-5">
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-extrabold tracking-tight ${plan.featured ? 'text-white' : 'text-[#0a3d2e]'}`}>{plan.price}</span>
                    <span className={`mb-1 text-sm ${plan.featured ? 'text-[#f8f5e6]/75' : 'text-zinc-500'}`}>/ month</span>
                  </div>
                  <p className={`mt-1 text-xs ${plan.featured ? 'text-[#f8f5e6]/68' : 'text-zinc-500'}`}>{plan.note}</p>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${plan.featured ? 'border-white/15 bg-white/8' : 'border-emerald-200 bg-emerald-50'}`}>
                        <Check className={`h-3 w-3 ${plan.featured ? 'text-emerald-200' : 'text-emerald-700'}`} aria-hidden />
                      </span>
                      <span className={plan.featured ? 'text-[#f8f5e6]/90' : 'text-zinc-700'}>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-auto inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    plan.featured ? 'mt-6 bg-white text-[#0a3d2e] hover:bg-[#f8f5e6]' : 'mt-6 border border-black/10 bg-[#faf8f0] text-[#0a3d2e] hover:bg-white'
                  }`}
                >
                  Start free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-emerald-900">
                ROI note (illustrative): many merchants can justify the subscription by preventing a small number of avoidable returns per month.
              </p>
              <a href="#case-study" className="text-sm font-semibold text-emerald-800 hover:text-emerald-900">
                Estimate your ROI
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="faq">
        <div className="mx-auto w-full max-w-5xl">
          {sectionHeader(
            'FAQ',
            'Common questions from Shopify brands evaluating Recete',
            'Expanded FAQ (10 questions) with stronger visual grouping and better readability on mobile.',
            'center',
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {faqs.map((item, idx) => (
              <details key={item.q} className="group rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(10,61,46,.04)] sm:p-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <span className="pr-2 text-sm font-semibold text-[#0a3d2e] sm:text-base">{item.q}</span>
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/10 text-zinc-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="mt-3 flex items-start gap-2">
                  <span className="mt-0.5 text-[11px] font-bold text-zinc-400">{String(idx + 1).padStart(2, '0')}</span>
                  <p className="text-sm leading-relaxed text-zinc-600 sm:text-base">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 sm:pb-14" id="final-cta">
        <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] border border-[#0a3d2e]/12 bg-[#0a3d2e] shadow-[0_26px_80px_rgba(10,61,46,.2)]">
          <div className="grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-8 lg:p-10">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/6 px-3 py-1 text-xs font-semibold text-emerald-200">
                Final CTA
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Improve product usage after checkout. Reduce avoidable returns before they start.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#f8f5e6]/82 sm:text-base">
                Recete helps Shopify brands deliver practical WhatsApp guidance, answer post-purchase questions with product-aware AI, and support better repeat purchase timing.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                {['Shopify-first', 'WhatsApp-first', 'Product-aware AI (RAG)', 'Example metrics clearly labeled'].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[#f8f5e6]/85">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-[#0a3d2e] hover:bg-[#f8f5e6]"
              >
                Install on Shopify
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/6 px-5 py-3.5 text-sm font-semibold text-[#f8f5e6] hover:bg-white/10"
              >
                Book a demo
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-transparent px-5 py-3.5 text-sm font-semibold text-[#f8f5e6]/90 hover:bg-white/5 sm:col-span-2 lg:col-span-1"
              >
                View current landing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 rounded-3xl border border-black/5 bg-white p-5 shadow-[0_12px_40px_rgba(10,61,46,.05)] sm:grid-cols-[1.15fr_.85fr_.85fr_.85fr] sm:p-7">
          <div>
            <Image src="/recete-logo.svg" alt="Recete" width={140} height={34} className="h-8 w-auto" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600">
              Post-purchase AI for Shopify merchants focused on product usage success, return prevention, and repeat purchase timing through WhatsApp-first guidance.
            </p>
            <p className="mt-3 text-xs font-medium text-zinc-500">
              V2 preview route created from your landing document. Existing landing page remains unchanged.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#0a3d2e]">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><a href="#problem" className="hover:text-zinc-900">Problem</a></li>
              <li><a href="#how-it-works" className="hover:text-zinc-900">How It Works</a></li>
              <li><a href="#features" className="hover:text-zinc-900">Features</a></li>
              <li><a href="#pricing" className="hover:text-zinc-900">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#0a3d2e]">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link href="/signup" className="hover:text-zinc-900">Book a Demo</Link></li>
              <li><Link href="/signup" className="hover:text-zinc-900">Contact</Link></li>
              <li><Link href="/signup" className="hover:text-zinc-900">About</Link></li>
              <li><a href="#faq" className="hover:text-zinc-900">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#0a3d2e]">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link href="/privacy-policy" className="hover:text-zinc-900">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-zinc-900">Terms of Service</Link></li>
              <li><Link href="/cookie-policy" className="hover:text-zinc-900">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-7xl flex-col gap-2 px-1 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Recete Landing V2 Preview. Built for Shopify. All rights reserved.</p>
          <p>Root locale path still serves the current production landing.</p>
        </div>
      </footer>
    </main>
  );
}
