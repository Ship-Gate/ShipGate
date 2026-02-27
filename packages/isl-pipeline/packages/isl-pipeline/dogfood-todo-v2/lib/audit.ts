/**
 * Audit logging
 * @intent audit-required
 */
export interface AuditEntry {
  action: string;
  timestamp: string;
  success: boolean;
  reason?: string;
  requestId?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  // TODO: Send to audit backend (e.g. Datadog, Splunk)
  if (process.env['NODE_ENV'] === 'development') {
    // eslint-disable-next-line no-console
    console.log('[audit]', entry);
  }
}
