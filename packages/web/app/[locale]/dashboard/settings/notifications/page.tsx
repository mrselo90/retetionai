'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  BlockStack,
  Box,
  Button as PolarisButton,
  Card as PolarisCard,
  InlineStack,
  Page,
  SkeletonPage,
  Text,
  TextField,
} from '@shopify/polaris';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Merchant {
  id: string;
  notification_phone?: string | null;
}

export default function NotificationsPage() {
  const t = useTranslations('Settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationPhone, setNotificationPhone] = useState('');

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

      const merchantResponse = await authenticatedRequest<{ merchant: Merchant }>(
        '/api/merchants/me',
        session.access_token
      );
      setNotificationPhone(merchantResponse.merchant.notification_phone || '');
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      if (status === 401) {
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.saveError.title'), t('toasts.saveError.message'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setSaving(true);
      await authenticatedRequest('/api/merchants/me', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ notification_phone: notificationPhone }),
      });
      toast.success(t('toasts.saveSuccess.title'), t('toasts.saveSuccess.message'));
    } catch (err: unknown) {
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage title="Notifications">
        <div className="h-40 bg-zinc-100 rounded-lg animate-pulse" />
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('notifications.title')} subtitle={t('notifications.description')} fullWidth>
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-warning" borderRadius="300" padding="300">
                <AlertTriangle className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  {t('notifications.title')}
                </Text>
                <Text as="p" tone="subdued">
                  {t('notifications.description')}
                </Text>
              </BlockStack>
            </InlineStack>

            <TextField
              label={t('notifications.phoneLabel')}
              type="tel"
              value={notificationPhone}
              onChange={setNotificationPhone}
              placeholder={t('notifications.phonePlaceholder')}
              autoComplete="off"
              helpText={t('notifications.phoneHint')}
            />

            <InlineStack align="end">
              <PolarisButton
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                {saving ? t('botPersona.saving') : t('botPersona.saveButton')}
              </PolarisButton>
            </InlineStack>
          </BlockStack>
        </Box>
      </PolarisCard>
    </Page>
  );
}
