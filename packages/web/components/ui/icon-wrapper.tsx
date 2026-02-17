import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconWrapperProps {
  icon: LucideIcon;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  background?: boolean;
}

const variantStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

const backgroundStyles = {
  default: 'bg-muted',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted/50 text-muted-foreground',
};

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

const containerSizeStyles = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
  xl: 'p-3',
};

export function IconWrapper({
  icon: Icon,
  className,
  variant = 'default',
  size = 'md',
  background = false,
}: IconWrapperProps) {
  if (background) {
    return (
      <div
        className={cn(
          'rounded-lg transition-colors',
          backgroundStyles[variant],
          containerSizeStyles[size],
          className
        )}
      >
        <Icon className={sizeStyles[size]} />
      </div>
    );
  }

  return <Icon className={cn(sizeStyles[size], variantStyles[variant], className)} />;
}
