'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Link } from '@/i18n/routing';

// ─── Icon atoms ────────────────────────────────────────
type IconName = 'arrow' | 'chat' | 'sparkle' | 'chart' | 'refresh' | 'bolt' | 'shield' | 'sun' | 'moon' | 'check';
const PATHS: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  check: <path d="M4 8l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  sparkle: <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  chat: <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H8l-4 3v-3H5a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  chart: <path d="M3 14V8M8 14V4M13 14v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
  bolt: <path d="M10 2L4 10h4l-1 6 6-8H9l1-6z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  shield: <path d="M10 2L3 5v5c0 4 3.5 7 7 8 3.5-1 7-4 7-8V5l-7-3z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  refresh: <><path d="M3 10a7 7 0 0112-5l2 2M17 10a7 7 0 01-12 5l-2-2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/><path d="M17 3v4h-4M3 17v-4h4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  sun: <><circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.5 4.5l-1.5 1.5M6 14l-1.5 1.5M15.5 15.5L14 14M6 6L4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></>,
  moon: <path d="M16 11.5A6 6 0 1 1 8.5 4a5 5 0 0 0 7.5 7.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
};
const Icon = ({ name, size = 16 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    {PATHS[name]}
  </svg>
);

const SectionMeta = ({ children }: { children: React.ReactNode }) => (
  <div className="lsection-meta">{children}</div>
);

// ─── NavBar ─────────────────────────────────────────────
const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#demo', label: 'Demo' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#roi', label: 'ROI' },
  { href: '#faq', label: 'FAQ' },
];

