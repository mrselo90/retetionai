/**
 * Settings tab bar, design direction 1b.
 *
 * The design draws Settings as one page with eight client-side tabs; these stay
 * separate routes so each tab has a URL, the back button works, and a merchant
 * can link a colleague straight to Safety. The bar reproduces the design's
 * appearance over that.
 *
 * Labels are translated. They used to be hardcoded English string literals, so a
 * Turkish merchant read "Bot Persona / Knowledge / Notifications" above a fully
 * Turkish page.
 *
 * The design also has a Billing tab. It is not here: billing runs entirely
 * through Shopify's recurring charges (see packages/api/src/routes/billing.ts),
 * so there is nothing a merchant on the standalone dashboard could do on it.
 */

'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

const TABS = [
  { key: 'persona', href: '/dashboard/settings' },
  { key: 'knowledge', href: '/dashboard/settings/bot-info' },
  { key: 'notifications', href: '/dashboard/settings/notifications' },
  { key: 'languages', href: '/dashboard/settings/languages' },
  { key: 'safety', href: '/dashboard/settings/guardrails' },
  { key: 'modules', href: '/dashboard/settings/modules' },
  { key: 'privacy', href: '/dashboard/settings/gdpr' },
] as const;

export default function SettingsNav() {
  const t = useTranslations('Settings');
  const pathname = usePathname();

  // The index tab must match exactly, or it would light up on every child route.
  const isActive = (href: string) =>
    href === '/dashboard/settings' ? pathname === href : (pathname?.startsWith(href) ?? false);

  return (
    <nav className="r-subtabs" aria-label={t('nav.label')}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="r-subtab"
          // aria-current is what makes the active tab a fact rather than a
          // colour; the old bar conveyed it only visually.
          aria-current={isActive(tab.href) ? 'page' : undefined}
        >
          {t(`nav.${tab.key}`)}
        </Link>
      ))}
    </nav>
  );
}
