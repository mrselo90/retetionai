'use client';

import { usePathname } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Bot Persona', href: '/dashboard/settings' },
  { label: 'Knowledge', href: '/dashboard/settings/bot-info' },
  { label: 'Notifications', href: '/dashboard/settings/notifications' },
  { label: 'Languages', href: '/dashboard/settings/languages' },
  { label: 'Safety', href: '/dashboard/settings/guardrails' },
  { label: 'Modules', href: '/dashboard/settings/modules' },
  { label: 'Data & Privacy', href: '/dashboard/settings/gdpr' },
];

export default function SettingsNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard/settings') {
      return pathname === '/dashboard/settings';
    }
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <nav className="overflow-x-auto">
      <div className="flex gap-1 border-b border-border pb-0 min-w-max">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-4 py-2 text-sm rounded-t-md whitespace-nowrap transition-colors',
              isActive(tab.href)
                ? 'bg-primary/10 text-primary font-medium border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