function NavBar({ theme, onToggleTheme }: { theme: string; onToggleTheme: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="lnav">
      <div className="lcontainer lnav-inner">
        <div className="lnav-logo">
          <div className="lnav-logo-mark">R</div>
          <span>Recete</span>
          <span className="lnav-logo-tag">retention agent</span>
        </div>
        <nav className="lnav-links">
          {NAV_LINKS.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="lnav-cta">
          <button className="lbtn lbtn-ghost lnav-theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme" style={{ width: 36 }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>
          <Link href="/login" className="lbtn lbtn-ghost lnav-login">Login</Link>
          <Link href="/signup" className="lbtn lbtn-primary lnav-cta-signup">
            Start free <Icon name="arrow" size={13} />
          </Link>
          {/* Hamburger — mobile only */}
          <button
            className="lnav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="lnav-mobile-menu">
          <div className="lnav-mobile-links">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
            ))}
          </div>
          <div className="lnav-mobile-actions">
            <Link href="/login" className="lbtn lbtn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={close}>Login</Link>
            <Link href="/signup" className="lbtn lbtn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={close}>
              Start free <Icon name="arrow" size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────
const HERO_SCRIPT = [
  { side: 'in', text: "Hi! My new ceramic pan is sticking — am I doing something wrong?", time: "10:42" },
  { side: 'out', text: "Hey Lena 👋 happy to help. Quick check: are you pre-heating on medium or high?", time: "10:42", tick: true },
  { side: 'in', text: "Usually high — that's how I did my old non-stick.", time: "10:43" },
  { side: 'out', img: "product guide · seasoning", text: "Ceramic likes a slow warmup — try medium for 90s, then add fat. Here's the 30s guide.", time: "10:43", tick: true },
  { side: 'in', text: "Oh! Trying now. Thanks 🙏", time: "10:44" },
  { side: 'out', text: "I'll check back tomorrow. If it still sticks I'll send a replacement, no questions.", time: "10:44", tick: true },
];

function TypingDots() {
  return <div className="lwa-typing"><span /><span /><span /></div>;
}

function Bubble({ b }: { b: typeof HERO_SCRIPT[number] }) {
  return (
    <div className={`lwa-bubble ${b.side}`}>
      {b.img && <div className="lwa-img">[ {b.img} ]</div>}
      {b.text}
      <span className="lwa-time">{b.time}{b.side === 'out' && <span className="lwa-tick"> ✓✓</span>}</span>
    </div>
  );
}

function HeroPhone() {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown >= HERO_SCRIPT.length) {
      const t = setTimeout(() => setShown(0), 3500);
      return () => clearTimeout(t);
    }
    const next = HERO_SCRIPT[shown];
    if (next.side === 'out') {
      setTyping(true);
      const t = setTimeout(() => { setTyping(false); setShown(s => s + 1); }, 1100);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setShown(s => s + 1), 900);
      return () => clearTimeout(t);
    }
  }, [shown]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [shown, typing]);

  return (
    <div className="lphone-wrap">
      <div className="lphone-tag" style={{ top: 50, left: -20 }}>
        <span className="ltdot" />order #4821 · day 2
      </div>
      <div className="lphone-tag" style={{ top: 200, right: -40 }}>
        <span className="ltdot" />intent: usage_question
      </div>
      <div className="lphone-tag" style={{ bottom: 70, left: -30 }}>
        <span className="ltdot" />return prevented · +£84
      </div>
      <div className="lphone">
        <div className="lphone-screen">
          <div className="lwa-header">
            <span style={{ fontSize: 18, opacity: 0.9 }}>‹</span>
            <div className="lwa-avatar">R</div>
            <div className="lwa-meta">
              <div className="lwa-name">Recete · Olive & Oak</div>
              <div className="lwa-status">online · usually replies instantly</div>
            </div>
          </div>
          <div className="lwa-body" ref={scrollRef}>
            <div className="lwa-day">TODAY</div>
            {HERO_SCRIPT.slice(0, shown).map((b, i) => <Bubble key={i} b={b} />)}
            {typing && <TypingDots />}
          </div>
          <div className="lwa-footer">
            <div className="lwa-input">Message</div>
            <div className="lwa-send">➤</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="lsection lhero-section" style={{ borderBottom: 'none', overflow: 'visible' }}>
      <div className="lcontainer lhero-grid">
        <div>
          <div className="leyebrow">
            <span className="ldot" />
            <span>WhatsApp · Post-purchase AI</span>
          </div>
          <h1 className="lh-display" style={{ marginTop: 24 }}>
            The retention agent <span className="em">that pays for itself</span> by stopping returns before they happen.
          </h1>
          <p style={{ marginTop: 22, fontSize: 17, color: 'var(--link-2)', maxWidth: 480, lineHeight: 1.55 }}>
            Recete is an AI assistant that lives on WhatsApp. It uses your product knowledge to answer
            questions, send guides, and resolve issues — automatically, before they become support tickets or refunds.
          </p>
          <div className="lhero-cta" style={{ marginTop: 32, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/signup" className="lbtn lbtn-primary lbtn-lg">
              Start free <Icon name="arrow" size={13} />
            </Link>
            <a href="#demo" className="lbtn lbtn-outline lbtn-lg">See it work</a>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--link-3)', fontFamily: 'var(--font-mono, monospace)' }}>
            No credit card · 14-day trial · 15-min setup
          </div>
          <div style={{ marginTop: 36, display: 'flex', gap: 32, fontSize: 12, color: 'var(--link-3)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.02em', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--link)', fontSize: 13, fontWeight: 500 }}>−32%</span> avg. returns
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--link)', fontSize: 13, fontWeight: 500 }}>94%</span> CSAT
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--link)', fontSize: 13, fontWeight: 500 }}>2.1×</span> faster replies
            </span>
          </div>
        </div>
        <div className="lhero-phone">
          <HeroPhone />
        </div>
      </div>
    </section>
  );
}

// ─── ProofBar ────────────────────────────────────────────
const PROOF_LOGOS = [
  'olive & oak', 'Maren', 'FORM&CO.', 'tigris', 'north drift', 'aura.'
];

