'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';

interface Merchant {
  id: string;
  name: string;
}

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMerchant();
  }, []);

  const loadMerchant = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const data = await authenticatedRequest<{ merchant: Merchant }>(
          '/api/auth/me',
          session.access_token
        );
        setMerchant(data.merchant);
      }
    } catch (err) {
      console.error('Failed to load merchant:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-zinc-200/80 min-h-[4rem] flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shadow-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        aria-label="Menüyü aç"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="hidden lg:block flex-1 min-w-0">
        {loading ? (
          <div className="h-5 w-40 bg-zinc-200/80 rounded-md animate-pulse" />
        ) : (
          <h2 className="text-lg font-semibold text-zinc-900 truncate">
            {merchant?.name || 'Panel'}
          </h2>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="lg:hidden">
          {loading ? (
            <div className="h-4 w-24 bg-zinc-200/80 rounded animate-pulse" />
          ) : (
            <span className="text-sm font-medium text-zinc-600 truncate max-w-[120px]">{merchant?.name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          aria-label="Çıkış yap"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}
