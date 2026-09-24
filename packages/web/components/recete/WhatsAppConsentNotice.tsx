'use client';

/**
 * Shown where merchants set up the messages customers receive: Recete only
 * messages customers with marketing consent, so the merchant's checkout wording
 * and privacy notice have to cover WhatsApp. Links to the full checklist.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { PRIVACY_NOTICE_SNIPPET, WHATSAPP_GDPR_PATH } from '@/lib/whatsappCompliance';

export function WhatsAppConsentNotice() {
  const t = useTranslations('WhatsAppConsent');
  const [copied, setCopied] = useState(false);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(PRIVACY_NOTICE_SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="r-alert r-alert-info" role="note">
      <ShieldCheck size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <p className="r-alert-title">{t('title')}</p>
        <p className="r-alert-body">{t('body')}</p>
        <ul className="r-alert-body" style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
          <li>{t('stepCheckout')}</li>
          <li>{t('stepPrivacy')}</li>
          <li>{t('stepOptOut')}</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={WHATSAPP_GDPR_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="r-btn r-btn-secondary r-btn-sm"
          >
            {t('openChecklist')}
          </a>
          <button type="button" className="r-btn r-btn-ghost r-btn-sm" onClick={copySnippet}>
            {copied ? t('copied') : t('copySnippet')}
          </button>
        </div>
      </div>
    </div>
  );
}
