import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const variantStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export function Spinner({ size = 'md', className, variant = 'primary' }: SpinnerProps) {
  return <Loader2 className={cn('animate-spin', sizeStyles[size], variantStyles[variant], className)} />;
}

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <div className={cn('fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50', className)}>
      <div className="bg-card border-2 border-border rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
        <Spinner size="xl" />
        {message && <p className="text-foreground font-semibold text-center">{message}</p>}
      </div>
    </div>
  );
}
