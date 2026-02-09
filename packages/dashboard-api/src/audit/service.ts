import type { AuditQueries } from './queries.js';
import type { AuditEvent, AuditActor, AuditRecord } from './types.js';

// ── Audit service ───────────────────────────────────────────────────────

/**
 * High-level audit logging function.
 * Wraps the raw query layer for easy use throughout the app.
 */
export function createAuditService(auditQueries: AuditQueries) {
  /**
   * Logs an audit event with actor information.
   * This is the primary entry point for audit logging.
   */
  function logAudit(
    event: AuditEvent,
    actor: AuditActor,
    metadata: Record<string, unknown> = {},
    ip?: string,
  ): AuditRecord {
    return auditQueries.appendAuditRecord(event, actor, metadata, ip);
  }

  /**
   * Convenience: log a verification run result.
   * Call this after every verification completes.
   */
  function auditVerification(
    result: { verdict: string; score: number },
    context: { repo: string; commit: string; actor: AuditActor; ip?: string },
  ): AuditRecord {
    return logAudit(
      {
        type: 'verification_run',
        verdict: result.verdict,
        score: result.score,
        repo: context.repo,
        commit: context.commit,
      },
      context.actor,
      {},
      context.ip,
    );
  }

  /**
   * Convenience: log a gate bypass event.
   */
  function auditGateBypass(
    details: { repo: string; commit: string; reason: string; approver: string },
    actor: AuditActor,
    ip?: string,
  ): AuditRecord {
    return logAudit(
      {
        type: 'gate_bypass',
        repo: details.repo,
        commit: details.commit,
        reason: details.reason,
        approver: details.approver,
      },
      actor,
      {},
      ip,
    );
  }

  /**
   * Convenience: log a config change.
   */
  function auditConfigChange(
    details: { field: string; oldValue: string; newValue: string; author: string },
    actor: AuditActor,
    ip?: string,
  ): AuditRecord {
    return logAudit(
      {
        type: 'config_changed',
        field: details.field,
        oldValue: details.oldValue,
        newValue: details.newValue,
        author: details.author,
      },
      actor,
      {},
      ip,
    );
  }

  /**
   * Convenience: log an API key lifecycle event.
   * Note: only the key name is logged, never the actual key value.
   */
  function auditApiKeyCreated(
    details: { userId: string; keyName: string },
    actor: AuditActor,
    ip?: string,
  ): AuditRecord {
    return logAudit(
      {
        type: 'api_key_created',
        userId: details.userId,
        keyName: details.keyName,
      },
      actor,
      {},
      ip,
    );
  }

  function auditApiKeyRevoked(
    details: { userId: string; keyName: string; reason: string },
    actor: AuditActor,
    ip?: string,
  ): AuditRecord {
    return logAudit(
      {
        type: 'api_key_revoked',
        userId: details.userId,
        keyName: details.keyName,
        reason: details.reason,
      },
      actor,
      {},
      ip,
    );
  }

  return {
    logAudit,
    auditVerification,
    auditGateBypass,
    auditConfigChange,
    auditApiKeyCreated,
    auditApiKeyRevoked,
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
