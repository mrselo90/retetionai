'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { Button } from '@/components/recete';
import { ShopifySaveBar } from '@/components/ui/ShopifySaveBar';
import { InlineError } from '@/components/ui/InlineError';
import { PageFeedbackCard } from '@/components/ui/PageFeedbackCard';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';

const BOT_INFO_KEYS = ['brand_guidelines', 'bot_boundaries', 'recipe_overview', 'custom_instructions'] as const;

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export default function BotInfoPage() {
  const t = useTranslations('BotInfo');
  const fieldPrefix = useId();
  const [botInfo, setBotInfo] = useState<Record<string, string>>({});
  const [originalBotInfo, setOriginalBotInfo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pageFeedback, setPageFeedback] = useState<{
    tone: 'success' | 'critical';
    title: string;
    message: string;
  } | null>(null);

  const loadBotInfo = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const res = await authenticatedRequest<{ botInfo: Record<string, string> }>(
        '/api/merchants/me/bot-info',
        session.access_token,
      );
      const info = res.botInfo || {};
      setBotInfo(info);
      setOriginalBotInfo(info);
      setSaveError(null);
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
        return;
      }
      // The fallback used to be a hardcoded English string.
      setSaveError(getErrorMessage(err, t('loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBotInfo();
  }, [loadBotInfo]);

  /**
   * Derived rather than a separate isDirty flag, which could disagree with the
   * fields it describes — for instance after a merchant edits a box and types the
   * original text back in.
   */
  const isDirty = BOT_INFO_KEYS.some((key) => (botInfo[key] ?? '') !== (originalBotInfo[key] ?? ''));

  /**
   * The settings tab bar makes it one click to leave this page with edits in
   * progress, and a client-side route change fires no browser warning. This only
   * covers reloads and tab closes, which is what the platform allows; the visible
   * "unsaved changes" marker next to Save covers the rest by being impossible to
   * miss.
   */
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const handleDiscard = () => {
    setBotInfo(originalBotInfo);
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
      // Was toast.success('Saved') — the one untranslated string on the screen.
      toast.success(t('feedback.savedTitle'));
      setPageFeedback({
        tone: 'success',
        title: t('feedback.savedTitle'),
        message: t('feedback.savedMessage', { time: formatSavedAt(new Date().toISOString()) }),
      });
      setOriginalBotInfo(payload);
      setSaveError(null);
    } catch (err) {
      // A persistent inline error rather than a toast that disappears before the
      // merchant has read it.
      const message = getErrorMessage(err, t('toasts.saveError.title'));
      setSaveError(message);
      setPageFeedback({ tone: 'critical', title: t('feedback.saveErrorTitle'), message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pageFeedback ? (
        <PageFeedbackCard
          tone={pageFeedback.tone}
          title={pageFeedback.title}
          message={pageFeedback.message}
          dismissLabel={t('feedback.dismiss')}
          onDismiss={() => setPageFeedback(null)}
        />
      ) : null}

      {/* Contextual save bar, embedded only. */}
      <ShopifySaveBar
        id="bot-info-csb"
        isDirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      <InlineError message={saveError} onDismiss={() => setSaveError(null)} />

      {loading ? (
        <div className="r-card" role="status" aria-label={t('loading')}>
          {[0, 1].map((row) => (
            <div key={row} className="r-skeleton" style={{ height: 96, marginBottom: row === 0 ? 14 : 0 }} />
          ))}
        </div>
      ) : (
        <>
          {BOT_INFO_KEYS.map((key) => (
            <div className="r-card" key={key}>
              <label className="r-label" htmlFor={`${fieldPrefix}-${key}`}>
                {t(`sections.${key}.label`)}
              </label>
              <textarea
                id={`${fieldPrefix}-${key}`}
                className="r-textarea"
                rows={5}
                placeholder={t(`sections.${key}.placeholder`)}
                value={botInfo[key] ?? ''}
                onChange={(event) => setBotInfo((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            </div>
          ))}

          {/* Standalone only; embedded uses the contextual save bar above. */}
          {!isShopifyEmbedded() && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              {isDirty ? <span className="r-hint">{t('unsavedChanges')}</span> : null}
              {isDirty ? (
                <Button variant="secondary" onClick={handleDiscard} disabled={saving}>
                  {t('discard')}
                </Button>
              ) : null}
              <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty}>
                {saving ? t('saving') : t('saveAll')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
