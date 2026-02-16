'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import Link from 'next/link';

const BOT_INFO_KEYS = [
  { key: 'brand_guidelines', label: 'Marka & Kurallar', placeholder: 'Markanızın sesi, değerleri, müşteriye nasıl hitap etmeli…' },
  { key: 'bot_boundaries', label: 'Bot Sınırları', placeholder: 'Bot ne yapmalı / yapmamalı, tıbbi tavsiye verme, insan yönlendirme kuralları…' },
  { key: 'recipe_overview', label: 'Tarif & Kullanım Genel Bilgisi', placeholder: 'Genel kozmetik tarif bilgisi, kullanım özeti…' },
  { key: 'custom_instructions', label: 'Ek Talimatlar', placeholder: 'Diğer özel kurallar veya talimatlar…' },
] as const;

export default function BotInfoPage() {
  const [botInfo, setBotInfo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBotInfo();
  }, []);

  const loadBotInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const res = await authenticatedRequest<{ botInfo: Record<string, string> }>(
        '/api/merchants/me/bot-info',
        session.access_token
      );
      setBotInfo(res.botInfo || {});
    } catch (err: any) {
      toast.error('Bot bilgisi yüklenirken hata oluştu', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSaving(true);
      const payload: Record<string, string> = {};
      BOT_INFO_KEYS.forEach(({ key }) => {
        payload[key] = botInfo[key] ?? '';
      });
      await authenticatedRequest('/api/merchants/me/bot-info', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ botInfo: payload }),
      });
      toast.success('Bot bilgisi kaydedildi');
      await loadBotInfo();
    } catch (err: any) {
      toast.error('Kaydetme hatası', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Bot Bilgisi (AI Kuralları)</h1>
            <p className="text-sm text-zinc-600 mt-1">
              Müşteri sorularına cevap verirken AI asistanın kullanacağı marka kuralları, sınırlar ve tarif bilgisi.
            </p>
          </div>
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-teal-600 hover:text-teal-500"
          >
            ← Ayarlara dön
          </Link>
        </div>

        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">
            Yükleniyor…
          </div>
        ) : (
          <div className="space-y-6">
            {BOT_INFO_KEYS.map(({ key, label, placeholder }) => (
              <div key={key} className="rounded-lg border border-zinc-200 bg-white p-4">
                <label className="form-label block mb-2">{label}</label>
                <textarea
                  className="w-full rounded px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 min-h-[120px]"
                  placeholder={placeholder}
                  value={botInfo[key] ?? ''}
                  onChange={(e) => setBotInfo((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor…' : 'Tümünü Kaydet'}
              </button>
            </div>
          </div>
        )}
      </div>
    
  );
}
