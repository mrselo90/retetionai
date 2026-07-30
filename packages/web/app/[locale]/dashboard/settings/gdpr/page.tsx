'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, triggerBrowserDownload } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/recete';

/**
 * Deliberately not translated. It is a literal the merchant must reproduce
 * exactly, it is shown to them as the field's placeholder, and varying it by
 * interface language would mean the phrase guarding an irreversible wipe changes
 * out from under anyone who switches locale mid-flow.
 */
const HARD_DELETE_PHRASE = 'DELETE';

/**
 * Same-origin legal pages. Canonical paths: next.config.mjs permanently redirects
 * /privacy-policy and /terms-of-service here, and linking through a redirect from
 * inside the app is just a wasted hop.
 */
const LEGAL_LINKS = [
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
  { href: '/cookie-policy', key: 'cookie' },
  { href: '/data-processing-addendum', key: 'dpa' },
  { href: '/security', key: 'security' },
] as const;

export default function GdprPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const fieldId = useId();
  const titleId = useId();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hardConfirmText, setHardConfirmText] = useState('');
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const hardDeleteArmed = hardConfirmText.trim().toUpperCase() === HARD_DELETE_PHRASE;

  useEffect(() => {
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const closeDialog = () => {
    if (deleting) return;
    setDialogOpen(false);
    setHardConfirmText('');
    openerRef.current?.focus();
  };

  /*
   * Escape closes it and focus moves into it on open — neither of which a
   * hand-rolled overlay gets for free, and both of which the Polaris Modal this
   * replaces did provide.
   */
  useEffect(() => {
    if (!dialogOpen) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        setDialogOpen(false);
        setHardConfirmText('');
        openerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialogOpen, deleting]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await authenticatedRequest<{ data: unknown; exported_at: string }>(
        '/api/gdpr/export',
        session.access_token,
      );
      triggerBrowserDownload(
        JSON.stringify(response.data, null, 2),
        `recete-data-export-${new Date().toISOString().split('T')[0]}.json`,
        'application/json',
      );
      toast.success(t('toasts.exportSuccess.title'), t('toasts.exportSuccess.message'));
    } catch (err) {
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (permanent: boolean) => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await authenticatedRequest<{
        message: string;
        permanent_deletion_at?: string;
      }>('/api/gdpr/delete', session.access_token, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: true, permanent }),
      });

      if (permanent) {
        toast.warning(t('toasts.deletePermanent.title'), t('toasts.deletePermanent.message'));
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        toast.error(
          t('toasts.deleteScheduled.title'),
          t('toasts.deleteScheduled.message', {
            date: new Date(response.permanent_deletion_at || '').toLocaleDateString(locale),
          }),
        );
      }
      setDialogOpen(false);
      setHardConfirmText('');
    } catch (err) {
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="r-card" style={{ maxWidth: 760 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 18, width: 200 }} />
        <div className="r-skeleton" style={{ height: 120, marginTop: 18 }} />
      </div>
    );
  }

  return (
    <div className="r-card" id="gdpr" style={{ maxWidth: 760 }}>
      <div className="r-card-title">{t('gdpr.title')}</div>
      <p className="r-hint" style={{ marginTop: 3 }}>{t('gdpr.description')}</p>

      {/* Export */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 18,
          padding: 'var(--r-space-7)',
          border: '1px solid var(--r-border)',
          borderRadius: 'var(--r-radius-md)',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 'var(--r-text-md)', fontWeight: 'var(--r-weight-semibold)' }}>
            {t('gdpr.exportTitle')}
          </div>
          <p className="r-hint" style={{ marginTop: 3 }}>{t('gdpr.exportDesc')}</p>
        </div>
        <Button variant="secondary" onClick={handleExport} loading={exporting}>
          {exporting ? t('gdpr.exporting') : t('gdpr.exportButton')}
        </Button>
      </div>

      {/* Deletion */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 12,
          padding: 'var(--r-space-7)',
          border: '1px solid var(--r-danger)',
          borderRadius: 'var(--r-radius-md)',
          background: 'var(--r-danger-bg)',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontSize: 'var(--r-text-md)',
              fontWeight: 'var(--r-weight-semibold)',
              color: 'var(--r-danger)',
            }}
          >
            {t('gdpr.deleteTitle')}
          </div>
          <p style={{ fontSize: 'var(--r-text-sm-plus)', color: 'var(--r-danger)', marginTop: 3 }}>
            {t('gdpr.deleteDesc')}
          </p>
          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--r-text-sm)',
              color: 'var(--r-danger)',
              marginTop: 6,
            }}
          >
            <AlertTriangle size={12} aria-hidden="true" />
            {t('gdpr.deleteWarning')}
          </p>
        </div>
        <Button
          ref={openerRef}
          variant="danger"
          onClick={() => setDialogOpen(true)}
          disabled={deleting}
        >
          {t('gdpr.deleteButton')}
        </Button>
      </div>

      {/* Legal links */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 'var(--r-space-7)',
          borderTop: '1px solid var(--r-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {LEGAL_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'var(--r-text-sm-plus)',
              color: 'var(--r-brand)',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} aria-hidden="true" />
            {/* "Data Processing Addendum" and "Security Overview" were hardcoded
                English while the three beside them were translated. */}
            {t(`gdpr.links.${link.key}`)}
            <span className="sr-only">{t('gdpr.links.newTab')}</span>
          </a>
        ))}
      </div>

      {dialogOpen ? (
        <div
          className="r-modal-backdrop"
          onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
        >
          {/* tabIndex so focus can land on the dialog itself when it opens. */}
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="r-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="r-modal-head">
              <h2 className="r-modal-title" id={titleId}>{t('gdpr.modal.title')}</h2>
            </div>

            <div className="r-modal-body">
              <div className="r-callout-danger">
                <p style={{ margin: 0 }}>{t('gdpr.modal.warning')}</p>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  <li>{t('gdpr.modal.list.all')}</li>
                  <li>{t('gdpr.modal.list.permanent')}</li>
                  <li>{t('gdpr.modal.list.cancel')}</li>
                </ul>
              </div>

              {/*
                Hard delete used to be the modal's secondary action, sitting right
                beside soft delete — one misclick permanently destroyed the
                merchant's entire dataset. It stays down here, separated, behind an
                exact typed phrase.
              */}
              <hr style={{ border: 0, borderTop: '1px solid var(--r-border)', margin: '18px 0' }} />

              <label className="r-label" htmlFor={fieldId}>{t('gdpr.modal.hardConfirmLabel')}</label>
              <input
                id={fieldId}
                className="r-input"
                value={hardConfirmText}
                onChange={(event) => setHardConfirmText(event.target.value)}
                placeholder={HARD_DELETE_PHRASE}
                autoComplete="off"
                disabled={deleting}
                aria-describedby={`${fieldId}-help`}
              />
              <p className="r-field-help" id={`${fieldId}-help`}>{t('gdpr.modal.hardConfirmHelp')}</p>

              <div style={{ marginTop: 12 }}>
                <Button
                  variant="danger"
                  disabled={!hardDeleteArmed}
                  loading={deleting}
                  onClick={() => handleDelete(true)}
                >
                  {t('gdpr.modal.hardDeleteAction')}
                </Button>
              </div>
            </div>

            <div className="r-modal-foot">
              <Button variant="secondary" onClick={closeDialog} disabled={deleting}>
                {t('gdpr.modal.cancel')}
              </Button>
              <Button variant="danger" onClick={() => handleDelete(false)} loading={deleting}>
                {deleting ? t('gdpr.modal.deleting') : t('gdpr.modal.softDelete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
