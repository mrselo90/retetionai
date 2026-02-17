import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
  };
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
      <CardContent className="p-16 text-center">
        <div
          className={cn(
            'w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-inner',
            iconColors[iconVariant]
          )}
        >
          <Icon className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold mb-3">{title}</h3>
        {description && <p className="text-muted-foreground mb-8 max-w-md mx-auto text-base">{description}</p>}
        {(action || secondaryAction) && (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {action && (
              <Button onClick={action.onClick} variant={action.variant || 'default'} size="lg" className="shadow-lg hover:shadow-xl">
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button onClick={secondaryAction.onClick} variant={secondaryAction.variant || 'outline'} size="lg">
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