function ProofBar() {
  return (
    <section className="lproof-section" style={{ borderBottom: '1px solid var(--lline)', borderTop: '1px solid var(--lline)' }}>
      <div className="lcontainer lproof-inner">
        <div className="lproof-label" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--link-3)', maxWidth: 180, lineHeight: 1.4 }}>
          Trusted by Shopify stores across the UK & EU
        </div>
        <div className="lproof-logos">
          {PROOF_LOGOS.map(name => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 22, color: 'var(--link-3)', fontWeight: 600, fontSize: 15, opacity: 0.7, whiteSpace: 'nowrap', letterSpacing: '-0.01em', cursor: 'default', transition: 'opacity 140ms' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ───────────────────────────────────────────
const FEATURES = [
  { icon: 'chat' as IconName, title: 'Post-purchase WhatsApp engagement', body: 'Personalized messages at the moments that matter — welcome, usage tips, check-ins, win-backs. Configured once, sent forever.', tags: ['T+0 welcome', 'T+3 usage', 'T+14 feedback'] },
  { icon: 'sparkle' as IconName, title: 'AI conversations grounded in your product', body: 'Trained on your product manuals, FAQs, and policy docs. Handles complaints, guides usage, and prevents returns — with a human handoff when it matters.', tags: ['RAG pipeline', 'Intent detection', 'Human handoff'] },
  { icon: 'chart' as IconName, title: 'ROI dashboard, not vanity metrics', body: 'Saved returns, repeat purchases, sentiment, RFM cohorts. See exactly how many pounds your retention is generating — every week.', tags: ['ROI tracking', 'Sentiment', 'RFM cohorts'] },
  { icon: 'refresh' as IconName, title: 'Real-time order sync', body: 'Every order, refund and product update flows in through webhooks. The right message goes out at the right moment — no spreadsheets.', tags: ['Webhooks', 'Instant triggers', 'Bi-directional sync'] },
  { icon: 'bolt' as IconName, title: 'One-click install', body: 'Install from the Shopify App Store and connect your number in under fifteen minutes. Templates ready out of the box, zero coding required.', tags: ['App Store', 'Templated flows', 'API access'] },
  { icon: 'shield' as IconName, title: 'Enterprise-grade security', body: 'End-to-end encryption, merchant-level access controls, GDPR-aligned workflows, and a signed DPA on every plan. Customer data stays your data.', tags: ['GDPR', 'Encrypted at rest', 'SSO ready'] },
];

function Features() {
  return (
    <section id="features" className="lsection">
      <div className="lcontainer">
        <div className="lsection-head">
          <div>
            <SectionMeta>Features</SectionMeta>
            <h2 className="lh-section">Everything you need to turn one-time buyers into <span className="em">repeat customers.</span></h2>
          </div>
          <p className="llead">Six modules — one calm dashboard. Pick the workflows you need, leave the rest off. No feature creep, no agency required.</p>
        </div>
        <div className="lfeatures-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="lfeature">
              <div className="lfeature-icon"><Icon name={f.icon} size={18} /></div>
              <h3 style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.015em', margin: 0 }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--link-3)', flex: 1 }}>{f.body}</p>
              <div className="lfeature-tags">
                {f.tags.map(t => <span key={t} className="lfeature-tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Demo ───────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'return',
    title: 'Customer wants a return',
    desc: 'Stick-test on a ceramic pan. Recete diagnoses, sends the guide, prevents the refund.',
    script: [
      { side: 'in', text: "Hi — the pan you sent is sticking already. Can I return it?", time: "10:42" },
      { side: 'out', text: "Hey Lena, sorry to hear that. Ceramic just needs a different warm-up — can I send you a 30s clip?", time: "10:42", tick: true },
      { side: 'in', text: "Sure", time: "10:43" },
      { side: 'out', img: "video · seasoning your pan", text: "Heat on medium 90s, swirl 1 tsp of oil, then cook. If it still sticks tomorrow I'll send a replacement, no questions.", time: "10:43", tick: true },
      { side: 'in', text: "Trying now 🙏", time: "10:43" },
    ],
  },
  {
    id: 'reorder',
    title: 'Time to reorder',
    desc: 'Coffee runs out around day 28. Recete checks in, offers a one-tap reorder link.',
    script: [
      { side: 'out', text: "Morning Mark — by our maths, you're on your last 4 cups of the Ethiopia Guji ☕", time: "08:15", tick: true },
      { side: 'out', text: "Want me to queue another bag for Friday delivery? Same as last time, free shipping.", time: "08:15", tick: true },
      { side: 'in', text: "Yes please. Make it 2?", time: "08:31" },
      { side: 'out', text: "Done. 2 × Guji on the way Friday. Confirmation just sent.", time: "08:31", tick: true },
      { side: 'in', text: "Brilliant.", time: "08:32" },
    ],
  },
  {
    id: 'review',
    title: 'Day-14 check-in & review',
    desc: 'Genuine feedback request with a one-tap path to either review or escalate.',
    script: [
      { side: 'out', text: "Hi Selin — quick check-in. Two weeks in with the moisturiser, how's your skin feeling?", time: "19:04", tick: true },
      { side: 'in', text: "Genuinely good. Less dryness.", time: "19:11" },
      { side: 'out', text: "Love that. Would you share a quick word so others know? One tap →", time: "19:11", tick: true },
      { side: 'in', img: "review submitted · 5★", text: "Done!", time: "19:13" },
      { side: 'out', text: "Thank you 🙏 enjoy a 10% code for next time: SELIN10", time: "19:13", tick: true },
    ],
  },
];

type ScriptLine = { side: string; text: string; time: string; tick?: boolean; img?: string };

function DemoPhone({ scenario }: { scenario: typeof SCENARIOS[number] }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setShown(0); }, [scenario.id]);

  useEffect(() => {
    if (shown >= scenario.script.length) return;
    const t = setTimeout(() => setShown(s => s + 1), 750);
    return () => clearTimeout(t);
  }, [shown, scenario.id]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [shown]);

  return (
    <div className="lphone-wrap">
      <div className="lphone">
        <div className="lphone-screen">
          <div className="lwa-header">
            <span style={{ fontSize: 18, opacity: 0.9 }}>‹</span>
            <div className="lwa-avatar">R</div>
            <div className="lwa-meta">
              <div className="lwa-name">Recete · Demo</div>
              <div className="lwa-status">live preview</div>
            </div>
          </div>
          <div className="lwa-body" ref={ref}>
            <div className="lwa-day">TODAY</div>
            {(scenario.script.slice(0, shown) as ScriptLine[]).map((b, i) => (
              <div key={i} className={`lwa-bubble ${b.side}`}>
                {b.img && <div className="lwa-img">[ {b.img} ]</div>}
                {b.text}
                <span className="lwa-time">{b.time}{b.tick && <span className="lwa-tick"> ✓✓</span>}</span>
              </div>
            ))}
          </div>
          <div className="lwa-footer">
            <div className="lwa-input">Message</div>
            <div className="lwa-send">➤</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Demo() {
  const [active, setActive] = useState(0);
  return (
    <section id="demo" className="lsection">
      <div className="lcontainer">
        <SectionMeta>Live demo</SectionMeta>
        <div className="ldemo-grid">
          <div className="ldemo-left">
            <h2 className="lh-section">Three conversations <span className="em">your team doesn't have to have.</span></h2>
            <p className="llead" style={{ marginTop: 16 }}>
              Each one represents a real moment in the post-purchase journey — and a real margin point that Recete is protecting.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 32 }}>
              {SCENARIOS.map((s, i) => (
                <button key={s.id} className={`ldemo-scenario${active === i ? ' active' : ''}`} onClick={() => setActive(i)}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)', paddingTop: 2, minWidth: 24 }}>0{i + 1}</span>
                  <span>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--link)', textAlign: 'left' }}>{s.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--link-3)', marginTop: 2, lineHeight: 1.45, textAlign: 'left' }}>{s.desc}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="ldemo-phone" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <DemoPhone scenario={SCENARIOS[active]} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── HowItWorks ─────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" className="lsection">
      <div className="lcontainer">
        <div className="lsection-head lsection-head-nb">
          <div>
            <SectionMeta>How it works</SectionMeta>
            <h2 className="lh-section">Live in fifteen minutes. <span className="em">No agency, no engineer.</span></h2>
          </div>
          <p className="llead">You install the Shopify app, point it at your knowledge base, and Recete handles the rest. Most merchants do it during a coffee break.</p>
        </div>
        <div className="lhowit">
          <div className="lhow-step">
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)', marginBottom: 14, letterSpacing: '0.04em' }}>01 · CONNECT</div>
            <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Install from the Shopify App Store</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--link-3)', lineHeight: 1.55, maxWidth: 320 }}>One click. We pull your product catalog, orders, and customers via the official Shopify API. Your store keeps running.</p>
            <div className="lhow-visual" style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'var(--link-3)' }}>$ shopify install recete</div>
              <div style={{ color: 'var(--laccent-ink)' }}>→ catalog · 248 SKUs synced</div>
              <div style={{ color: 'var(--laccent-ink)' }}>→ orders · 6,402 backfilled</div>
              <div style={{ color: 'var(--laccent-ink)' }}>→ webhooks · 12 active</div>
            </div>
          </div>
          <div className="lhow-step">
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)', marginBottom: 14, letterSpacing: '0.04em' }}>02 · TEACH</div>
            <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Feed it your product knowledge</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--link-3)', lineHeight: 1.55, maxWidth: 320 }}>Drop in product guides, FAQs, return policy, tone-of-voice notes. Recete turns them into a retrieval index your agent answers from.</p>
            <div className="lhow-visual" style={{ display: 'grid', gap: 8 }}>
              <div>seasoning-guide.pdf <span style={{ color: 'var(--laccent-ink)' }}>· indexed</span></div>
              <div>warranty-policy.md <span style={{ color: 'var(--laccent-ink)' }}>· indexed</span></div>
              <div>brand-voice.txt <span style={{ color: 'var(--laccent-ink)' }}>· indexed</span></div>
              <div style={{ color: 'var(--link-3)' }}>+ 14 more files</div>
            </div>
          </div>
          <div className="lhow-step">
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)', marginBottom: 14, letterSpacing: '0.04em' }}>03 · MEASURE</div>
            <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Watch your retention dashboard climb</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--link-3)', lineHeight: 1.55, maxWidth: 320 }}>Each saved return and reorder shows up as pounds. Weekly digests, no log-in required. Cancel any time — fair-use first.</p>
            <div className="lhow-visual" style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>returns saved</span><span style={{ color: 'var(--laccent-ink)' }}>£4,820</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>repeat purchases</span><span style={{ color: 'var(--laccent-ink)' }}>£11,310</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>support hours saved</span><span style={{ color: 'var(--laccent-ink)' }}>62h</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--lline)' }}><span>net ROI · 30d</span><span style={{ fontWeight: 600 }}>9.2×</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ───────────────────────────────────────
