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
  Checkbox,
  ChoiceList,
  InlineStack,
  Page,
  Select,
  SkeletonPage,
  Text,
} from '@shopify/polaris';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MultiLangRagSettings {
  shop_id: string;
  default_source_lang: string;
  enabled_langs: string[];
  multi_lang_rag_enabled: boolean;
}

const ALL_LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Turkish' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
] as const;

export default function LanguagesPage() {
  const t = useTranslations('Settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [multiLangRagSettings, setMultiLangRagSettings] = useState<MultiLangRagSettings | null>(
    null
  );
  const [multiLangEnabledLangs, setMultiLangEnabledLangs] = useState<string[]>(['en']);
  const [multiLangDefaultSourceLang, setMultiLangDefaultSourceLang] = useState<string>('en');
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);

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

      const multiLangResponse = await authenticatedRequest<{ settings: MultiLangRagSettings }>(
        '/api/merchants/me/multi-lang-rag-settings',
        session.access_token
      );
      setMultiLangRagSettings(multiLangResponse.settings);
      setMultiLangEnabledLangs(
        Array.isArray(multiLangResponse.settings.enabled_langs) &&
          multiLangResponse.settings.enabled_langs.length
          ? multiLangResponse.settings.enabled_langs
          : [multiLangResponse.settings.default_source_lang || 'en']
      );
      setMultiLangDefaultSourceLang(multiLangResponse.settings.default_source_lang || 'en');
      setMultiLangEnabled(Boolean(multiLangResponse.settings.multi_lang_rag_enabled));
    } catch (err: unknown) {
      console.error('Failed to load language settings:', err);
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
      const enabled = [...new Set([multiLangDefaultSourceLang, ...multiLangEnabledLangs])];
      const response = await authenticatedRequest<{ settings: MultiLangRagSettings }>(
        '/api/merchants/me/multi-lang-rag-settings',
        session.access_token,
        {
          method: 'PUT',
          body: JSON.stringify({
            default_source_lang: multiLangDefaultSourceLang,
            enabled_langs: enabled,
            multi_lang_rag_enabled: multiLangEnabled,
          }),
        }
      );
      setMultiLangRagSettings(response.settings);
      setMultiLangEnabledLangs(response.settings.enabled_langs);
      setMultiLangDefaultSourceLang(response.settings.default_source_lang);
      setMultiLangEnabled(Boolean(response.settings.multi_lang_rag_enabled));
      toast.success(t('toasts.multiLangSuccess.title'), t('toasts.multiLangSuccess.message'));
    } catch (err: unknown) {
      console.error('Failed to save language settings:', err);
      toast.error(
        t('toasts.multiLangError.title'),
        getErrorMessage(err, t('toasts.multiLangError.message'))
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage title={t('multilingual.title')}>
        <div className="h-64 bg-zinc-100 rounded-lg animate-pulse" />
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('multilingual.title')} subtitle={t('multilingual.description')} fullWidth>
      <PolarisCard>
        <Box id="settings-multilingual" padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-brand" borderRadius="300" padding="300">
                <Settings className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  {t('multilingual.title')}
                </Text>
                <Text as="p" tone="subdued">
                  {t('multilingual.description')}
                </Text>
              </BlockStack>
            </InlineStack>

            <Select
              label={t('multilingual.primaryLanguageLabel')}
              value={multiLangDefaultSourceLang}
              options={ALL_LANG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(value) => {
                setMultiLangDefaultSourceLang(value);
                if (!multiLangEnabledLangs.includes(value)) {
                  setMultiLangEnabledLangs((prev) => [...new Set([value, ...prev])]);
                }
              }}
            />

            <ChoiceList
              title={t('multilingual.supportedLanguagesLabel')}
              allowMultiple
              choices={ALL_LANG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              selected={multiLangEnabledLangs}
              onChange={(selected) => {
                const next = [...new Set(selected)];
                if (!next.includes(multiLangDefaultSourceLang)) {
                  next.unshift(multiLangDefaultSourceLang);
                }
                setMultiLangEnabledLangs(next);
              }}
            />

            <Checkbox
              label={t('multilingual.enableLabel')}
              helpText={t('multilingual.enableHelp')}
              checked={multiLangEnabled}
              onChange={setMultiLangEnabled}
            />

            <Box
              padding="300"
              borderWidth="025"
              borderColor="border"
              borderRadius="300"
              background="bg-surface-secondary"
            >
              <BlockStack gap="100">
                <Text as="p" variant="bodySm">
                  <strong>{t('multilingual.currentStateLabel')}</strong>{' '}
                  {multiLangRagSettings
                    ? t('multilingual.stateConfigured')
                    : t('multilingual.stateNotConfigured')}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {t('multilingual.stateHelp')}
                </Text>
              </BlockStack>
            </Box>

            <InlineStack align="end">
              <PolarisButton
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                {t('multilingual.saveButton')}
              </PolarisButton>
            </InlineStack>
          </BlockStack>
        </Box>
      </PolarisCard>
    </Page>
  );
}
