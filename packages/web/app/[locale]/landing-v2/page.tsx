import Image from 'next/image';
import { Link } from '@/i18n/routing';
import {
  ArrowRight,
  Bot,
  Check,
  CircleAlert,
  Clock3,
  Globe2,
  Languages,
  LineChart,
  MessageCircleMore,
  RefreshCcw,
  Sparkles,
  Store,
} from 'lucide-react';

const navItems = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
] as const;

const trustLogos = ['AURA LABS', 'DERM.ATELIER', 'SKINFORM', 'LUMA CARE', 'VELA BEAUTY'] as const;

const problemItems = [
  {
    title: 'Customers use products the wrong way',
    body: 'Cosmetic products often need timing, order, and frequency guidance. Without it, results suffer and dissatisfaction rises.',
  },
  {
    title: 'Returns happen before support sees the problem',
    body: 'By the time a return request arrives, the missing context is already lost and the product experience is broken.',
  },
  {
    title: 'Replenishment moments are missed',
    body: 'Customers run out quietly. Brands lose the reorder because nobody checked in at the right time.',
  },
  {
    title: 'Teams repeat the same answers every day',
    body: 'Support agents spend time on predictable post-purchase questions instead of escalations and high-value conversations.',
  },
] as const;

const solutionItems = [
  'Understands your products and usage context from your catalog + knowledge base',
  'Starts WhatsApp guidance after purchase/delivery with proactive timing',
  'Answers product questions with knowledge-based AI (RAG) instead of generic chatbot replies',
  'Helps customers use products correctly before frustration turns into returns',
  'Tracks likely replenishment windows and nudges reorders at the right moment',
  'Captures return reasons and feedback signals merchants can actually use',
] as const;

const loopSteps = [
  {
    title: 'Connect Shopify',
    body: 'Install the app and sync products/orders. Recete prepares product context so the AI can answer with store-specific guidance.',
    example: '"Connected. Your top 120 products are ready for post-purchase guidance."',
    icon: Store,
    accent: 'emerald',
  },
  {
    title: 'Check in after purchase/delivery',
    body: 'Recete sends a WhatsApp message when timing matters, not as a generic blast. It starts with help, not promotion.',
    example: '"Your order arrived. Want a quick guide for how to use this serum safely and consistently?"',
    icon: MessageCircleMore,
    accent: 'amber',
  },
  {
    title: 'Create routines on demand',
    body: 'If the customer needs help, the AI gives a practical usage routine based on the product and the question asked.',
    example: '"Use 2-3 nights this week, then increase if skin tolerates it. I can build a full routine for morning/evening."',
    icon: Bot,
    accent: 'emerald',
  },
  {
    title: 'Track usage cycles',
    body: 'Recete estimates when a product is likely running low and keeps timing logic tied to product type and usage behavior.',
    example: '"You may be close to the last third of your bottle. Want a reorder reminder next week?"',
    icon: Clock3,
    accent: 'ink',
  },
  {
    title: 'Nudge reorders and learn from returns',
    body: 'It encourages repeat purchases when appropriate and captures structured reasons when a customer is unhappy or wants to return.',
    example: '"Sorry it did not work for you. Was the issue irritation, texture, results, or something else?"',
    icon: RefreshCcw,
    accent: 'amber',
  },
] as const;

const featureCards = [
  {
    title: 'Post-Delivery WhatsApp Check-ins',
    desc: 'Trigger helpful messages after purchase and delivery so customers get support when confusion usually starts.',
    chips: ['Timed outreach', 'WhatsApp-first', 'No blast campaigns'],
  },
  {
    title: 'Product-Aware AI Conversations',
    desc: 'Answer product-specific questions using your catalog and knowledge content, not generic chatbot guesses.',
    chips: ['RAG answers', 'Catalog context', 'Grounded replies'],
  },
  {
    title: 'Routine Builder for Cosmetic Use',
    desc: 'Guide customers with simple, practical routines when they ask how to use a product or combine it with others.',
    chips: ['Usage guidance', 'Routine suggestions', 'Clear next steps'],
  },
  {
    title: 'Replenishment Timing Intelligence',
    desc: 'Estimate likely reorder moments and nudge customers before they drop off or switch to another brand.',
    chips: ['Usage cycles', 'Reorder nudges', 'Retention timing'],
  },
  {
    title: 'Return Feedback Capture',
    desc: 'Collect structured reasons when a customer wants to return, helping teams improve product education and merchandising.',
    chips: ['Return reasons', 'Structured feedback', 'Team visibility'],
  },
  {
    title: 'Merchant ROI & Retention Dashboard',
    desc: 'Track engagement and outcome-oriented signals so merchants can see whether post-purchase automation is paying off.',
    chips: ['ROI visibility', 'Engagement metrics', 'Ops reporting'],
  },
  {
    title: 'Multilingual by Default',
    desc: 'Customers can ask questions in their own language and the AI responds in-language without manual routing.',
    chips: ['Auto language handling', 'Global stores', 'Less support friction'],
  },
  {
    title: 'Shopify-Native Setup',
    desc: 'Install and connect quickly with a Shopify-first onboarding flow designed for operators, not developers.',
    chips: ['Shopify-first', 'Fast onboarding', 'Low setup effort'],
  },
] as const;

