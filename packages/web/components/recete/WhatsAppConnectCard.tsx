'use client';

/**
 * Link the store's own WhatsApp number by QR code (packages/wa-worker).
 *
 * States: not available (the worker is not configured), not linked (why it
 * matters + the unofficial-link disclosure + one button), pairing (the QR,
 * refreshed by polling), and linked (number + unlink).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { Badge } from '@/components/recete';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out';

type Status = {
  available: boolean;
  status: ConnectionStatus;
  phone: string | null;
  qr: string | null;
  lastError: string | null;
  connectedAt: string | null;
};

const KNOWN_ERRORS = [
  'qr_timeout',
  'pair_refused',
  'number_taken',
  'stream_replaced',
  'client_outdated',
  'unreachable',
] as const;

const POLL_MS = 2000;

async function accessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function WhatsAppConnectCard() {
  const t = useTranslations('WhatsAppConnect');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Set when the merchant pressed Link here, so "connected" earns a toast only
  // for a pairing they just did, not on every page load.
  const pairingRef = useRef(false);

  const load = useCallback(async () => {
    const token = await accessToken();
    if (!token) return;
    try {
      const next = await authenticatedRequest<Status>('/api/integrations/whatsapp/status', token);
      setStatus(next);
      setLoadFailed(false);
      if (next.status === 'connected' && pairingRef.current) {
        pairingRef.current = false;
        toast.success(t('toasts.connected.title'), t('toasts.connected.message'));
      }
    } catch {
      setLoadFailed(true);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pairing = status?.status === 'qr' || status?.status === 'connecting';

  // Poll only while a pairing or reconnect is in flight.
  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [pairing, load]);

  const call = async (path: 'connect' | 'disconnect') => {
    const token = await accessToken();
    if (!token) return null;
    return authenticatedRequest<Status>(`/api/integrations/whatsapp/${path}`, token, {
      method: 'POST',
    });
  };

  const connect = async () => {
    setBusy(true);
    try {
      pairingRef.current = true;
      const next = await call('connect');
      if (next) setStatus(next);
    } catch (err) {
      pairingRef.current = false;
      toast.error(t('toasts.failed.title'), getErrorMessage(err, t('toasts.failed.message')));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (confirmFirst: boolean) => {
    if (confirmFirst && !window.confirm(t('disconnectConfirm'))) return;
    setBusy(true);
    try {
      pairingRef.current = false;
      const next = await call('disconnect');
      if (next) setStatus(next);
      if (confirmFirst) {
        toast.success(t('toasts.disconnected.title'), t('toasts.disconnected.message'));
      }
    } catch (err) {
      toast.error(t('toasts.failed.title'), getErrorMessage(err, t('toasts.failed.message')));
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.status === 'connected';
  const unavailable = status ? !status.available : false;
  const errorKey =
    status && !connected && !pairing
      ? status.status === 'logged_out' && !status.lastError
        ? 'logged_out'
        : status.lastError
          ? (KNOWN_ERRORS as readonly string[]).includes(status.lastError)
            ? status.lastError
            : 'generic'
          : null
      : null;

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
              {status?.status === 'qr' ? <Badge tone="warning">{t('badges.pairing')}</Badge> : null}
              {status?.status === 'connecting' && status.phone ? (
                <Badge tone="warning">{t('badges.reconnecting')}</Badge>
              ) : null}
              {unavailable ? <Badge tone="neutral">{t('badges.unavailable')}</Badge> : null}
            </div>
            <p className="r-hint" style={{ marginTop: 3 }}>
              {connected
                ? t('connectedDescription', { number: status?.phone || '—' })
                : unavailable
                  ? t('unavailableDescription')
                  : t('description')}
            </p>
          </div>
        </div>

        {connected ? (
          <button
            type="button"
            className="r-btn r-btn-secondary r-btn-sm"
            onClick={() => void disconnect(true)}
            disabled={busy}
          >
            {t('actions.disconnect')}
          </button>
        ) : pairing ? (
          <button
            type="button"
            className="r-btn r-btn-ghost r-btn-sm"
            onClick={() => void disconnect(false)}
            disabled={busy}
          >
            {t('actions.cancel')}
          </button>
        ) : status && !unavailable ? (
          <button
            type="button"
            className="r-btn r-btn-primary r-btn-sm"
            onClick={() => void connect()}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? t('actions.connecting') : t('actions.connect')}
          </button>
        ) : null}
      </div>

      {errorKey ? (
        <p
          className="r-hint"
          role="alert"
          style={{ margin: 0, paddingLeft: 54, color: 'var(--r-danger, #b42318)' }}
        >
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      {pairing ? (
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
            paddingLeft: 54,
          }}
        >
          {status?.qr ? (
            // A data: URL the worker renders; next/image adds nothing here.
            <img
              src={status.qr}
              alt={t('scanTitle')}
              width={208}
              height={208}
              style={{ borderRadius: 'var(--r-radius-md)', background: '#fff', padding: 8 }}
            />
          ) : (
            <div
              aria-live="polite"
              className="r-hint"
              style={{
                width: 208,
                height: 208,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--r-border, #d0d5dd)',
                borderRadius: 'var(--r-radius-md)',
              }}
            >
              {t('waiting')}
            </div>
          )}
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <p className="r-table-strong" style={{ margin: 0 }}>
              {t('scanTitle')}
            </p>
            <p className="r-hint" style={{ margin: '4px 0 0' }}>
              {t('scanSteps')}
            </p>
          </div>
        </div>
      ) : null}

      {!connected && !unavailable && status ? (
        <div style={{ paddingLeft: 54 }}>
          <p className="r-hint" style={{ margin: 0 }}>
            <strong>{t('disclosureTitle')}:</strong> {t('disclosure')}
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
