'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/recete';
import { Switch } from '@/components/recete/Switch';

interface MultiLangRagSettings {
  shop_id: string;
  default_source_lang: string;
  enabled_langs: string[];
  multi_lang_rag_enabled: boolean;
}

/** Language codes the retrieval pipeline supports. Names are resolved at render. */
const LANG_CODES = ['en', 'tr', 'hu', 'de', 'el'] as const;

export default function LanguagesPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const fieldPrefix = useId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabledLangs, setEnabledLangs] = useState<string[]>(['en']);
  const [defaultSourceLang, setDefaultSourceLang] = useState<string>('en');
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);

  /**
   * Language names came from a hardcoded English list, so a Turkish merchant read
   * "Turkish / Hungarian / Greek". Intl.DisplayNames gives them in the interface
   * language, and falls back to the code if the runtime does not know one.
   */
  const languageName = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      display = null;
    }
    return (code: string) => display?.of(code) ?? code;
  }, [locale]);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const response = await authenticatedRequest<{ settings: MultiLangRagSettings }>(
        '/api/merchants/me/multi-lang-rag-settings',
        session.access_token,
      );
      const settings = response.settings;
      setConfigured(true);
      setDefaultSourceLang(settings.default_source_lang || 'en');
      setEnabledLangs(
        Array.isArray(settings.enabled_langs) && settings.enabled_langs.length
          ? settings.enabled_langs
          : [settings.default_source_lang || 'en'],
      );
      setMultiLangEnabled(Boolean(settings.multi_lang_rag_enabled));
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
        return;
      }
      toast.error(t('toasts.saveError.title'), t('toasts.saveError.message'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /** The primary language is always supported, whatever the checkboxes say. */
  const withPrimary = (langs: string[]) => [...new Set([defaultSourceLang, ...langs])];

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await authenticatedRequest<{ settings: MultiLangRagSettings }>(
        '/api/merchants/me/multi-lang-rag-settings',
        session.access_token,
        {
          method: 'PUT',
          body: JSON.stringify({
            default_source_lang: defaultSourceLang,
            enabled_langs: withPrimary(enabledLangs),
            multi_lang_rag_enabled: multiLangEnabled,
          }),
        },
      );
      setConfigured(true);
      setEnabledLangs(response.settings.enabled_langs);
      setDefaultSourceLang(response.settings.default_source_lang);
      setMultiLangEnabled(Boolean(response.settings.multi_lang_rag_enabled));
      toast.success(t('toasts.multiLangSuccess.title'), t('toasts.multiLangSuccess.message'));
    } catch (err) {
      toast.error(
        t('toasts.multiLangError.title'),
        getErrorMessage(err, t('toasts.multiLangError.message')),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="r-card" style={{ maxWidth: 760 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 18, width: 200 }} />
        <div className="r-skeleton" style={{ height: 150, marginTop: 18 }} />
      </div>
    );
  }

  const supported = withPrimary(enabledLangs);

  return (
    <div className="r-card" id="settings-multilingual" style={{ maxWidth: 760 }}>
      <div className="r-card-title">{t('multilingual.title')}</div>
      <p className="r-hint" style={{ marginTop: 3 }}>{t('multilingual.description')}</p>

      <label className="r-label" htmlFor={`${fieldPrefix}-primary`} style={{ marginTop: 18 }}>
        {t('multilingual.primaryLanguageLabel')}
      </label>
      <select
        id={`${fieldPrefix}-primary`}
        className="r-select"
        style={{ maxWidth: 320 }}
        value={defaultSourceLang}
        onChange={(event) => {
          const next = event.target.value;
          setDefaultSourceLang(next);
          setEnabledLangs((prev) => [...new Set([next, ...prev])]);
        }}
      >
        {LANG_CODES.map((code) => (
          <option key={code} value={code}>{languageName(code)}</option>
        ))}
      </select>

      {/* A fieldset, so the checkbox group is announced with its own heading
          rather than as five unrelated boxes. */}
      <fieldset style={{ border: 0, padding: 0, margin: '18px 0 0' }}>
        <legend className="r-label" style={{ padding: 0 }}>
          {t('multilingual.supportedLanguagesLabel')}
        </legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          {LANG_CODES.map((code) => {
            const isPrimary = code === defaultSourceLang;
            return (
              <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--r-text-base-plus)' }}>
                <input
                  type="checkbox"
                  checked={supported.includes(code)}
                  /* The primary language cannot be switched off here; disabling it
                     says so, where the old list silently re-added it. */
                  disabled={isPrimary}
                  onChange={(event) =>
                    setEnabledLangs((prev) =>
                      event.target.checked
                        ? [...new Set([...prev, code])]
                        : prev.filter((value) => value !== code),
                    )
                  }
                />
                {languageName(code)}
                {isPrimary ? (
                  <span className="r-hint">· {t('multilingual.primaryTag')}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div style={{ marginTop: 18 }}>
        <Switch
          label={t('multilingual.enableLabel')}
          checked={multiLangEnabled}
          onChange={setMultiLangEnabled}
        />
        <p className="r-field-help">{t('multilingual.enableHelp')}</p>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 'var(--r-space-6)',
          border: '1px solid var(--r-border)',
          borderRadius: 'var(--r-radius-md)',
          background: 'var(--r-bg)',
        }}
      >
        {/* Was "configured / not configured", which told the merchant nothing they
            could act on. Naming the languages does. */}
        <p style={{ fontSize: 'var(--r-text-sm-plus)' }}>
          <strong>{t('multilingual.currentStateLabel')}</strong>{' '}
          {configured
            ? supported.map(languageName).join(', ')
            : t('multilingual.stateNotConfigured')}
        </p>
        <p className="r-hint" style={{ marginTop: 4 }}>{t('multilingual.stateHelp')}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {t('multilingual.saveButton')}
        </Button>
      </div>
    </div>
  );
}
