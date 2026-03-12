import { logger } from '@recete/shared';

type PersonalDataAuditEvent = {
  merchantId: string;
  route: string;
  action: 'read' | 'export' | 'update';
  resource: 'customer' | 'conversation' | 'gdpr_export' | 'gdpr_consent';
  authMethod?: 'jwt' | 'shopify' | 'internal';
  targetUserId?: string;
  targetConversationId?: string;
  recordCount?: number;
};

export function logPersonalDataAccess(event: PersonalDataAuditEvent) {
  logger.info(
    {
      category: 'personal_data_access',
      merchantId: event.merchantId,
      route: event.route,
      action: event.action,
      resource: event.resource,
      authMethod: event.authMethod,
      targetUserId: event.targetUserId,
      targetConversationId: event.targetConversationId,
      recordCount: event.recordCount,
    },
    'Personal data access'
  );
}
