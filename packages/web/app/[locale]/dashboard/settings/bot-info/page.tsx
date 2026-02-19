'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { ShopifySaveBar } from '@/components/ui/ShopifySaveBar';
import { InlineError } from '@/components/ui/InlineError';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';

const BOT_INFO_KEYS = ['brand_guidelines', 'bot_boundaries', 'recipe_overview', 'custom_instructions'] as const;

export default function BotInfoPage() {
  const t = useTranslations('BotInfo');
  const [botInfo, setBotInfo] = useState<Record<string, string>>({});
  const [originalBotInfo, setOriginalBotInfo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
      const info = res.botInfo || {};
      setBotInfo(info);
      setOriginalBotInfo(info);
      setIsDirty(false);
      setSaveError(null);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to load bot info');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setBotInfo((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleDiscard = () => {
    setBotInfo(originalBotInfo);
    setIsDirty(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSaving(true);
      const payload: Record<string, string> = {};
      BOT_INFO_KEYS.forEach((key) => {
        payload[key] = botInfo[key] ?? '';
      });
      await authenticatedRequest('/api/merchants/me/bot-info', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ botInfo: payload }),
      });
      toast.success('Saved');
      setOriginalBotInfo(payload);
      setIsDirty(false);
      setSaveError(null);
    } catch (err: any) {
      // G4: Persistent inline error instead of auto-dismissing toast (BFS 4.2.4)
      setSaveError(err.message || t('toasts.saveError.title'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{t('title')}</h1>
          <p className="text-sm text-zinc-600 mt-1">{t('description')}</p>
        </div>
        <Link
          href="/dashboard/settings"
          className="text-sm font-medium text-teal-600 hover:text-teal-500"
        >
          {t('backToSettings')}
        </Link>
      </div>

      {/* G3: Contextual Save Bar (BFS 4.1.5) — embedded only */}
      <ShopifySaveBar
        id="bot-info-csb"
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* G4: Persistent inline error (BFS 4.2.4) */}
      <InlineError message={saveError} onDismiss={() => setSaveError(null)} />

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">
          {t('loading')}
        </div>
      ) : (
        <div className="space-y-6">
          {BOT_INFO_KEYS.map((key) => (
            <div key={key} className="rounded-lg border border-zinc-200 bg-white p-4">
              <label className="form-label block mb-2">{t(`sections.${key}.label`)}</label>
              <textarea
                className="w-full rounded px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 min-h-[120px]"
                placeholder={t(`sections.${key}.placeholder`)}
                value={botInfo[key] ?? ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
              />
            </div>
          ))}

          {/* Inline Save Button — standalone mode only (BFS 4.1.5) */}
          {!isShopifyEmbedded() && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {saving ? t('saving') : t('saveAll')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
