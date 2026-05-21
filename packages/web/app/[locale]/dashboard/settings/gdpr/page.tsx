'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  Banner,
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
import { AlertTriangle, Database, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function GdprPage() {
  const t = useTranslations('Settings');
  const { confirm, ConfirmDialogNode } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [exportingData, setExportingData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  useEffect(() => {
    // Just check auth, no data to load specifically for GDPR page
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/login';
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExportData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setExportingData(true);
      const response = await authenticatedRequest<{ data: unknown; exported_at: string }>(
        '/api/gdpr/export',
        session.access_token,
        { method: 'GET' }
      );

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recete-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('toasts.exportSuccess.title'), t('toasts.exportSuccess.message'));
    } catch (err: unknown) {
      console.error('Failed to export data:', err);
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteData = async (permanent: boolean = false) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setDeletingData(true);
      const response = await authenticatedRequest<{
        message: string;
        permanent_deletion_at?: string;
      }>('/api/gdpr/delete', session.access_token, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: true, permanent }),
      });

      if (permanent) {
        toast.warning(t('toasts.deletePermanent.title'), t('toasts.deletePermanent.message'));
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast.error(
          t('toasts.deleteScheduled.title'),
          t('toasts.deleteScheduled.message', {
            date: new Date(response.permanent_deletion_at || '').toLocaleDateString(),
          })
        );
      }
      setShowDeleteConfirm(false);
    } catch (err: unknown) {
      console.error('Failed to delete data:', err);
      toast.error(t('toasts.saveError.title'), getErrorMessage(err, t('toasts.saveError.message')));
    } finally {
      setDeletingData(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage title={t('gdpr.title')}>
        <div className="h-48 bg-zinc-100 rounded-lg animate-pulse" />
      </SkeletonPage>
    );
  }

  return (
    <>
      {ConfirmDialogNode}
      <Page title={t('gdpr.title')} subtitle={t('gdpr.description')} fullWidth>
        <PolarisCard>
          <Box id="gdpr" padding="400">
            <BlockStack gap="400">
              <InlineStack gap="300" blockAlign="start">
                <Box background="bg-fill-info" borderRadius="300" padding="300">
                  <Database className="w-5 h-5 text-white" />
                </Box>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    {t('gdpr.title')}
                  </Text>
                  <Text as="p" tone="subdued">
                    {t('gdpr.description')}
                  </Text>
                </BlockStack>
              </InlineStack>

              {/* Data Export */}
              <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300">
                <InlineStack align="space-between" blockAlign="start" gap="300">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">
                      {t('gdpr.exportTitle')}
                    </Text>
                    <Text as="p" tone="subdued">
                      {t('gdpr.exportDesc')}
                    </Text>
                  </BlockStack>
                  <PolarisButton
                    variant="secondary"
                    onClick={handleExportData}
                    disabled={exportingData}
                    loading={exportingData}
                  >
                    {exportingData ? t('gdpr.exporting') : t('gdpr.exportButton')}
                  </PolarisButton>
                </InlineStack>
              </Box>

              {/* Data Deletion */}
              <Box
                padding="300"
                borderWidth="025"
                borderColor="border-critical"
                borderRadius="300"
                background="bg-surface-critical"
              >
                <InlineStack align="space-between" blockAlign="start" gap="300">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm" tone="critical">
                      {t('gdpr.deleteTitle')}
                    </Text>
                    <Text as="p" tone="critical">
                      {t('gdpr.deleteDesc')}
                    </Text>
                    <InlineStack gap="100" blockAlign="center">
                      <AlertTriangle className="w-3 h-3 text-red-700" />
                      <Text as="span" variant="bodySm" tone="critical">
                        {t('gdpr.deleteWarning')}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                  <PolarisButton
                    tone="critical"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingData}
                  >
                    {t('gdpr.deleteButton')}
                  </PolarisButton>
                </InlineStack>
              </Box>

              {/* Links */}
              <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
                <div className="flex flex-wrap gap-4 text-sm">
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> {t('gdpr.links.privacy')}
                  </a>
                  <a
                    href="/terms-of-service"
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> {t('gdpr.links.terms')}
                  </a>
                  <a
                    href="/cookie-policy"
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> {t('gdpr.links.cookie')}
                  </a>
                  <a
                    href="/data-processing-addendum"
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Data Processing Addendum
                  </a>
                  <a
                    href="/security"
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Security Overview
                  </a>
                </div>
              </Box>
            </BlockStack>
          </Box>
        </PolarisCard>

        {/* Delete Confirmation Modal */}
        <Modal
          open={showDeleteConfirm}
          onClose={() => {
            if (!deletingData) setShowDeleteConfirm(false);
          }}
          title={t('gdpr.modal.title')}
          primaryAction={{
            content: deletingData ? t('gdpr.modal.deleting') : t('gdpr.modal.softDelete'),
            onAction: () => handleDeleteData(false),
            loading: deletingData,
            destructive: true,
          }}
          secondaryActions={[
            {
              content: deletingData ? t('gdpr.modal.deleting') : t('gdpr.modal.hardDelete'),
              onAction: () => handleDeleteData(true),
              destructive: true,
              disabled: deletingData,
            },
            {
              content: t('gdpr.modal.cancel'),
              onAction: () => setShowDeleteConfirm(false),
              disabled: deletingData,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Banner tone="critical">
                <p>{t('gdpr.modal.warning')}</p>
                <ul className="list-disc pl-5 mt-2">
                  <li>{t('gdpr.modal.list.all')}</li>
                  <li>{t('gdpr.modal.list.permanent')}</li>
                  <li>{t('gdpr.modal.list.cancel')}</li>
                </ul>
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
    </>
  );
}