const comparison = [
  {
    category: 'Primary job',
    campaigns: 'Promotional sends and lifecycle campaigns',
    support: 'Tickets, inboxes, and agent workflows',
    recete: 'Product usage guidance, retention timing, return prevention',
  },
  {
    category: 'Trigger logic',
    campaigns: 'Marketing segments and campaign schedules',
    support: 'Inbound questions after a problem appears',
    recete: 'Post-purchase and delivery-based proactive check-ins',
  },
  {
    category: 'Product understanding',
    campaigns: 'Usually shallow or template-driven',
    support: 'Depends on human agent knowledge',
    recete: 'Knowledge-based AI (RAG) using product context',
  },
  {
    category: 'Replenishment timing',
    campaigns: 'Manual campaign setup',
    support: 'Not a core function',
    recete: 'Built into the product-usage retention workflow',
  },
  {
    category: 'Return prevention',
    campaigns: 'Indirect',
    support: 'Mostly reactive',
    recete: 'Core use case',
  },
] as const;

const pricingPlans = [
  {
    name: 'Starter',
    price: 'From EUR49',
    note: 'For early-stage Shopify brands validating retention workflows',
    desc: 'Start with post-purchase guidance and basic WhatsApp automation.',
    bullets: ['Shopify integration', 'Post-purchase check-ins', 'Core AI guidance', 'Basic reporting'],
    featured: false,
  },
  {
    name: 'Growth',
    price: 'From EUR149',
    note: 'For scaling brands that need AI coverage and ROI visibility',
    desc: 'Adds stronger AI workflows, analytics, and team controls for daily operations.',
    bullets: ['Everything in Starter', 'Advanced product-aware AI', 'ROI/retention dashboard', 'Escalation controls'],
    featured: true,
  },
  {
    name: 'Scale',
    price: 'From EUR399',
    note: 'For high-volume brands with complex operations and multiple teams',
    desc: 'Designed for larger message volume, deeper controls, and priority support.',
    bullets: ['Everything in Growth', 'Higher usage limits', 'Multi-team workflows', 'Priority support'],
    featured: false,
  },
] as const;

const faqs = [
  {
    q: 'How long does setup take?',
    a: 'Most merchants can install and connect Shopify quickly, then start with default post-purchase messaging before refining copy and timing.',
  },
  {
    q: 'Is this only for Shopify?',
    a: 'This landing page preview positions Recete as Shopify-first. The messaging is intentionally optimized for Shopify merchants and App Store readiness.',
  },
  {
    q: 'Does Recete replace Klaviyo or Gorgias?',
    a: 'No. Recete is positioned as a post-purchase retention and product-usage agent. It complements campaign and support tools rather than replacing every workflow.',
  },
  {
    q: 'Do I need WhatsApp to use it?',
    a: 'The core experience is WhatsApp-first. Channel setup requirements depend on your operational setup and provider configuration.',
  },
  {
    q: 'How does the AI know my products?',
    a: 'Recete uses your store product context and knowledge content so answers are more product-specific than generic chatbot responses.',
  },
  {
    q: 'Can it support multiple languages?',
    a: 'Yes. The product is designed to support multilingual customer conversations so customers can ask in their own language.',
  },
  {
    q: 'How does it help reduce returns?',
    a: 'By sending proactive usage guidance and answering common product questions earlier, Recete helps prevent avoidable confusion before it becomes a return request.',
  },
  {
    q: 'What happens when a customer needs a human?',
    a: 'You can position human handoff/escalation for sensitive or complex conversations. The AI should reduce repetitive workload, not remove operator control.',
  },
  {
    q: 'Is customer data secure?',
    a: 'Use high-level security and privacy messaging on the site. Avoid legal overclaims, but reassure merchants that Recete includes merchant controls and secure handling practices.',
  },
  {
    q: 'Does Recete provide medical advice for skincare?',
    a: 'No. Recete should be positioned as product-usage guidance and customer support automation, not as a medical diagnosis or prescription tool.',
  },
] as const;

