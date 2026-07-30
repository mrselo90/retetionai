'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button } from '@/components/recete';

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

const emptyForm = {
  name: '',
  description: '',
  applyTo: 'both' as CustomGuardrail['apply_to'],
  matchType: 'keywords' as CustomGuardrail['match_type'],
  value: '',
  action: 'block' as CustomGuardrail['action'],
  suggestedResponse: '',
};

export default function GuardrailsPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const fieldPrefix = useId();
  const titleId = useId();
  const { confirm, ConfirmDialogNode } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [systemGuardrails, setSystemGuardrails] = useState<SystemGuardrailDefinition[]>([]);
  const [customGuardrails, setCustomGuardrails] = useState<CustomGuardrail[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const response = await authenticatedRequest<{
        system_guardrails: SystemGuardrailDefinition[];
        custom_guardrails: CustomGuardrail[];
      }>('/api/merchants/me/guardrails', session.access_token);
      setSystemGuardrails(response.system_guardrails ?? []);
      setCustomGuardrails(response.custom_guardrails ?? []);
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
        return;
      }
      toast.error(t('toasts.saveError.title'), t('toasts.saveError.message'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /** API ships Turkish translations for both built-in guardrails; the page just never read them. */
  const systemName = (g: SystemGuardrailDefinition) => (locale === 'tr' && g.name_tr ? g.name_tr : g.name);
  const systemDescription = (g: SystemGuardrailDefinition) =>
    locale === 'tr' && g.description_tr ? g.description_tr : g.description;

  const applyToLabel = (value: CustomGuardrail['apply_to']) =>
    value === 'both' ? t('guardrails.types.both')
      : value === 'user_message' ? t('guardrails.types.user_message')
      : t('guardrails.types.ai_response');

  const actionLabel = (value: CustomGuardrail['action']) =>
    value === 'escalate' ? t('guardrails.actions.escalate') : t('guardrails.actions.block');

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (g: CustomGuardrail) => {
    setEditingId(g.id);
    setForm({
      name: g.name,
      description: g.description ?? '',
      applyTo: g.apply_to,
      matchType: g.match_type,
      value: Array.isArray(g.value) ? g.value.join(', ') : g.value ?? '',
      action: g.action,
      suggestedResponse: g.suggested_response ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
  };

  /**
   * PUTs the entire array, replacing whatever the server has. Two tabs editing
   * guardrails at once will silently clobber each other's changes — the second
   * save wins outright, with no conflict signal to either tab. Fixing that needs
   * the endpoint to accept a per-guardrail patch or a version check; out of scope
   * for this pass, which is presentation only.
   */
  const persist = async (next: CustomGuardrail[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    setSaving(true);
    try {
      await authenticatedRequest('/api/merchants/me/guardrails', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ custom_guardrails: next }),
      });
      setCustomGuardrails(next);
      return true;
    } catch (err) {
      toast.error(t('toasts.guardrailError.title'), getErrorMessage(err, t('toasts.guardrailError.message')));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const name = form.name.trim();
    // These used to report the field's own label as the error — a toast titled
    // "Could not save" whose body just said "Name", with no indication that the
    // name was missing rather than merely mentioned.
    if (!name) {
      setFormError(t('guardrails.modal.nameRequired'));
      return;
    }
    const valueStr = form.value.trim();
    if (!valueStr) {
      setFormError(t('guardrails.modal.valueRequired'));
      return;
    }
    const value: string[] | string =
      form.matchType === 'phrase' ? valueStr : valueStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (form.matchType === 'keywords' && Array.isArray(value) && value.length === 0) {
      setFormError(t('guardrails.modal.valueRequired'));
      return;
    }
    setFormError(null);

    const id = editingId ?? `custom-${crypto.randomUUID()}`;
    const record: CustomGuardrail = {
      id,
      name,
      description: form.description.trim() || undefined,
      apply_to: form.applyTo,
      match_type: form.matchType,
      value,
      action: form.action,
      suggested_response: form.suggestedResponse.trim() || undefined,
    };
    const next = editingId
      ? customGuardrails.map((g) => (g.id === editingId ? record : g))
      : [...customGuardrails, record];

    if (await persist(next)) {
      toast.success(t('toasts.guardrailSuccess.title'), t('toasts.guardrailSuccess.message'));
      setModalOpen(false);
      setEditingId(null);
    }
  };

  const handleDelete = async (g: CustomGuardrail) => {
    const ok = await confirm({
      title: t('guardrails.modal.deleteConfirmTitle', { name: g.name }),
      message: t('guardrails.modal.deleteConfirmMessage'),
      confirmLabel: t('guardrails.delete'),
      destructive: true,
    });
    if (!ok) return;

    if (await persist(customGuardrails.filter((item) => item.id !== g.id))) {
      toast.success(t('toasts.guardrailSuccess.title'), t('toasts.guardrailSuccess.message'));
    }
  };

  if (loading) {
    return (
      <div className="r-card" style={{ maxWidth: 760 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 18, width: 200 }} />
        <div className="r-skeleton" style={{ height: 140, marginTop: 18 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {ConfirmDialogNode}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="r-card-title">{t('guardrails.title')}</div>
          <p className="r-hint" style={{ marginTop: 3 }}>{t('guardrails.description')}</p>
        </div>
        <Button variant="primary" onClick={openAdd}>{t('guardrails.addButton')}</Button>
      </div>

      <div>
        <p className="r-eyebrow" style={{ display: 'block', marginBottom: 10 }}>{t('guardrails.systemTitle')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {systemGuardrails.map((g) => (
            <div key={g.id} className="r-card" style={{ background: 'var(--r-bg)', padding: 'var(--r-space-7)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <span aria-hidden="true">🔒</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="r-table-strong">{systemName(g)}</span>
                    <Badge tone={g.action === 'block' ? 'danger' : 'warning'}>{actionLabel(g.action)}</Badge>
                  </div>
                  <p className="r-hint" style={{ marginTop: 3 }}>{systemDescription(g)}</p>
                  <p className="r-hint" style={{ marginTop: 3 }}>
                    {t('guardrails.application', { type: applyToLabel(g.apply_to), action: actionLabel(g.action) })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="r-eyebrow" style={{ display: 'block', marginBottom: 10 }}>{t('guardrails.customTitle')}</p>
        {customGuardrails.length === 0 ? (
          <p className="r-hint">{t('guardrails.empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customGuardrails.map((g) => (
              <div key={g.id} className="r-card" style={{ padding: 'var(--r-space-7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <span className="r-table-strong">{g.name}</span>
                    {g.description ? <p className="r-hint" style={{ marginTop: 3 }}>{g.description}</p> : null}
                    <p className="r-hint" style={{ marginTop: 3 }}>
                      {g.match_type === 'keywords'
                        ? `${t('guardrails.modal.matchTypes.keywords')}: ${Array.isArray(g.value) ? g.value.join(', ') : g.value}`
                        : `${t('guardrails.modal.matchTypes.phrase')}: ${typeof g.value === 'string' ? g.value : Array.isArray(g.value) ? g.value[0] : ''}`}
                      {' · '}
                      {t('guardrails.application', { type: applyToLabel(g.apply_to), action: actionLabel(g.action) })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(g)}>{t('guardrails.edit')}</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(g)} disabled={saving}>
                      {t('guardrails.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="r-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="r-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="r-modal-head">
              <h2 className="r-modal-title" id={titleId}>
                {editingId ? t('guardrails.modal.titleEdit') : t('guardrails.modal.titleAdd')}
              </h2>
            </div>
            <div className="r-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
              {formError ? <p className="r-field-error" style={{ margin: 0 }}>{formError}</p> : null}

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-name`}>{t('guardrails.modal.nameLabel')}</label>
                <input
                  id={`${fieldPrefix}-name`}
                  className="r-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('guardrails.modal.namePlaceholder')}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-desc`}>{t('guardrails.modal.descLabel')}</label>
                <input
                  id={`${fieldPrefix}-desc`}
                  className="r-input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t('guardrails.modal.descPlaceholder')}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-apply`}>{t('guardrails.modal.applyToLabel')}</label>
                <select
                  id={`${fieldPrefix}-apply`}
                  className="r-select"
                  value={form.applyTo}
                  onChange={(e) => setForm((f) => ({ ...f, applyTo: e.target.value as CustomGuardrail['apply_to'] }))}
                >
                  <option value="both">{t('guardrails.types.both')}</option>
                  <option value="user_message">{t('guardrails.types.user_message')}</option>
                  <option value="ai_response">{t('guardrails.types.ai_response')}</option>
                </select>
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-match`}>{t('guardrails.modal.matchTypeLabel')}</label>
                <select
                  id={`${fieldPrefix}-match`}
                  className="r-select"
                  value={form.matchType}
                  onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value as CustomGuardrail['match_type'] }))}
                >
                  <option value="keywords">{t('guardrails.modal.matchTypes.keywords')}</option>
                  <option value="phrase">{t('guardrails.modal.matchTypes.phrase')}</option>
                </select>
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-value`}>{t('guardrails.modal.valueLabel')}</label>
                <input
                  id={`${fieldPrefix}-value`}
                  className="r-input"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder={form.matchType === 'keywords' ? t('guardrails.modal.keywordsPlaceholder') : t('guardrails.modal.phrasePlaceholder')}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-action`}>{t('guardrails.modal.actionLabel')}</label>
                <select
                  id={`${fieldPrefix}-action`}
                  className="r-select"
                  value={form.action}
                  onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as CustomGuardrail['action'] }))}
                >
                  <option value="block">{t('guardrails.actions.block')}</option>
                  <option value="escalate">{t('guardrails.actions.escalate')}</option>
                </select>
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-response`}>{t('guardrails.modal.responseLabel')}</label>
                <textarea
                  id={`${fieldPrefix}-response`}
                  className="r-textarea"
                  rows={2}
                  value={form.suggestedResponse}
                  onChange={(e) => setForm((f) => ({ ...f, suggestedResponse: e.target.value }))}
                  placeholder={t('guardrails.modal.responsePlaceholder')}
                />
              </div>
            </div>
            <div className="r-modal-foot">
              <Button variant="secondary" onClick={closeModal} disabled={saving}>{t('guardrails.modal.cancel')}</Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {saving ? t('guardrails.modal.saving') : t('guardrails.modal.save')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
