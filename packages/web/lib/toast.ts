/**
 * Toast notification helper
 * Modern replacement for alert()
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title: string;
  message?: string;
  duration?: number;
}

function showToast(type: ToastType, options: ToastOptions) {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent('show-toast', {
    detail: {
      type,
      ...options,
    },
  });
  window.dispatchEvent(event);
}

export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    showToast('success', { title, message, duration });
  },
  error: (title: string, message?: string, duration?: number) => {
    showToast('error', { title, message, duration });
  },
  warning: (title: string, message?: string, duration?: number) => {
    showToast('warning', { title, message, duration });
  },
  info: (title: string, message?: string, duration?: number) => {
    showToast('info', { title, message, duration });
  },
};
