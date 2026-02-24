'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button, Card, Layout, Page, Text, TextField } from '@shopify/polaris';
import { ShopifySaveBar } from '@/components/ui/ShopifySaveBar';
import { InlineError } from '@/components/ui/InlineError';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';

const BOT_INFO_KEYS = ['brand_guidelines', 'bot_boundaries', 'recipe_overview', 'custom_instructions'] as const;

export default function BotInfoPage() {
  const t = useTranslations('BotInfo');
  const [botInfo, setBotInfo] = useState<Record<string, string>>({});
  const [originalBotInfo, setOriginalBotInfo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadBotInfo();
  }, []);

  const loadBotInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const res = await authenticatedRequest<{ botInfo: Record<string, string> }>(
        '/api/merchants/me/bot-info',
        session.access_token
      );
      const info = res.botInfo || {};
      setBotInfo(info);
      setOriginalBotInfo(info);
      setIsDirty(false);
      setSaveError(null);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to load bot info');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setBotInfo((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleDiscard = () => {
    setBotInfo(originalBotInfo);
    setIsDirty(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSaving(true);
      const payload: Record<string, string> = {};
      BOT_INFO_KEYS.forEach((key) => {
        payload[key] = botInfo[key] ?? '';
      });
      await authenticatedRequest('/api/merchants/me/bot-info', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ botInfo: payload }),
      });
      toast.success('Saved');
      setOriginalBotInfo(payload);
      setIsDirty(false);
      setSaveError(null);
    } catch (err: any) {
      // G4: Persistent inline error instead of auto-dismissing toast (BFS 4.2.4)
      setSaveError(err.message || t('toasts.saveError.title'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title={t('title')} subtitle={t('description')}>
      <Layout>
        <Layout.Section>
    <div className="space-y-6">
      <Card>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <Text as="h2" variant="headingMd">{t('title')}</Text>
            <div className="mt-1">
              <Text as="p" tone="subdued">{t('description')}</Text>
            </div>
          </div>
          <Button url="/dashboard/settings">{t('backToSettings')}</Button>
        </div>
      </Card>

      {/* G3: Contextual Save Bar (BFS 4.1.5) — embedded only */}
      <ShopifySaveBar
        id="bot-info-csb"
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      {/* G4: Persistent inline error (BFS 4.2.4) */}
      <InlineError message={saveError} onDismiss={() => setSaveError(null)} />

      {loading ? (
        <Card>
          <div className="p-8 text-center">
            <Text as="p" tone="subdued">{t('loading')}</Text>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {BOT_INFO_KEYS.map((key) => (
            <Card key={key}>
              <div className="p-4">
                <TextField
                  label={t(`sections.${key}.label`)}
                  multiline={5}
                  autoComplete="off"
                  placeholder={t(`sections.${key}.placeholder`)}
                  value={botInfo[key] ?? ''}
                  onChange={(value) => handleFieldChange(key, value)}
                />
              </div>
            </Card>
          ))}

          {/* Inline Save Button — standalone mode only (BFS 4.1.5) */}
          {!isShopifyEmbedded() && (
            <div className="flex justify-end">
              <Button
                variant="primary"
                disabled={saving}
                onClick={handleSave}
                loading={saving}
              >
                {saving ? t('saving') : t('saveAll')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
