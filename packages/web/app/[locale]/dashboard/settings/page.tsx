'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { ShopifySaveBar } from '@/components/ui/ShopifySaveBar';
import { InlineError } from '@/components/ui/InlineError';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';
import { Button } from '@/components/recete';
import { Switch } from '@/components/recete/Switch';

interface Merchant {
  id: string;
  name: string;
  notification_phone?: string | null;
  persona_settings?: {
    bot_name?: string;
    tone?: 'friendly' | 'professional' | 'casual' | 'formal';
    emoji?: boolean;
    response_length?: 'short' | 'medium' | 'long';
    temperature?: number;
    whatsapp_welcome_template?: string;
    message_send_mode?: 'always' | 'all_products_required';
  };
  created_at: string;
}

const TONES = ['friendly', 'professional', 'casual', 'formal'] as const;
const LENGTHS = ['short', 'medium', 'long'] as const;
const WELCOME_TEMPLATE_TOKENS = [
  'firstName',
  'orderNumber',
  'productNames',
  'productCount',
  'botName',
] as const;

const TOKEN_VALUE: Record<(typeof WELCOME_TEMPLATE_TOKENS)[number], string> = {
  firstName: '{{customer_first_name}}',
  orderNumber: '{{order_number}}',
  productNames: '{{product_names}}',
  productCount: '{{product_count}}',
  botName: '{{bot_name}}',
};

function appendToken(template: string, token: string) {
  if (!template.trim()) return token;
  return /[\s\n]$/.test(template) ? `${template}${token}` : `${template} ${token}`;
}

