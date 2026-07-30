'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, EmptyState } from '@/components/recete';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PlanGatedFeature } from '@/components/ui/PlanGatedFeature';

interface Addon {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  status: string;
  planAllowed: boolean;
}

/** Shopify recurring charges for add-ons are created in USD (lib/shopifyBilling.ts). */
const ADDON_CURRENCY = 'USD';

export default function ModulesPage() {
  const t = useTranslations('Settings');
  const rp = useTranslations('ReturnPrevention');
  const locale = useLocale();
  const { confirm, ConfirmDialogNode } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const formatPrice = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { style: 'currency', currency: ADDON_CURRENCY });
    return (amount: number) => nf.format(amount);
  }, [locale]);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const response = await authenticatedRequest<{ addons: Addon[] }>(
        '/api/billing/addons',
        session.access_token,
      );
      setAddons(response.addons || []);
      setLoadError(null);
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
        return;
      }
      // A failed request used to fall through to an empty list, so a merchant was
      // told they have no modules when in fact nothing had loaded.
      setLoadError(getErrorMessage(err, t('modules.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /**
   * Enabling subscribes to a paid add-on, so this is guarded per key and the
   * confirm step is not skippable — a double fire would bill the merchant twice.
   */
  const handleToggle = async (addon: Addon) => {
    if (submittingKey) return;
    const enabling = addon.status !== 'active';

    const ok = await confirm({
      title: enabling ? rp('enableConfirmTitle') : rp('disableConfirmTitle'),
      message: enabling ? rp('enableConfirmMessage') : rp('disableConfirmMessage'),
      confirmLabel: enabling ? rp('enableConfirmButton') : rp('disableConfirmButton'),
      cancelLabel: rp('cancel'),
    });
    if (!ok) return;

    setSubmittingKey(addon.key);
    try {
      if (enabling) {
        const response = await authenticatedRequest<{ confirmationUrl?: string }>(
          `/api/billing/addons/${addon.key}/subscribe`,
          (await supabase.auth.getSession()).data.session!.access_token,
          { method: 'POST' },
        );
        if (response.confirmationUrl) {
          // Shopify's approval screen — leaving the page is the happy path.
          window.location.href = response.confirmationUrl;
          return;
        }
      } else {
        await authenticatedRequest(
          `/api/billing/addons/${addon.key}/cancel`,
          (await supabase.auth.getSession()).data.session!.access_token,
          { method: 'POST' },
        );
      }
      await loadData();
    } catch (err) {
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      // Must reset, or the row stays locked after a failure. On the redirect path
      // the page is already leaving, so this is harmless there.
      setSubmittingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="r-card" style={{ maxWidth: 760 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 18, width: 200 }} />
        <div className="r-skeleton" style={{ height: 88, marginTop: 18 }} />
      </div>
    );
  }

  return (
    <div className="r-card" id="modules" style={{ maxWidth: 760 }}>
      {ConfirmDialogNode}

      <div className="r-card-title">{t('modules.title')}</div>
      <p className="r-hint" style={{ marginTop: 3 }}>{t('modules.description')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        {loadError ? (
          <EmptyState
            title={t('modules.loadErrorTitle')}
            body={loadError}
            action={
              <Button
                variant="secondary"
                onClick={() => { setLoading(true); void loadData(); }}
              >
                {t('modules.retry')}
              </Button>
            }
          />
        ) : addons.length === 0 ? (
          <p className="r-hint" style={{ textAlign: 'center' }}>{t('modules.empty')}</p>
        ) : (
          addons.map((addon) => {
            const active = addon.status === 'active';
            /*
             * Name and description come from the add-on itself. They used to be
             * hardcoded to the return-prevention strings for every row, so a
             * second add-on would have shown up as a duplicate of the first.
             */
            const name = addon.key === 'return_prevention' ? rp('moduleTitle') : addon.name;
            const description =
              addon.key === 'return_prevention' ? rp('moduleDescription') : addon.description;

            return (
              <PlanGatedFeature key={addon.key} isLocked={!addon.planAllowed} requiredPlan="Pro">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    padding: 'var(--r-space-8) 18px',
                    border: `1px solid ${active ? 'var(--r-success)' : 'var(--r-border)'}`,
                    borderRadius: 'var(--r-radius-lg)',
                    background: active ? 'var(--r-success-bg)' : 'var(--r-surface)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="r-table-strong" style={{ fontSize: 'var(--r-text-md)' }}>{name}</span>
                      <Badge tone={active ? 'success' : 'neutral'}>
                        {active ? rp('statusActive') : rp('statusInactive')}
                      </Badge>
                    </div>
                    <p className="r-hint" style={{ marginTop: 4 }}>{description}</p>
                    <p
                      style={{
                        fontSize: 'var(--r-text-sm-plus)',
                        fontWeight: 'var(--r-weight-semibold)',
                        color: 'var(--r-brand)',
                        marginTop: 6,
                      }}
                    >
                      {/* Was a hardcoded "$" and "/month"; the amount is real (USD),
                          the formatting and the period label now are too. */}
                      {t('modules.pricePerMonth', { price: formatPrice(addon.priceMonthly) })}
                    </p>
                  </div>
                  <Button
                    variant={active ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => handleToggle(addon)}
                    disabled={!addon.planAllowed || submittingKey !== null}
                    loading={submittingKey === addon.key}
                  >
                    {active ? rp('disableConfirmButton') : rp('enableConfirmButton')}
                  </Button>
                </div>
              </PlanGatedFeature>
            );
          })
        )}
      </div>
    </div>
  );
}
