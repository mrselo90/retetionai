'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  Badge as PolarisBadge,
  BlockStack,
  Box,
  Button as PolarisButton,
  Card as PolarisCard,
  InlineStack,
  Modal,
  Page,
  SkeletonPage,
  Text,
} from '@shopify/polaris';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlanGatedFeature } from '@/components/ui/PlanGatedFeature';

interface Addon {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  status: string;
  planAllowed: boolean;
}

export default function ModulesPage() {
  const t = useTranslations('Settings');
  const rp = useTranslations('ReturnPrevention');

  const [loading, setLoading] = useState(true);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [showAddonConfirm, setShowAddonConfirm] = useState<string | null>(null);
  const [addonAction, setAddonAction] = useState<'enable' | 'disable'>('enable');

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const addonsResponse = await authenticatedRequest<{ addons: Addon[] }>(
        '/api/billing/addons',
        session.access_token
      );
      setAddons(addonsResponse.addons || []);
    } catch (err: unknown) {
      console.error('Failed to load addons:', err);
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      if (status === 401) {
        window.location.href = '/login';
      } else {
        setAddons([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddonToggle = (addonKey: string, currentStatus: string) => {
    if (currentStatus === 'active') {
      setAddonAction('disable');
    } else {
      setAddonAction('enable');
    }
    setShowAddonConfirm(addonKey);
  };

  const handleAddonConfirm = async () => {
    const addonKey = showAddonConfirm;
    if (!addonKey) return;
    setShowAddonConfirm(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      if (addonAction === 'enable') {
        const response = await authenticatedRequest<{ confirmationUrl?: string }>(
          `/api/billing/addons/${addonKey}/subscribe`,
          session.access_token,
          { method: 'POST' }
        );
        if (response.confirmationUrl) {
          window.location.href = response.confirmationUrl;
          return;
        }
        await loadData();
      } else {
        await authenticatedRequest(`/api/billing/addons/${addonKey}/cancel`, session.access_token, {
          method: 'POST',
        });
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Addon action failed:', err);
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    }
  };

  if (loading) {
    return (
      <SkeletonPage title={t('modules.title')}>
        <div className="h-48 bg-zinc-100 rounded-lg animate-pulse" />
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('modules.title')} subtitle={t('modules.description')} fullWidth>
      <PolarisCard>
        <Box id="modules" padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-caution" borderRadius="300" padding="300">
                <ShieldCheck className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  {t('modules.title')}
                </Text>
                <Text as="p" tone="subdued">
                  {t('modules.description')}
                </Text>
              </BlockStack>
            </InlineStack>

            {addons.map((addon) => (
              <PlanGatedFeature key={addon.key} isLocked={!addon.planAllowed} requiredPlan="Pro">
                <div
                  className={`flex items-center justify-between p-5 rounded-xl border transition-all ${
                    addon.status === 'active'
                      ? 'bg-gradient-to-r from-success/5 to-transparent border-success/30'
                      : 'bg-gradient-to-r from-muted/50 to-transparent border-border'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-zinc-900 text-base">{rp('moduleTitle')}</p>
                      <PolarisBadge tone={addon.status === 'active' ? 'success' : undefined}>
                        {addon.status === 'active' ? rp('statusActive') : rp('statusInactive')}
                      </PolarisBadge>
                    </div>
                    <p className="text-sm text-zinc-600 mt-1">{rp('moduleDescription')}</p>
                    <p className="text-sm font-semibold text-primary mt-1.5">
                      +${addon.priceMonthly}/month
                    </p>
                  </div>
                  <PolarisButton
                    onClick={() => handleAddonToggle(addon.key, addon.status)}
                    disabled={!addon.planAllowed}
                    variant={addon.status === 'active' ? 'secondary' : 'primary'}
                    size="slim"
                  >
                    {addon.status === 'active' ? rp('disableConfirmButton') : rp('enableConfirmButton')}
                  </PolarisButton>
                </div>
              </PlanGatedFeature>
            ))}

            {addons.length === 0 && (
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {t('modules.empty')}
              </Text>
            )}
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Confirm dialog */}
      <Modal
        open={!!showAddonConfirm}
        onClose={() => setShowAddonConfirm(null)}
        title={addonAction === 'enable' ? rp('enableConfirmTitle') : rp('disableConfirmTitle')}
        primaryAction={{
          content: addonAction === 'enable' ? rp('enableConfirmButton') : rp('disableConfirmButton'),
          onAction: handleAddonConfirm,
          destructive: addonAction !== 'enable',
        }}
        secondaryActions={[
          {
            content: rp('cancel'),
            onAction: () => setShowAddonConfirm(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p" tone="subdued">
            {addonAction === 'enable' ? rp('enableConfirmMessage') : rp('disableConfirmMessage')}
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
