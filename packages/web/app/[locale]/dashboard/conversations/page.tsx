/**
 * Right pane before a conversation is picked.
 *
 * The list itself lives in layout.tsx, so this file is only the "nothing open
 * yet" state. On narrow screens the list takes the full width and this pane is
 * hidden, which is why it carries no instructions the merchant would otherwise
 * miss.
 */

'use client';

import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/recete';

export default function ConversationsIndexPage() {
  const t = useTranslations('Conversations');

  return (
    <div className="r-thread" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState
        icon={<MessageSquare size={18} />}
        title={t('selectPrompt.title')}
        body={t('selectPrompt.description')}
      />
    </div>
  );
}