function buildPreview(template: string, botName: string, fallbackSample: string) {
  const base = template.trim() || fallbackSample;
  return base
    .replace(/\{\{\s*customer_first_name\s*\}\}/gi, 'Ayşe')
    .replace(/\{\{\s*order_number\s*\}\}/gi, '1212')
    .replace(/\{\{\s*product_names\s*\}\}/gi, 'A Serumu ve B Kremi')
    .replace(/\{\{\s*product_count\s*\}\}/gi, '2')
    .replace(/\{\{\s*bot_name\s*\}\}/gi, botName.trim() || 'Recete');
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const fieldPrefix = useId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [botName, setBotName] = useState('');
  const [original, setOriginal] = useState<{
    botName: string; tone: (typeof TONES)[number]; emoji: boolean;
    responseLength: (typeof LENGTHS)[number]; temperature: number;
    whatsappWelcomeTemplate: string; messageSendMode: 'always' | 'all_products_required';
  } | null>(null);
  const [tone, setTone] = useState<(typeof TONES)[number]>('friendly');
  const [emoji, setEmoji] = useState(true);
  const [responseLength, setResponseLength] = useState<(typeof LENGTHS)[number]>('medium');
  const [temperature, setTemperature] = useState(0.7);
  const [whatsappWelcomeTemplate, setWhatsappWelcomeTemplate] = useState('');
  const [messageSendMode, setMessageSendMode] = useState<'always' | 'all_products_required'>('always');

  const preview = buildPreview(whatsappWelcomeTemplate, botName, t('botPersona.welcomeTemplatePlaceholder'));

  /**
   * Derived from a comparison, not tracked as a side-channel boolean. The old
   * isDirty flag was set to true by every onChange handler and never reset except
   * on save/discard — editing a field then typing back the original value still
   * counted as dirty, and a bug in any one handler could leave it stuck either way.
   */
  const isDirty = original !== null && (
    botName !== original.botName ||
    tone !== original.tone ||
    emoji !== original.emoji ||
    responseLength !== original.responseLength ||
    temperature !== original.temperature ||
    whatsappWelcomeTemplate !== original.whatsappWelcomeTemplate ||
    messageSendMode !== original.messageSendMode
  );

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const response = await authenticatedRequest<{ merchant: Merchant }>('/api/merchants/me', session.access_token);
      const persona = response.merchant.persona_settings || {};
      /*
       * This used to fall back to the *translated placeholder text* as the actual
       * field value: setBotName(persona.bot_name || t('...namePlaceholder')). The
       * moment a merchant with no bot name saved anything else on this page, "Assistant"
       * (or "Asistan", whichever locale loaded first) was written to the database as
       * a real, permanent bot name — not shown as a placeholder at all, since the
       * input already had non-empty content. An unset name now stays empty and the
       * <input placeholder> attribute does the placeholder's actual job.
       */
      const loaded = {
        botName: persona.bot_name || '',
        tone: persona.tone || 'friendly',
        emoji: persona.emoji !== false,
        responseLength: persona.response_length || 'medium',
        temperature: persona.temperature ?? 0.7,
        whatsappWelcomeTemplate: typeof persona.whatsapp_welcome_template === 'string' ? persona.whatsapp_welcome_template : '',
        messageSendMode: persona.message_send_mode || 'always',
      } as const;
      setBotName(loaded.botName);
      setTone(loaded.tone);
      setEmoji(loaded.emoji);
      setResponseLength(loaded.responseLength);
      setTemperature(loaded.temperature);
      setWhatsappWelcomeTemplate(loaded.whatsappWelcomeTemplate);
      setMessageSendMode(loaded.messageSendMode);
      setOriginal(loaded);
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

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const discard = () => {
    if (original) {
      setBotName(original.botName);
      setTone(original.tone);
      setEmoji(original.emoji);
      setResponseLength(original.responseLength);
      setTemperature(original.temperature);
      setWhatsappWelcomeTemplate(original.whatsappWelcomeTemplate);
      setMessageSendMode(original.messageSendMode);
    }
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await authenticatedRequest('/api/merchants/me', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({
          persona_settings: {
            bot_name: botName.trim() || undefined,
            tone,
            emoji,
            response_length: responseLength,
            temperature,
            whatsapp_welcome_template: whatsappWelcomeTemplate.trim() || undefined,
            message_send_mode: messageSendMode,
          },
        }),
      });
      toast.success(t('toasts.saveSuccess.title'), t('toasts.saveSuccess.message'));
      setSaveError(null);
      await loadData();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="r-card" style={{ maxWidth: 760 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 18, width: 200 }} />
        <div className="r-skeleton" style={{ height: 320, marginTop: 18 }} />
      </div>
    );
  }

  return (
    <div className="r-card" id="settings-bot-persona" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div className="r-card-title">{t('botPersona.title')}</div>
        <p className="r-hint" style={{ marginTop: 3 }}>
          {t('botPersona.description')}{' '}
          <Link href="/dashboard/settings/bot-info" style={{ color: 'var(--r-brand)', fontWeight: 'var(--r-weight-semibold)' }}>
            {t('botPersona.botInfoLink')}
          </Link>
        </p>
      </div>

      <div>
        <label className="r-label" htmlFor={`${fieldPrefix}-name`}>{t('botPersona.nameLabel')}</label>
        <input
          id={`${fieldPrefix}-name`}
          className="r-input"
          style={{ maxWidth: 320 }}
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder={t('botPersona.namePlaceholder')}
          autoComplete="off"
        />
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="r-label" style={{ padding: 0, marginBottom: 8 }}>{t('botPersona.toneLabel')}</legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TONES.map((value) => (
            <label key={value} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name={`${fieldPrefix}-tone`}
                value={value}
                checked={tone === value}
                onChange={() => setTone(value)}
                className="sr-only"
              />
              <span
                className="r-tab"
                style={tone === value ? { background: 'var(--r-brand-tint)', color: 'var(--r-brand)' } : undefined}
              >
                {t(`botPersona.tones.${value}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Switch label={t('botPersona.emojiLabel')} checked={emoji} onChange={setEmoji} />
        <p className="r-field-help">{t('botPersona.emojiDesc')}</p>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="r-label" style={{ padding: 0, marginBottom: 8 }}>{t('botPersona.responseLengthLabel')}</legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LENGTHS.map((value) => (
            <label key={value} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name={`${fieldPrefix}-length`}
                value={value}
                checked={responseLength === value}
                onChange={() => setResponseLength(value)}
                className="sr-only"
              />
              <span
                className="r-tab"
                style={responseLength === value ? { background: 'var(--r-brand-tint)', color: 'var(--r-brand)' } : undefined}
              >
                {t(`botPersona.lengths.${value}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="r-label" htmlFor={`${fieldPrefix}-temp`}>
          {t('botPersona.temperatureLabel', { value: temperature.toFixed(1) })}
        </label>
        <input
          id={`${fieldPrefix}-temp`}
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          style={{ width: '100%', maxWidth: 480, accentColor: 'var(--r-brand)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 480 }}>
          <span className="r-hint">{t('botPersona.tempLabels.consistent')}</span>
          <span className="r-hint">{t('botPersona.tempLabels.balanced')}</span>
          <span className="r-hint">{t('botPersona.tempLabels.creative')}</span>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--r-border)', margin: 0 }} />

      {/*
        This whole section was hardcoded Turkish — title, both option labels, and
        both option descriptions — on a page whose every other line is translated.
        A merchant with the interface set to English still read this section in
        Turkish, and the design had no way of adapting it to any other language.
      */}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="r-label" style={{ padding: 0, marginBottom: 8 }}>{t('botPersona.sendMode.title')}</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['always', 'all_products_required'] as const).map((value) => (
            <label key={value} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`${fieldPrefix}-sendmode`}
                value={value}
                checked={messageSendMode === value}
                onChange={() => setMessageSendMode(value)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 'var(--r-text-base-plus)', fontWeight: 'var(--r-weight-semibold)' }}>
                  {t(`botPersona.sendMode.${value}.label`)}
                </span>
                <span className="r-hint">{t(`botPersona.sendMode.${value}.help`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <hr style={{ border: 0, borderTop: '1px solid var(--r-border)', margin: 0 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 'var(--r-space-6) var(--r-space-7)',
            background: 'var(--r-brand-tint)',
            borderRadius: 'var(--r-radius-md)',
            fontSize: 'var(--r-text-sm-plus)',
            color: 'var(--r-text-secondary)',
          }}
        >
          {t('botPersona.welcomeTemplateWindowNotice')}
        </div>

        <label className="r-label" htmlFor={`${fieldPrefix}-welcome`}>{t('botPersona.welcomeTemplateLabel')}</label>
        <textarea
          id={`${fieldPrefix}-welcome`}
          className="r-textarea"
          rows={6}
          value={whatsappWelcomeTemplate}
          onChange={(e) => setWhatsappWelcomeTemplate(e.target.value)}
          placeholder={t('botPersona.welcomeTemplatePlaceholder')}
        />
        <p className="r-field-help">{t('botPersona.welcomeTemplateDesc')}</p>

        <div>
          <p style={{ fontSize: 'var(--r-text-base-plus)', fontWeight: 'var(--r-weight-semibold)', margin: '4px 0 8px' }}>
            {t('botPersona.insertVariables')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {WELCOME_TEMPLATE_TOKENS.map((key) => (
              <Button
                key={key}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setWhatsappWelcomeTemplate((current) => appendToken(current, TOKEN_VALUE[key]))}
              >
                {t(`botPersona.welcomeTokens.${key}.label`)}
              </Button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {WELCOME_TEMPLATE_TOKENS.map((key) => (
              <p key={key} className="r-hint">
                <strong>{TOKEN_VALUE[key]}</strong> {t(`botPersona.welcomeTokens.${key}.help`)}
              </p>
            ))}
          </div>
        </div>

        <div style={{ padding: 'var(--r-space-6) var(--r-space-7)', background: 'var(--r-bg)', borderRadius: 'var(--r-radius-md)', border: '1px solid var(--r-border)' }}>
          <p style={{ fontSize: 'var(--r-text-sm-plus)', fontWeight: 'var(--r-weight-semibold)', margin: '0 0 4px' }}>
            {t('botPersona.previewLabel')}
          </p>
          <p style={{ fontSize: 'var(--r-text-sm-plus)', margin: 0, whiteSpace: 'pre-wrap' }}>{preview}</p>
        </div>

        <div style={{ padding: 'var(--r-space-6) var(--r-space-7)', background: 'var(--r-bg)', borderRadius: 'var(--r-radius-md)', border: '1px solid var(--r-border)' }}>
          <p style={{ fontSize: 'var(--r-text-sm-plus)', fontWeight: 'var(--r-weight-semibold)', margin: '0 0 4px' }}>
            {t('botPersona.welcomeTemplatePlaceholdersTitle')}
          </p>
          <p className="r-hint">{t('botPersona.welcomeTemplatePlaceholderOrder')}</p>
          <p className="r-hint">{t('botPersona.welcomeTemplatePlaceholderProducts')}</p>
          <p className="r-hint">
            {t('botPersona.additionalPlaceholders')}: {WELCOME_TEMPLATE_TOKENS.filter((k) => k !== 'orderNumber' && k !== 'productNames').map((k) => TOKEN_VALUE[k]).join(', ')}
          </p>
        </div>
      </div>

      <div style={{ paddingTop: 12, borderTop: '1px solid var(--r-border)' }}>
        <InlineError message={saveError} onDismiss={() => setSaveError(null)} />

        <ShopifySaveBar id="settings-persona-csb" isDirty={isDirty} saving={saving} onSave={handleSave} onDiscard={discard} />

        {!isShopifyEmbedded() && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: saveError ? 12 : 0 }}>
            {isDirty ? <span className="r-hint">{t('unsavedChanges')}</span> : null}
            {isDirty ? (
              <Button variant="secondary" onClick={discard} disabled={saving}>{t('discard')}</Button>
            ) : null}
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty}>
              {saving ? t('botPersona.saving') : t('botPersona.saveButton')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
