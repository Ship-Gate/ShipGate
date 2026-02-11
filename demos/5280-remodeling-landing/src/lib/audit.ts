/**
 * Audit logger for contact form submissions (BR-002).
 * In production, write to persistent storage or external service.
 */

export interface AuditEntry {
  timestamp: string;
  action: string;
  leadId?: string;
  metadata?: Record<string, unknown>;
}

const auditLog: AuditEntry[] = [];

export function auditLogContact(leadId: string, metadata?: Record<string, unknown>): void {
  auditLog.push({
    timestamp: new Date().toISOString(),
    action: 'contact_form_submitted',
    leadId,
    metadata: metadata ?? {},
  });
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}