const TESTIMONIALS = [
  { quote: "We reduced avoidable returns by sending usage guidance before customers got frustrated. Setup took less than one afternoon.", author: "Ece Demir", role: "Founder · skincare brand", metric: "−28% returns" },
  { quote: "Our support team now spends time on real escalations. Recete handles the repetitive post-purchase questions automatically, in our tone.", author: "Mark Jensen", role: "Ops lead · DTC home goods", metric: "2.1× faster replies" },
  { quote: "The analytics view made it easy to justify the spend. We can see saved returns and repeat conversations turning into actual revenue.", author: "Selin Kaya", role: "E-commerce manager · wellness", metric: "+14% repeat sales" },
];

function Testimonials() {
  return (
    <section id="testimonials" className="lsection">
      <div className="lcontainer">
        <SectionMeta>Trusted by growth teams</SectionMeta>
        <h2 className="lh-section">Merchants use Recete to protect margin <span className="em">after checkout.</span></h2>
        <div className="ltest-grid ltest-grid-mt">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="ltest">
              <div style={{ fontSize: 16.5, lineHeight: 1.5, color: 'var(--link)', letterSpacing: '-0.005em', flex: 1 }}>"{t.quote}"</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--lline)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.author}</div>
                  <div style={{ fontSize: 12, color: 'var(--link-3)' }}>{t.role}</div>
                </div>
                <div className="ltest-metric">{t.metric}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────
