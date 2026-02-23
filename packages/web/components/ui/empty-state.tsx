import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './card';
import { Button, type ButtonVariant } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  iconVariant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
}

const iconColors = {
  default: 'from-muted/10 to-muted/5 text-muted-foreground',
  primary: 'from-primary/10 to-primary/5 text-primary',
  success: 'from-success/10 to-success/5 text-success',
  warning: 'from-warning/10 to-warning/5 text-warning',
  info: 'from-info/10 to-info/5 text-info',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  iconVariant = 'default',
}: EmptyStateProps) {
  return (
    <Card className={cn('border-2 border-dashed border-border hover:border-primary/50 transition-colors', className)}>
      <CardContent className="py-12 px-6 text-center">
        <div
          className={cn(
            'w-16 h-16 mx-auto mb-5 rounded-xl bg-gradient-to-br flex items-center justify-center',
            iconColors[iconVariant]
          )}
        >
          <Icon className="w-8 h-8" />
        </div>
        <h3 className="text-[length:var(--polaris-heading-lg)] font-semibold mb-2 text-foreground">{title}</h3>
        {description && (
          <p className="text-[length:var(--polaris-body-md)] text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {action && (
              <Button onClick={action.onClick} variant={action.variant ?? 'default'} size="default">
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button onClick={secondaryAction.onClick} variant={secondaryAction.variant ?? 'outline'} size="default">
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