function accentClasses(accent: 'emerald' | 'amber' | 'ink') {
  if (accent === 'amber') {
    return {
      shell: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-700',
      badge: 'border-amber-200 bg-amber-100 text-amber-800',
    };
  }
  if (accent === 'ink') {
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

export default function LandingV2Page() {
  return (
    <main className="min-h-screen bg-[#f5f1e5] text-[#16231d]">
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,.14),transparent_38%),radial-gradient(circle_at_90%_8%,rgba(245,158,11,.12),transparent_34%),radial-gradient(circle_at_55%_35%,rgba(10,61,46,.05),transparent_48%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#0a3d2e_1px,transparent_1px),linear-gradient(to_bottom,#0a3d2e_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f5f1e5]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/70">
              <Image src="/recete-logo.svg" alt="Recete" width={128} height={32} className="h-7 w-auto" />
            </Link>
            <span className="hidden rounded-full border border-[#0a3d2e]/10 bg-white/70 px-3 py-1 text-xs font-semibold text-[#0a3d2e] sm:inline-flex">
              V2 Landing Preview
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Landing sections">
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
              className="hidden rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#0a3d2e] shadow-sm hover:bg-[#faf9f3] sm:inline-flex"
            >
              Current Landing
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0a3d2e] px-3.5 py-2 text-sm font-semibold text-[#f8f5e6] shadow-[0_10px_30px_rgba(10,61,46,.2)] hover:bg-[#0d4a38] sm:px-4"
            >
              Install on Shopify
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:pb-16">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[1.05fr_.95fr] lg:gap-7">
          <div className="rounded-3xl border border-[#0a3d2e]/10 bg-white/80 p-5 shadow-[0_20px_60px_rgba(10,61,46,.08)] backdrop-blur sm:p-7 lg:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Shopify-only AI retention agent for cosmetic brands
            </div>

            <h1 className="mt-4 text-3xl font-extrabold leading-[1.04] tracking-tight text-[#0a3d2e] sm:text-4xl lg:text-6xl">
              They manage messages.
              <br />
              <span className="text-[#1a6e57]">Recete manages product usage.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700 sm:text-base">
              Post-purchase AI for Shopify cosmetic brands that guides customers on WhatsApp, improves product usage, and helps prevent avoidable returns.
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Recete checks in after delivery, answers product-specific questions with knowledge-based AI, tracks likely replenishment timing, and nudges repeat purchases when the moment is right.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0a3d2e] px-5 py-3.5 text-sm font-semibold text-[#f8f5e6] shadow-[0_14px_40px_rgba(10,61,46,.22)] hover:bg-[#0d4a38]"
              >
                Install on Shopify
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-5 py-3.5 text-sm font-semibold text-[#0a3d2e] hover:bg-[#faf9f3]"
              >
                Book a demo
              </Link>
            </div>

            <div className="mt-4 text-xs font-medium text-zinc-500 sm:text-sm">
              Shopify-native preview. No credit card required for signup. Placeholder pricing and example results below are clearly marked.
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                { label: 'Repeat purchase focus', value: 'Post-purchase + retention' },
                { label: 'Channel', value: 'WhatsApp-first' },
                { label: 'AI type', value: 'Product-aware (RAG)' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-black/5 bg-[#faf8f0] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{stat.label}</p>
                  <p className="mt-1 text-sm font-bold text-[#0a3d2e]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-3xl border border-black/5 bg-[#0a3d2e] p-4 text-[#f8f5e6] shadow-[0_20px_70px_rgba(10,61,46,.2)] sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#f8f5e6]/70">Agent Loop Preview</p>
                  <p className="mt-1 text-lg font-bold">Post-purchase guidance, not campaign blasts</p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">English UI copy</span>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  { t: 'T+0', msg: 'Want a quick usage guide for your new serum?' },
                  { t: 'T+3', msg: 'How is your skin reacting so far? I can adjust your routine.' },
                  { t: 'T+21', msg: 'You may be running low soon. Want a reorder reminder?' },
                ].map((item) => (
                  <div key={item.t} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-emerald-200">
                      {item.t}
                    </span>
                    <p className="text-sm leading-relaxed text-[#f8f5e6]/92">{item.msg}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_16px_50px_rgba(10,61,46,.08)]">
              <div className="flex items-center gap-2 border-b border-black/5 bg-[#faf8f0] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <div className="ml-2 truncate rounded-lg border border-black/5 bg-white px-2.5 py-1 text-xs text-zinc-500">
                  Placeholder product screenshot / dashboard preview
                </div>
              </div>
              <div className="relative bg-[#f6f4ea] p-3">
                <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
                  <Image
                    src="/dashboard-preview.png"
                    alt="Dashboard preview placeholder for Recete landing v2"
                    width={1200}
                    height={750}
                    className="h-auto w-full object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 600px"
                  />
                </div>
                <p className="px-1 pt-3 text-xs leading-relaxed text-zinc-500">
                  Replace with dedicated v2 screenshots for Shopify App Store listing (merchant dashboard, product guidance flow, ROI view).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto w-full max-w-7xl rounded-3xl border border-black/5 bg-white/85 p-4 shadow-[0_12px_40px_rgba(10,61,46,.05)] backdrop-blur sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
            <p className="text-sm font-semibold text-[#0a3d2e]">
              Trust / credibility bar (placeholder logos): Shopify-native architecture, product-aware AI, and GDPR-aligned workflow messaging.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {trustLogos.map((logo) => (
                <div
                  key={logo}
                  className="rounded-xl border border-black/5 bg-[#faf8f0] px-3 py-2 text-center text-xs font-bold tracking-[0.12em] text-zinc-500"
                >
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="problem">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[.95fr_1.05fr]">
          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_16px_50px_rgba(10,61,46,.06)] sm:p-7">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              Problem
            </p>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl">
              Cosmetic brands lose margin after checkout, not before it
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              Customers often need practical usage guidance after delivery. When they do not get it, confusion turns into poor outcomes, support tickets, and avoidable returns.
            </p>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Why this matters</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                Campaign tools are strong at sending messages. Support tools are strong at handling tickets. Neither is built specifically to manage product usage success after purchase.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {problemItems.map((item) => (
              <article key={item.title} className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_12px_36px_rgba(10,61,46,.05)]">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
                  <CircleAlert className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="mt-3 text-base font-bold tracking-tight text-[#0a3d2e]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 sm:pb-16" id="solution">
        <div className="mx-auto w-full max-w-7xl rounded-3xl border border-[#0a3d2e]/10 bg-gradient-to-br from-white to-[#f8f5e6] p-6 shadow-[0_18px_60px_rgba(10,61,46,.07)] sm:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[.95fr_1.05fr] lg:gap-8">
            <div>
              <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Solution: Recete AI Agent
              </p>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl lg:text-4xl">
                A post-purchase agent that helps customers use products correctly and come back
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-700 sm:text-base">
                Recete is not a generic chatbot widget and not a campaign builder. It is a product-usage and replenishment agent for Shopify brands that care about retention and return prevention.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { icon: MessageCircleMore, label: 'WhatsApp-first engagement' },
                  { icon: Globe2, label: 'Shopify-native operator workflow' },
                  { icon: Languages, label: 'Multilingual customer conversations' },
                  { icon: LineChart, label: 'Outcome-oriented merchant visibility' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-black/5 bg-white p-3">
                      <Icon className="h-4 w-4 text-[#0a3d2e]" aria-hidden />
                      <p className="mt-2 text-sm font-semibold text-[#0a3d2e]">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <ul className="space-y-2.5">
              {solutionItems.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-4">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
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
          <div className="mb-8 text-center sm:mb-10">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              How It Works (Agent Loop)
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl lg:text-4xl">
              Built for what happens after purchase
            </h2>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              This v2 preview uses a five-step agent loop from your document while keeping the overall Recete positioning grounded in the current product.
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute bottom-0 left-7 top-2 hidden w-px bg-gradient-to-b from-emerald-300 via-[#0a3d2e]/25 to-amber-300 md:block"
            />
            <div className="space-y-4">
              {loopSteps.map((step, index) => {
                const Icon = step.icon;
                const accent = accentClasses(step.accent);
                return (
                  <article
                    key={step.title}
                    className="grid grid-cols-1 gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-[0_12px_36px_rgba(10,61,46,.05)] md:grid-cols-[56px_1fr_320px] md:items-start md:gap-4"
                  >
                    <div className="flex items-center gap-3 md:block">
                      <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border ${accent.shell}`}>
                        <Icon className={`h-5 w-5 ${accent.icon}`} aria-hidden />
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold md:mt-2 ${accent.badge}`}>
                        Step {index + 1}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold tracking-tight text-[#0a3d2e] sm:text-lg">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.body}</p>
                    </div>

                    <div className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Example customer message</p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-700">{step.example}</p>
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
          <div className="mb-8 flex flex-col gap-3 sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
                Feature Grid (Document-Aligned)
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl lg:text-4xl">
                Product usage and retention features, not generic messaging tools
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
              Eight cards below reflect the new document structure while staying consistent with the actual Recete product positioning and current brand direction.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature, idx) => (
              <article
                key={feature.title}
                className={`group flex h-full flex-col rounded-3xl border p-5 shadow-[0_14px_40px_rgba(10,61,46,.05)] transition-transform hover:-translate-y-1 ${
                  idx % 3 === 1 ? 'border-[#0a3d2e]/10 bg-[#0a3d2e] text-[#f8f5e6]' : 'border-black/5 bg-white'
                }`}
              >
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${idx % 3 === 1 ? 'bg-white/10 text-emerald-200' : 'bg-[#f6f4ea] text-[#0a3d2e]'}`}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                </div>
                <h3 className={`mt-4 text-base font-bold tracking-tight ${idx % 3 === 1 ? 'text-[#f8f5e6]' : 'text-[#0a3d2e]'}`}>
                  {feature.title}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed ${idx % 3 === 1 ? 'text-[#f8f5e6]/80' : 'text-zinc-600'}`}>
                  {feature.desc}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  {feature.chips.map((chip) => (
                    <span
                      key={chip}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                        idx % 3 === 1 ? 'border-white/15 bg-white/5 text-[#f8f5e6]' : 'border-black/10 bg-[#faf8f0] text-zinc-700'
                      }`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="differentiation">
        <div className="mx-auto w-full max-w-7xl rounded-3xl border border-black/5 bg-white p-5 shadow-[0_16px_50px_rgba(10,61,46,.06)] sm:p-7">
          <div className="mb-6">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              Differentiation
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl">
              Campaign tools send. Helpdesks react. Recete manages product usage after purchase.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              This section is intentionally explicit so Shopify merchants can understand the category in seconds without assuming Recete is just another messaging or support tool.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="rounded-tl-2xl border border-black/5 bg-[#faf8f0] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Comparison
                  </th>
                  <th className="border border-black/5 bg-[#faf8f0] px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                    Campaign Tools (Klaviyo)
                  </th>
                  <th className="border border-black/5 bg-[#faf8f0] px-4 py-3 text-left text-sm font-semibold text-zinc-700">
                    Support Tools (Gorgias / Zendesk)
                  </th>
                  <th className="rounded-tr-2xl border border-[#0a3d2e]/15 bg-[#0a3d2e] px-4 py-3 text-left text-sm font-semibold text-[#f8f5e6]">
                    Recete (Retention Agent)
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, idx) => (
                  <tr key={row.category}>
                    <td className={`border border-black/5 px-4 py-3 text-sm font-semibold text-[#0a3d2e] ${idx === comparison.length - 1 ? 'rounded-bl-2xl' : ''}`}>
                      {row.category}
                    </td>
                    <td className="border border-black/5 px-4 py-3 text-sm text-zinc-600">{row.campaigns}</td>
                    <td className="border border-black/5 px-4 py-3 text-sm text-zinc-600">{row.support}</td>
                    <td className={`border border-[#0a3d2e]/15 bg-[#0a3d2e]/[0.03] px-4 py-3 text-sm text-zinc-700 ${idx === comparison.length - 1 ? 'rounded-br-2xl' : ''}`}>
                      {row.recete}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="case-study">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-7">
            <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Mini Case Study (Example Results)
            </p>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl">
              Example: a Shopify skincare brand improves post-purchase retention without adding headcount
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              A mid-volume cosmetic brand used Recete to guide first-time buyers after delivery, answer routine questions, and time reorder reminders around expected product usage windows.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-[#faf8f0] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Before</p>
                <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
                  <li>Inconsistent post-purchase education</li>
                  <li>Reactive support on repeat questions</li>
                  <li>Reorders driven by manual campaigns only</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">After (example)</p>
                <ul className="mt-2 space-y-1.5 text-sm text-emerald-900">
                  <li>More customers receive product usage guidance early</li>
                  <li>Support workload shifts toward real escalations</li>
                  <li>Repeat purchase nudges happen closer to need timing</li>
                </ul>
              </div>
            </div>

            <p className="mt-4 text-xs font-medium text-zinc-500">
              Disclaimer: Example results shown for landing-page positioning only. Replace with validated merchant outcomes before production launch.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Repeat purchase rate', value: '+14% (example)', tone: 'emerald' },
              { label: 'Avoidable returns', value: '-22% (example)', tone: 'amber' },
              { label: 'Repetitive support volume', value: '-31% (example)', tone: 'ink' },
            ].map((metric) => (
              <div
                key={metric.label}
                className={`rounded-3xl border p-5 shadow-[0_12px_36px_rgba(10,61,46,.05)] ${
                  metric.tone === 'emerald'
                    ? 'border-emerald-200 bg-emerald-50'
                    : metric.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-black/5 bg-white'
                }`}
              >
                <p className="text-sm font-medium text-zinc-600">{metric.label}</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#0a3d2e]">{metric.value}</p>
              </div>
            ))}
            <div className="rounded-3xl border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Positioning line options</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                <li>&ldquo;Built for Shopify cosmetic brands.&rdquo;</li>
                <li>&ldquo;No flows. No rules. Just better product usage and repeat customers.&rdquo;</li>
                <li>&ldquo;They manage messages. Recete manages product usage.&rdquo;</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="integrations">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-7">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              Integrations
            </p>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl">
              Shopify-native setup with low operational friction
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              This page is intentionally Shopify-first. Mention optional channels or stack integrations only where they support the post-purchase retention workflow clearly.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                'Shopify-native onboarding and product/order sync',
                'WhatsApp-first customer engagement for post-purchase guidance',
                'No-code / low-code setup messaging for operator confidence',
                'Optional references to email/SMS only as complementary channels (if supported)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-zinc-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_14px_46px_rgba(10,61,46,.06)] sm:p-7">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              Security & Privacy (High-Level)
            </p>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl">
              Reassure merchants without legal overclaiming
            </h2>
            <div className="mt-4 space-y-3">
              {[
                {
                  title: 'Merchant controls and access boundaries',
                  body: 'Explain that merchant-level controls and secure operational practices are part of the product experience without turning this section into legal documentation.',
                },
                {
                  title: 'GDPR-aligned workflow messaging',
                  body: 'Use wording like “designed to support GDPR-aligned workflows” instead of absolute legal guarantees unless reviewed by counsel.',
                },
                {
                  title: 'Uninstall / data handling (high-level)',
                  body: 'Mention that merchants can remove the app and follow documented data handling practices, while keeping legal specifics in policy pages.',
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
          <div className="mb-8 text-center sm:mb-10">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              Pricing
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl lg:text-4xl">
              Start lean. Upgrade when retention volume grows.
            </h2>
            <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Placeholder pricing for preview purposes. Structure focuses on value progression by operational complexity and message volume, not random feature inflation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-3xl border p-5 shadow-[0_16px_46px_rgba(10,61,46,.06)] sm:p-6 ${
                  plan.featured
                    ? 'border-[#0a3d2e]/20 bg-[#0a3d2e] text-[#f8f5e6]'
                    : 'border-black/5 bg-white'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-2 left-5 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-[#0a3d2e]">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-lg font-bold tracking-tight ${plan.featured ? 'text-[#f8f5e6]' : 'text-[#0a3d2e]'}`}>
                  {plan.name}
                </h3>
                <p className={`mt-1 text-sm ${plan.featured ? 'text-[#f8f5e6]/78' : 'text-zinc-600'}`}>{plan.desc}</p>

                <div className="mt-5">
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-extrabold tracking-tight ${plan.featured ? 'text-white' : 'text-[#0a3d2e]'}`}>
                      {plan.price}
                    </span>
                    <span className={`mb-1 text-sm ${plan.featured ? 'text-[#f8f5e6]/78' : 'text-zinc-500'}`}>/ month</span>
                  </div>
                  <p className={`mt-1 text-xs ${plan.featured ? 'text-[#f8f5e6]/72' : 'text-zinc-500'}`}>{plan.note}</p>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          plan.featured ? 'border-white/15 bg-white/10' : 'border-emerald-200 bg-emerald-50'
                        }`}
                      >
                        <Check className={`h-3 w-3 ${plan.featured ? 'text-emerald-200' : 'text-emerald-700'}`} aria-hidden />
                      </span>
                      <span className={plan.featured ? 'text-[#f8f5e6]/90' : 'text-zinc-700'}>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-auto inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    plan.featured
                      ? 'mt-6 bg-white text-[#0a3d2e] hover:bg-[#f8f5e6]'
                      : 'mt-6 border border-black/10 bg-[#faf8f0] text-[#0a3d2e] hover:bg-white'
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
                ROI note: many merchants can justify the subscription by preventing a small number of avoidable returns each month (illustrative, validate with real data).
              </p>
              <a href="#case-study" className="text-sm font-semibold text-emerald-800 hover:text-emerald-900">
                Estimate your ROI
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16" id="faq">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-7 text-center sm:mb-8">
            <p className="inline-flex rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
              FAQ
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0a3d2e] sm:text-3xl lg:text-4xl">
              Common questions from Shopify brands evaluating Recete
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Expanded FAQ for the v2 landing preview (document requested 8-12 questions). Production copy should be validated against actual onboarding and channel setup details.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_14px_46px_rgba(10,61,46,.05)]">
            {faqs.map((item) => (
              <details key={item.q} className="group border-b border-black/5 p-4 last:border-b-0 sm:p-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <span className="text-sm font-semibold text-[#0a3d2e] sm:text-base">{item.q}</span>
                  <span className="text-xl leading-none text-zinc-400 transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="pr-6 pt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 sm:pb-16" id="final-cta">
        <div className="mx-auto w-full max-w-7xl rounded-[2rem] border border-[#0a3d2e]/10 bg-[#0a3d2e] p-6 text-[#f8f5e6] shadow-[0_24px_80px_rgba(10,61,46,.2)] sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-emerald-200">
                Final CTA
              </p>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                Reduce avoidable returns by improving product usage after checkout
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#f8f5e6]/82 sm:text-base">
                Recete helps Shopify brands deliver practical product guidance on WhatsApp, answer post-purchase questions with product-aware AI, and create better timing for repeat purchases.
              </p>
              <p className="mt-3 text-xs font-medium text-[#f8f5e6]/70 sm:text-sm">
                Trust microcopy: Shopify-first positioning, calm operator-focused messaging, and placeholder metrics clearly labeled until validated.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-[#0a3d2e] hover:bg-[#f8f5e6]"
              >
                Install on Shopify
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-[#f8f5e6] hover:bg-white/10"
              >
                Book a demo
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-transparent px-5 py-3.5 text-sm font-semibold text-[#f8f5e6]/90 hover:bg-white/5"
              >
                View current landing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 rounded-3xl border border-black/5 bg-white p-5 shadow-[0_12px_40px_rgba(10,61,46,.05)] sm:grid-cols-[1.2fr_.8fr_.8fr_.8fr] sm:p-7">
          <div>
            <Image src="/recete-logo.svg" alt="Recete" width={140} height={34} className="h-8 w-auto" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600">
              Post-purchase AI for Shopify merchants that improves product usage, supports retention, and helps reduce avoidable returns through WhatsApp-first guidance.
            </p>
            <p className="mt-3 text-xs font-medium text-zinc-500">V2 preview route created from your landing document. Existing landing page is preserved.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#0a3d2e]">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><a href="#features" className="hover:text-zinc-900">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-zinc-900">How It Works</a></li>
              <li><a href="#pricing" className="hover:text-zinc-900">Pricing</a></li>
              <li><a href="#faq" className="hover:text-zinc-900">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#0a3d2e]">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li><Link href="/signup" className="hover:text-zinc-900">Book a Demo</Link></li>
              <li><Link href="/signup" className="hover:text-zinc-900">Contact</Link></li>
              <li><Link href="/signup" className="hover:text-zinc-900">About</Link></li>
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
          <p>Recete Landing v2 Preview. All rights reserved. Built for Shopify.</p>
          <p>Current production landing remains available at the root locale path.</p>
        </div>
      </footer>
    </main>
  );
}
