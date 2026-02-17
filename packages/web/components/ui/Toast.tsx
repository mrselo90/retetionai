'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 300); // Wait for exit animation
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-success" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-warning" />;
      case 'info':
        return <Info className="w-6 h-6 text-info" />;
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-gradient-to-r from-success/15 to-success/5 border-2 border-success/30 shadow-success/20';
      case 'error':
        return 'bg-gradient-to-r from-destructive/15 to-destructive/5 border-2 border-destructive/30 shadow-destructive/20';
      case 'warning':
        return 'bg-gradient-to-r from-warning/15 to-warning/5 border-2 border-warning/30 shadow-warning/20';
      case 'info':
        return 'bg-gradient-to-r from-info/15 to-info/5 border-2 border-info/30 shadow-info/20';
    }
  };

  const getTitleColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-success';
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      case 'info':
        return 'text-info';
    }
  };

  const getMessageColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-success/80';
      case 'error':
        return 'text-destructive/80';
      case 'warning':
        return 'text-warning/80';
      case 'info':
        return 'text-info/80';
    }
  };

  return (
    <div
      className={`${getColors()} rounded-xl shadow-xl p-5 mb-3 flex items-start gap-4 backdrop-blur-sm transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0 animate-slide-in-right'
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${getTitleColor()}`}>
          {toast.title}
        </p>
        {toast.message && (
          <p className={`text-sm mt-1.5 font-medium ${getMessageColor()}`}>
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/50 transition-all"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (event: CustomEvent<Omit<ToastMessage, 'id'>>) => {
      const newToast: ToastMessage = {
        ...event.detail,
        id: Math.random().toString(36).substring(7),
      };
      setToasts((prev) => [...prev, newToast]);
    };

    window.addEventListener('show-toast' as never, handleToast);
    return () => window.removeEventListener('show-toast' as never, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-50 w-full max-w-md space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}
