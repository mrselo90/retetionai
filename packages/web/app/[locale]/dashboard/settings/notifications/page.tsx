'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/recete';

interface Merchant {
  id: string;
  notification_phone?: string | null;
}

/**
 * A typo here is silent: the merchant simply never receives the escalation
 * alerts this setting exists to deliver, and nothing on screen says so. Validated
 * loosely — enough digits to be a real number, no attempt to police which country
 * it belongs to.
 */
function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export default function NotificationsPage() {
  const t = useTranslations('Settings');
  const fieldId = useId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationPhone, setNotificationPhone] = useState('');
  const [showError, setShowError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const response = await authenticatedRequest<{ merchant: Merchant }>(
        '/api/merchants/me',
        session.access_token,
      );
      setNotificationPhone(response.merchant.notification_phone || '');
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

  // Clearing the field is how a merchant turns alerts off, so empty is valid.
  const trimmed = notificationPhone.trim();
  const invalid = trimmed.length > 0 && !isPlausiblePhone(trimmed);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) {
      setShowError(true);
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await authenticatedRequest('/api/merchants/me', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ notification_phone: trimmed }),
      });
      toast.success(t('toasts.saveSuccess.title'), t('toasts.saveSuccess.message'));
    } catch (err) {
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="r-card" style={{ maxWidth: 760 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 18, width: 180 }} />
        <div className="r-skeleton" style={{ height: 40, marginTop: 18, maxWidth: 320 }} />
      </div>
    );
  }

  return (
    /* A real form, so Enter saves — the field and its button used to be unrelated
       elements and the keyboard did nothing. */
    <form className="r-card" style={{ maxWidth: 760 }} onSubmit={handleSubmit} noValidate>
      <div className="r-card-title">{t('notifications.title')}</div>
      <p className="r-hint" style={{ marginTop: 3 }}>{t('notifications.description')}</p>

      <label className="r-label" htmlFor={fieldId} style={{ marginTop: 18 }}>
        {t('notifications.phoneLabel')}
      </label>
      <input
        id={fieldId}
        type="tel"
        className={`r-input${showError && invalid ? ' r-input-invalid' : ''}`}
        style={{ maxWidth: 320 }}
        value={notificationPhone}
        onChange={(event) => setNotificationPhone(event.target.value)}
        onBlur={() => setShowError(true)}
        placeholder={t('notifications.phonePlaceholder')}
        autoComplete="off"
        aria-invalid={showError && invalid}
        aria-describedby={`${fieldId}-hint${showError && invalid ? ` ${fieldId}-error` : ''}`}
      />
      {showError && invalid ? (
        <p className="r-field-error" id={`${fieldId}-error`}>{t('notifications.phoneInvalid')}</p>
      ) : null}
      <p className="r-field-help" id={`${fieldId}-hint`}>{t('notifications.phoneHint')}</p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <Button type="submit" variant="primary" loading={saving} disabled={invalid && showError}>
          {saving ? t('botPersona.saving') : t('botPersona.saveButton')}
        </Button>
      </div>
    </form>
  );
}
