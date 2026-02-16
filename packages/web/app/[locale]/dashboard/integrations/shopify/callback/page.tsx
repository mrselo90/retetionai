'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';

function ShopifyCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = () => {
    // Check URL parameters (backend redirects here with success/error)
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (success === 'true') {
      setStatus('success');
      setMessage(message || 'Shopify entegrasyonu başarıyla tamamlandı!');
      
      // Redirect to integrations page after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/integrations');
      }, 2000);
    } else if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
    } else {
      // No parameters - might be direct access
      setStatus('error');
      setMessage('Geçersiz callback. Lütfen entegrasyon sayfasından tekrar deneyin.');
    }
  };

  return (
    
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Shopify Bağlanıyor...</h2>
              <p className="text-zinc-600">Lütfen bekleyin, entegrasyon tamamlanıyor.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Başarılı!</h2>
              <p className="text-zinc-600 mb-4">{message}</p>
              <p className="text-sm text-zinc-600">Entegrasyonlar sayfasına yönlendiriliyorsunuz...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Hata</h2>
              <p className="text-zinc-600 mb-4">{message}</p>
              <button
                onClick={() => router.push('/dashboard/integrations')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Entegrasyonlara Dön
              </button>
            </div>
          )}
        </div>
      </div>
    
  );
}

export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={
      
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Loading...</h2>
            </div>
          </div>
        </div>
      
    }>
      <ShopifyCallbackContent />
    </Suspense>
  );
}