const PLANS = [
  { name: 'Starter', desc: 'For lean teams validating post-purchase support and retention.', monthly: 29, annual: 290, featured: false, features: ['150 included chats / month', '20 recipes', '$0.18 per overage chat', 'Shared Recete WhatsApp number', 'Basic analytics'], cta: 'Start free' },
  { name: 'Growth', desc: 'For growing merchants that need AI vision and stronger workflows.', monthly: 69, annual: 690, featured: true, features: ['1,000 included chats / month', '500 recipes', '$0.12 per overage chat', 'Customer photo analysis', 'Shared Recete WhatsApp number'], cta: 'Start free' },
  { name: 'Pro', desc: 'For higher-volume brands that want a branded WhatsApp and deeper analytics.', monthly: 169, annual: 1690, featured: false, features: ['3,000 included chats / month', 'Unlimited recipes', '$0.08 per overage chat', 'Smart Re-order', 'Advanced analytics + custom number'], cta: 'Talk to sales' },
];

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="lsection">
      <div className="lcontainer">
        <div className="lsection-head lsection-head-nb">
          <div>
            <SectionMeta>Pricing</SectionMeta>
            <h2 className="lh-section">Simple, transparent pricing. <span className="em">No hidden fees.</span></h2>
          </div>
          <div>
            <div className="lprice-toggle">
              <button className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>Monthly</button>
              <button className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>
                Annual <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10.5px', color: 'var(--laccent-ink)', marginLeft: 4 }}>save 2mo</span>
              </button>
            </div>
          </div>
        </div>
        <div className="lprice-grid">
          {PLANS.map(p => (
            <div key={p.name} className={`lprice-col${p.featured ? ' featured' : ''}`} style={p.featured ? { position: 'relative' } : undefined}>
              {p.featured && (
                <div style={{ position: 'absolute', top: 18, right: 18, fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'var(--laccent-ink)', background: 'var(--laccent-soft)', padding: '3px 8px', borderRadius: 999, letterSpacing: '0.03em' }}>Most popular</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.02em', color: 'var(--link-3)', textTransform: 'uppercase' }}>{p.name}</div>
              <div style={{ fontSize: 13, color: 'var(--link-3)', lineHeight: 1.5, minHeight: 38 }}>{p.desc}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>${yearly ? p.annual : p.monthly}</span>
                <span style={{ fontSize: 13, color: 'var(--link-3)' }}>/ {yearly ? 'year' : 'month'}</span>
              </div>
              <ul className="lprice-features">
                {p.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              <Link href={p.cta === 'Talk to sales' ? '/contact' : '/signup'} className={`lbtn ${p.featured ? 'lbtn-primary' : 'lbtn-outline'}`} style={{ marginTop: 8 }}>
                {p.cta} <Icon name="arrow" size={13} />
              </Link>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--link-3)', textAlign: 'center' }}>
          Most merchants recover plan cost by preventing just <strong style={{ color: 'var(--link)' }}>three returns</strong> per month.
          All plans include unlimited team seats, a signed DPA, and email support.
        </p>
      </div>
    </section>
  );
}

// ─── ROI Calculator ──────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

function ROICalc() {
  const [orders, setOrders] = useState(800);
  const [aov, setAov] = useState(75);
  const [returnRate, setReturnRate] = useState(15);

  const baseReturns = orders * (returnRate / 100);
  const savedReturnRevenue = baseReturns * 0.32 * aov;
  const repeatLift = orders * 0.14 * aov * 0.35;
  const supportSavings = (orders * 0.12 * 0.65 * 7 / 60) * 38;
  const total = savedReturnRevenue + repeatLift + supportSavings;
  const roi = total / 69;

  return (
    <section id="roi" className="lsection">
      <div className="lcontainer">
        <div className="lsection-head lsection-head-nb">
          <div>
            <SectionMeta>ROI calculator</SectionMeta>
            <h2 className="lh-section">Run your numbers. <span className="em">It's not a leap of faith.</span></h2>
          </div>
          <p className="llead">Estimates use averages from active merchants. Most stores recover cost in week one.</p>
        </div>
        <div className="lroi-grid" style={{ border: '1px solid var(--lline)', borderRadius: 14, background: 'var(--lbg)', overflow: 'hidden' }}>
          <div className="lroi-panel" style={{ padding: 36, borderRight: '1px solid var(--lline)', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {[
              { label: 'Monthly orders', val: fmt(orders), min: 100, max: 10000, step: 50, value: orders, set: setOrders, unit: '' },
              { label: 'Average order value', val: `£${aov}`, min: 15, max: 400, step: 5, value: aov, set: setAov, unit: '' },
              { label: 'Current return rate', val: `${returnRate}%`, min: 2, max: 40, step: 1, value: returnRate, set: setReturnRate, unit: '' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--link-2)' }}>
                  {f.label}
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: 'var(--link)', background: 'var(--lbg-elev)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--lline)' }}>{f.val}</span>
                </label>
                <input className="lroi-slider" type="range" min={f.min} max={f.max} step={f.step} value={f.value} onChange={e => f.set(+e.target.value)} />
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--link-3)', lineHeight: 1.55, fontFamily: 'var(--font-mono, monospace)' }}>
              Assumptions: 32% return reduction · 14% repeat lift on 35% margin · 65% of post-purchase tickets handled automatically at 7min each.
            </div>
          </div>
          <div className="lroi-panel" style={{ padding: 36, background: 'var(--lbg-elev)', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Estimated monthly recovery</div>
            <div className="lroi-result">
              <span style={{ fontSize: 28, color: 'var(--link-3)', marginRight: 2, fontWeight: 400 }}>£</span>{fmt(total)}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--link-2)', lineHeight: 1.5 }}>
              That's a <strong style={{ color: 'var(--link)' }}>{roi.toFixed(1)}× return</strong> on the Growth plan at £69/mo, before counting brand equity or NPS lift.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, borderTop: '1px solid var(--lline)', paddingTop: 18 }}>
              {[
                { k: 'saved returns', v: `£${fmt(savedReturnRevenue)}` },
                { k: 'repeat-purchase lift', v: `£${fmt(repeatLift)}` },
                { k: 'support hours saved', v: `£${fmt(supportSavings)}` },
                { k: 'monthly total', v: `£${fmt(total)}`, bold: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, ...(row.bold ? { paddingTop: 8, borderTop: '1px solid var(--lline)', fontWeight: 500 } : {}) }}>
                  <span style={{ color: 'var(--link-3)' }}>{row.k}</span>
                  <span style={{ color: 'var(--link)' }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────
const FAQS = [
  { q: 'How long does setup take?', a: "Most merchants connect Shopify and configure their first flows in under fifteen minutes. You start with default templates — proven across hundreds of stores — and refine them as you learn what works for your customers." },
  { q: 'Do I need a support team to use Recete?', a: "No. Recete is designed to reduce the manual support workload of a small team, not assume you have one. You can still enable human handoff for escalations or sensitive conversations." },
  { q: 'How exactly does Recete reduce returns?', a: "By sending proactive, timely WhatsApp messages with usage guidance and follow-ups that answer common questions before they become return requests. Most returns aren't about defective products — they're about confused customers." },
  { q: 'Is customer data secure and GDPR-compliant?', a: "Yes. We use end-to-end encrypted transport, merchant-level access controls, and GDPR-aligned data workflows. Every plan ships with a signed DPA. Customers can opt out at any time with a single reply." },
  { q: 'Can I use my own WhatsApp Business number?', a: "Yes — on the Pro plan you can connect your branded WhatsApp Business API number. Starter and Growth use a shared Recete number, which is faster to launch." },
  { q: 'Which languages does the AI support?', a: "Out of the box: English, Spanish, French, German, Italian, Turkish, Dutch, Portuguese. The AI replies in the customer's preferred language automatically based on detected locale." },
];

function FAQ() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="lsection">
      <div className="lcontainer">
        <SectionMeta>FAQ</SectionMeta>
        <div className="lfaq-grid">
          <div>
            <h2 className="lh-section" style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}>Common questions from merchants.</h2>
            <p style={{ fontSize: 14, color: 'var(--link-3)', marginTop: 16, maxWidth: 320 }}>
              Can't find what you're looking for?{' '}
              <a href="mailto:hello@recete.co.uk" style={{ color: 'var(--link)', textDecoration: 'underline', textUnderlineOffset: 3 }}>hello@recete.co.uk</a>
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--lline)' }}>
            {FAQS.map((f, i) => (
              <div key={i} className={`lfaq-item${open === i ? ' open' : ''}`}>
                <button className="lfaq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{f.q}</span>
                  <span className="lfaq-icon">+</span>
                </button>
                <div className="lfaq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ───────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="lfinalcta" style={{ textAlign: 'center', position: 'relative' }}>
      <div className="lcontainer" style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div className="leyebrow"><span className="ldot" /><span>Post-purchase AI · WhatsApp</span></div>
        <h2 className="lcta-title" style={{ fontSize: 'clamp(36px, 5vw, 52px)', letterSpacing: '-0.035em', lineHeight: 1.05, fontWeight: 500, margin: 0 }}>
          Stop losing margin <span className="em">after checkout.</span>
        </h2>
        <p className="llead" style={{ textAlign: 'center' }}>
          Install Recete in fifteen minutes and start protecting every order you've worked so hard to win. Cancel any time — fair-use first.
        </p>
        <div className="lfinalcta-btns" style={{ marginTop: 8 }}>
          <Link href="/signup" className="lbtn lbtn-primary lbtn-lg">
            Start free <Icon name="arrow" size={13} />
          </Link>
          <Link href="/contact" className="lbtn lbtn-outline lbtn-lg">Contact us</Link>
        </div>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)', marginTop: 4 }}>No credit card · 14-day free trial</div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="lfooter-wrap" style={{ borderTop: '1px solid var(--lline)', background: 'var(--lbg)' }}>
      <div className="lcontainer">
        <div className="lfooter-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="lnav-logo-mark">R</div>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Recete</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--link-3)', maxWidth: 280, margin: '12px 0 0', lineHeight: 1.55 }}>
              Post-purchase AI on WhatsApp. We help e-commerce merchants reduce returns, boost repeat purchases, and protect margin after checkout.
            </p>
            <div style={{ marginTop: 20, fontSize: 12, color: 'var(--link-3)', fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.6 }}>
              RECETE LTD · Co. № 17082027<br />
              71-75 Shelton Street, London WC2H 9JQ<br />
              <a href="mailto:hello@recete.co.uk" style={{ color: 'inherit' }}>hello@recete.co.uk</a> · +44 7915 922506
            </div>
          </div>
          <div className="lfooter-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#how-it-works">How it works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#demo">Demo</a></li>
              <li><a href="#roi">ROI calculator</a></li>
            </ul>
          </div>
          <div className="lfooter-col">
            <h4>Company</h4>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="lfooter-col">
            <h4>Legal</h4>
            <ul>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/cookie-policy">Cookies</Link></li>
              <li><Link href="/data-processing-addendum">DPA</Link></li>
              <li><Link href="/security">Security</Link></li>
            </ul>
          </div>
        </div>
        <div className="lfooter-bottom" style={{ paddingTop: 24, borderTop: '1px solid var(--lline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--link-3)' }}>
          <div>© 2026 Recete Ltd — built for e-commerce in London.</div>
          <div className="lfooter-badges" style={{ display: 'flex', gap: 12 }}>
            {['GDPR', 'Shopify Partner', 'Status · all systems'].map(b => (
              <span key={b} style={{ border: '1px solid var(--lline)', padding: '4px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'var(--laccent)', borderRadius: 999, display: 'inline-block' }} />
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main LandingPage ────────────────────────────────────
export function LandingPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="landing" data-theme={theme}>
      <NavBar theme={theme} onToggleTheme={toggleTheme} />
      <Hero />
      <ProofBar />
      <Features />
      <Demo />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <ROICalc />
      <FAQ />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
