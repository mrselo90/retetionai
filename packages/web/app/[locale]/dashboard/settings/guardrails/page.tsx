'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  Badge as PolarisBadge,
  BlockStack,
  Box,
  Button as PolarisButton,
  Card as PolarisCard,
  InlineStack,
  Modal,
  Page,
  Select,
  SkeletonPage,
  Text,
  TextField,
} from '@shopify/polaris';
import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SystemGuardrailDefinition {
  id: string;
  name: string;
  name_tr?: string;
  description: string;
  description_tr?: string;
  apply_to: 'user_message' | 'ai_response' | 'both';
  action: 'block' | 'escalate';
  editable: false;
}

interface CustomGuardrail {
  id: string;
  name: string;
  description?: string;
  apply_to: 'user_message' | 'ai_response' | 'both';
  match_type: 'keywords' | 'phrase';
  value: string[] | string;
  action: 'block' | 'escalate';
  suggested_response?: string;
}

export default function GuardrailsPage() {
  const t = useTranslations('Settings');
  const { confirm, ConfirmDialogNode } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [systemGuardrails, setSystemGuardrails] = useState<SystemGuardrailDefinition[]>([]);
  const [customGuardrails, setCustomGuardrails] = useState<CustomGuardrail[]>([]);
  const [savingGuardrails, setSavingGuardrails] = useState(false);
  const [showGuardrailModal, setShowGuardrailModal] = useState(false);
  const [editingGuardrail, setEditingGuardrail] = useState<CustomGuardrail | null>(null);

  // Modal form state
  const [guardrailName, setGuardrailName] = useState('');
  const [guardrailDescription, setGuardrailDescription] = useState('');
  const [guardrailApplyTo, setGuardrailApplyTo] = useState<'user_message' | 'ai_response' | 'both'>('both');
  const [guardrailMatchType, setGuardrailMatchType] = useState<'keywords' | 'phrase'>('keywords');
  const [guardrailValue, setGuardrailValue] = useState('');
  const [guardrailAction, setGuardrailAction] = useState<'block' | 'escalate'>('block');
  const [guardrailSuggestedResponse, setGuardrailSuggestedResponse] = useState('');

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

      const guardrailsResponse = await authenticatedRequest<{
        system_guardrails: SystemGuardrailDefinition[];
        custom_guardrails: CustomGuardrail[];
      }>('/api/merchants/me/guardrails', session.access_token);
      setSystemGuardrails(guardrailsResponse.system_guardrails ?? []);
      setCustomGuardrails(guardrailsResponse.custom_guardrails ?? []);
    } catch (err: unknown) {
      console.error('Failed to load guardrails:', err);
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

  const openAddGuardrail = () => {
    setEditingGuardrail(null);
    setGuardrailName('');
    setGuardrailDescription('');
    setGuardrailApplyTo('both');
    setGuardrailMatchType('keywords');
    setGuardrailValue('');
    setGuardrailAction('block');
    setGuardrailSuggestedResponse('');
    setShowGuardrailModal(true);
  };

  const openEditGuardrail = (g: CustomGuardrail) => {
    setEditingGuardrail(g);
    setGuardrailName(g.name);
    setGuardrailDescription(g.description ?? '');
    setGuardrailApplyTo(g.apply_to);
    setGuardrailMatchType(g.match_type);
    setGuardrailValue(Array.isArray(g.value) ? g.value.join(', ') : (g.value ?? ''));
    setGuardrailAction(g.action);
    setGuardrailSuggestedResponse(g.suggested_response ?? '');
    setShowGuardrailModal(true);
  };

  const closeGuardrailModal = () => {
    setShowGuardrailModal(false);
    setEditingGuardrail(null);
  };

  const handleSaveGuardrail = async () => {
    const name = guardrailName.trim();
    if (!name) {
      toast.error(t('toasts.guardrailError.title'), t('guardrails.modal.nameLabel'));
      return;
    }
    const valueStr = guardrailValue.trim();
    if (!valueStr) {
      toast.error(t('toasts.guardrailError.title'), t('guardrails.modal.valueLabel'));
      return;
    }
    const value: string[] | string =
      guardrailMatchType === 'phrase'
        ? valueStr
        : valueStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    if (guardrailMatchType === 'keywords' && Array.isArray(value) && value.length === 0) {
      toast.error(t('toasts.guardrailError.title'), t('guardrails.modal.valueLabel'));
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setSavingGuardrails(true);
      const id = editingGuardrail?.id ?? `custom-${Date.now()}`;
      const next: CustomGuardrail[] = editingGuardrail
        ? customGuardrails.map((g) =>
            g.id === editingGuardrail.id
              ? {
                  id,
                  name,
                  description: guardrailDescription.trim() || undefined,
                  apply_to: guardrailApplyTo,
                  match_type: guardrailMatchType,
                  value,
                  action: guardrailAction,
                  suggested_response: guardrailSuggestedResponse.trim() || undefined,
                }
              : g
          )
        : [
            ...customGuardrails,
            {
              id,
              name,
              description: guardrailDescription.trim() || undefined,
              apply_to: guardrailApplyTo,
              match_type: guardrailMatchType,
              value,
              action: guardrailAction,
              suggested_response: guardrailSuggestedResponse.trim() || undefined,
            },
          ];
      await authenticatedRequest('/api/merchants/me/guardrails', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ custom_guardrails: next }),
      });
      setCustomGuardrails(next);
      toast.success(t('toasts.guardrailSuccess.title'), t('toasts.guardrailSuccess.message'));
      closeGuardrailModal();
    } catch (err: unknown) {
      toast.error(
        t('toasts.guardrailError.title'),
        getErrorMessage(err, t('toasts.guardrailError.message'))
      );
    } finally {
      setSavingGuardrails(false);
    }
  };

  const handleDeleteGuardrail = async (id: string) => {
    const ok = await confirm({
      title: t('guardrails.delete'),
      message: 'This action cannot be undone.',
      confirmLabel: t('guardrails.delete'),
      destructive: true,
    });
    if (!ok) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setSavingGuardrails(true);
      const next = customGuardrails.filter((g) => g.id !== id);
      await authenticatedRequest('/api/merchants/me/guardrails', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ custom_guardrails: next }),
      });
      setCustomGuardrails(next);
      toast.success(t('toasts.guardrailSuccess.title'), t('toasts.guardrailSuccess.message'));
    } catch (err: unknown) {
      toast.error(
        t('toasts.guardrailError.title'),
        getErrorMessage(err, t('toasts.guardrailError.message'))
      );
    } finally {
      setSavingGuardrails(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage title={t('guardrails.title')}>
        <div className="h-64 bg-zinc-100 rounded-lg animate-pulse" />
      </SkeletonPage>
    );
  }

  return (
    <>
      {ConfirmDialogNode}
      <Page title={t('guardrails.title')} subtitle={t('guardrails.description')} fullWidth>
        <PolarisCard>
          <Box id="guardrails" padding="400">
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="start" gap="300">
                <InlineStack gap="300" blockAlign="start">
                  <Box background="bg-fill-success" borderRadius="300" padding="300">
                    <Shield className="w-5 h-5 text-white" />
                  </Box>
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      {t('guardrails.title')}
                    </Text>
                    <Text as="p" tone="subdued">
                      {t('guardrails.description')}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <PolarisButton onClick={openAddGuardrail} variant="primary">
                  {t('guardrails.addButton')}
                </PolarisButton>
              </InlineStack>

              {/* System guardrails (read-only) */}
              <div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    {t('guardrails.systemTitle')}
                  </Text>
                  <ul className="space-y-3">
                    {systemGuardrails.map((g) => (
                      <li
                        key={g.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50/80"
                      >
                        <Box padding="300">
                          <InlineStack gap="300" blockAlign="start">
                            <Text as="span" tone="subdued">
                              🔒
                            </Text>
                            <BlockStack gap="100">
                              <InlineStack gap="200" blockAlign="center">
                                <Text as="p" variant="bodyMd" fontWeight="medium">
                                  {g.name}
                                </Text>
                                <PolarisBadge tone={g.action === 'block' ? 'critical' : 'warning'}>
                                  {g.action}
                                </PolarisBadge>
                              </InlineStack>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {g.description}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {t('guardrails.application', {
                                  type:
                                    g.apply_to === 'both'
                                      ? t('guardrails.types.both')
                                      : g.apply_to === 'user_message'
                                        ? t('guardrails.types.user_message')
                                        : t('guardrails.types.ai_response'),
                                  action:
                                    g.action === 'escalate'
                                      ? t('guardrails.actions.escalate')
                                      : t('guardrails.actions.block'),
                                })}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </Box>
                      </li>
                    ))}
                  </ul>
                </BlockStack>
              </div>

              {/* Custom guardrails */}
              <div>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    {t('guardrails.customTitle')}
                  </Text>
                  {customGuardrails.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-4">{t('guardrails.empty')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {customGuardrails.map((g) => (
                        <li key={g.id} className="rounded-lg border border-zinc-200 bg-white">
                          <Box padding="300">
                            <InlineStack align="space-between" blockAlign="start" gap="300">
                              <BlockStack gap="100">
                                <Text as="p" variant="bodyMd" fontWeight="medium">
                                  {g.name}
                                </Text>
                                {g.description && (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    {g.description}
                                  </Text>
                                )}
                                <Text as="p" variant="bodySm" tone="subdued">
                                  {g.match_type === 'keywords'
                                    ? `${t('guardrails.modal.matchTypes.keywords')}: ${Array.isArray(g.value) ? g.value.join(', ') : g.value}`
                                    : `${t('guardrails.modal.matchTypes.phrase')}: ${typeof g.value === 'string' ? g.value : Array.isArray(g.value) ? g.value[0] : ''}`}
                                  {' · '}
                                  {t('guardrails.application', {
                                    type:
                                      g.apply_to === 'both'
                                        ? t('guardrails.types.both')
                                        : g.apply_to === 'user_message'
                                          ? t('guardrails.types.user_message')
                                          : t('guardrails.types.ai_response'),
                                    action:
                                      g.action === 'escalate'
                                        ? t('guardrails.actions.escalate')
                                        : t('guardrails.actions.block'),
                                  })}
                                </Text>
                              </BlockStack>
                              <InlineStack gap="200">
                                <PolarisButton
                                  onClick={() => openEditGuardrail(g)}
                                  variant="secondary"
                                  size="slim"
                                >
                                  {t('guardrails.edit')}
                                </PolarisButton>
                                <PolarisButton
                                  onClick={() => handleDeleteGuardrail(g.id)}
                                  disabled={savingGuardrails}
                                  tone="critical"
                                  size="slim"
                                >
                                  {t('guardrails.delete')}
                                </PolarisButton>
                              </InlineStack>
                            </InlineStack>
                          </Box>
                        </li>
                      ))}
                    </ul>
                  )}
                </BlockStack>
              </div>
            </BlockStack>
          </Box>
        </PolarisCard>

        {/* Add/Edit Modal */}
        <Modal
          open={showGuardrailModal}
          onClose={() => {
            if (!savingGuardrails) closeGuardrailModal();
          }}
          title={
            editingGuardrail ? t('guardrails.modal.titleEdit') : t('guardrails.modal.titleAdd')
          }
          primaryAction={{
            content: savingGuardrails
              ? t('guardrails.modal.saving')
              : t('guardrails.modal.save'),
            onAction: handleSaveGuardrail,
            loading: savingGuardrails,
            disabled: savingGuardrails,
          }}
          secondaryActions={[
            {
              content: t('guardrails.modal.cancel'),
              onAction: closeGuardrailModal,
              disabled: savingGuardrails,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label={t('guardrails.modal.nameLabel')}
                value={guardrailName}
                onChange={setGuardrailName}
                placeholder={t('guardrails.modal.namePlaceholder')}
                autoComplete="off"
              />
              <TextField
                label={t('guardrails.modal.descLabel')}
                value={guardrailDescription}
                onChange={setGuardrailDescription}
                placeholder={t('guardrails.modal.descPlaceholder')}
                autoComplete="off"
              />
              <Select
                label={t('guardrails.modal.applyToLabel')}
                options={[
                  { label: t('guardrails.types.both'), value: 'both' },
                  { label: t('guardrails.types.user_message'), value: 'user_message' },
                  { label: t('guardrails.types.ai_response'), value: 'ai_response' },
                ]}
                value={guardrailApplyTo}
                onChange={(value) =>
                  setGuardrailApplyTo(value as 'user_message' | 'ai_response' | 'both')
                }
              />
              <Select
                label={t('guardrails.modal.matchTypeLabel')}
                options={[
                  { label: t('guardrails.modal.matchTypes.keywords'), value: 'keywords' },
                  { label: t('guardrails.modal.matchTypes.phrase'), value: 'phrase' },
                ]}
                value={guardrailMatchType}
                onChange={(value) => setGuardrailMatchType(value as 'keywords' | 'phrase')}
              />
              <TextField
                label={t('guardrails.modal.valueLabel')}
                value={guardrailValue}
                onChange={setGuardrailValue}
                placeholder={
                  guardrailMatchType === 'keywords'
                    ? t('guardrails.modal.keywordsPlaceholder')
                    : t('guardrails.modal.phrasePlaceholder')
                }
                autoComplete="off"
              />
              <Select
                label={t('guardrails.modal.actionLabel')}
                options={[
                  { label: t('guardrails.actions.block'), value: 'block' },
                  { label: t('guardrails.actions.escalate'), value: 'escalate' },
                ]}
                value={guardrailAction}
                onChange={(value) => setGuardrailAction(value as 'block' | 'escalate')}
              />
              <TextField
                label={t('guardrails.modal.responseLabel')}
                value={guardrailSuggestedResponse}
                onChange={setGuardrailSuggestedResponse}
                placeholder={t('guardrails.modal.responsePlaceholder')}
                multiline={2}
                autoComplete="off"
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
    </>
  );
}
