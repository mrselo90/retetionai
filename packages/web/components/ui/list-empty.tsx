'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ListEmptyProps {
  icon: LucideIcon;
  message: string;
  className?: string;
}

/**
 * Compact empty state for list sections (e.g. recent orders, recent conversations).
 * Polaris-aligned: icon + message only; no actions. Use EmptyState for full-page empty with actions.
 */
export function ListEmpty({ icon: Icon, message, className }: ListEmptyProps) {
  return (
    <div
      className={cn(
        'py-12 px-6 text-center text-muted-foreground',
        className
      )}
    >
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-8 h-8 opacity-40" />
      </div>
      <p className="font-medium text-foreground/80">{message}</p>
    </div>
  );
}
