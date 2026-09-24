'use client';

/**
 * Connect the store's own WhatsApp Business number (Meta Embedded Signup).
 * Three states: not available yet (the Meta app is not configured), not
 * connected (one button, no API keys), and connected (number + disconnect).
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { Badge } from '@/components/recete';
import { runEmbeddedSignup, type EmbeddedSignupConfig } from '@/lib/metaEmbeddedSignup';

type Config = ({ enabled: true } & EmbeddedSignupConfig) | { enabled: false };
type Status =
  | { connected: false }
  | {
      connected: true;
      phoneNumberDisplay: string | null;
      verifiedName: string | null;
      coexistence: boolean;
    };

async function accessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function WhatsAppConnectCard() {
  const t = useTranslations('WhatsAppConnect');
  const coexistenceId = useId();
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [coexistence, setCoexistence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    const token = await accessToken();
    if (!token) return;
    try {
      const [nextConfig, nextStatus] = await Promise.all([
        authenticatedRequest<Config>('/api/integrations/whatsapp/embedded-signup/config', token),
        authenticatedRequest<Status>('/api/integrations/whatsapp/status', token),
      ]);
      setConfig(nextConfig);
      setStatus(nextStatus);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    if (!config?.enabled) return;
    setBusy(true);
    try {
      const result = await runEmbeddedSignup(config, { coexistence });
      if (result.status === 'cancelled') {
        toast.info(t('toasts.cancelled.title'), t('toasts.cancelled.message'));
        return;
      }
      if (result.status === 'error') {
        toast.error(t('toasts.failed.title'), result.message);
        return;
      }
      const token = await accessToken();
      if (!token) return;
      const connected = await authenticatedRequest<Status>(
        '/api/integrations/whatsapp/embedded-signup',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            code: result.code,
            wabaId: result.wabaId,
            phoneNumberId: result.phoneNumberId,
            coexistence,
          }),
        }
      );
      setStatus(connected);
      toast.success(t('toasts.connected.title'), t('toasts.connected.message'));
    } catch (err) {
      toast.error(t('toasts.failed.title'), getErrorMessage(err, t('toasts.failed.message')));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(t('disconnectConfirm'))) return;
    setBusy(true);
    try {
      const token = await accessToken();
      if (!token) return;
      await authenticatedRequest('/api/integrations/whatsapp', token, { method: 'DELETE' });
      setStatus({ connected: false });
      toast.success(t('toasts.disconnected.title'), t('toasts.disconnected.message'));
    } catch (err) {
      toast.error(t('toasts.failed.title'), getErrorMessage(err, t('toasts.failed.message')));
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected ? status : null;

  return (
    <div
      className="r-card"
      style={{ padding: 'var(--r-space-7)', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-radius-md)',
              background: '#25D36620',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MessageCircle size={18} color="#128C53" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="r-table-strong">{t('title')}</span>
              {connected ? <Badge tone="success">{t('badges.connected')}</Badge> : null}
              {config && !config.enabled ? (
                <Badge tone="neutral">{t('badges.comingSoon')}</Badge>
              ) : null}
            </div>
            <p className="r-hint" style={{ marginTop: 3 }}>
              {connected
                ? t('connectedDescription', {
                    number: connected.phoneNumberDisplay || '—',
                    name: connected.verifiedName || '—',
                  })
                : config && !config.enabled
                  ? t('comingSoonDescription')
                  : t('description')}
            </p>
          </div>
        </div>

        {connected ? (
          <button
            type="button"
            className="r-btn r-btn-secondary r-btn-sm"
            onClick={disconnect}
            disabled={busy}
          >
            {t('actions.disconnect')}
          </button>
        ) : config?.enabled ? (
          <button
            type="button"
            className="r-btn r-btn-primary r-btn-sm"
            onClick={connect}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? t('actions.connecting') : t('actions.connect')}
          </button>
        ) : null}
      </div>

      {!connected && config?.enabled ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 54 }}>
          <label
            htmlFor={coexistenceId}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              fontSize: 'var(--r-text-sm-plus)',
            }}
          >
            <input
              id={coexistenceId}
              type="checkbox"
              checked={coexistence}
              onChange={(e) => setCoexistence(e.target.checked)}
              disabled={busy}
              style={{ marginTop: 3 }}
            />
            <span>
              {t('coexistenceLabel')}
              <span className="r-hint" style={{ display: 'block' }}>
                {t('coexistenceHelp')}
              </span>
            </span>
          </label>
          <p className="r-hint" style={{ margin: 0 }}>
            {t('steps')}
          </p>
        </div>
      ) : null}

      {loadFailed ? (
        <p className="r-hint" role="alert" style={{ margin: 0, paddingLeft: 54 }}>
          {t('loadFailed')}{' '}
          <button type="button" className="r-btn r-btn-ghost r-btn-sm" onClick={() => void load()}>
            {t('actions.retry')}
          </button>
        </p>
      ) : null}
    </div>
  );
}
