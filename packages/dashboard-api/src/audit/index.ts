// ── Audit module barrel export ──────────────────────────────────────────

export { ensureAuditSchema } from './schema.js';
export { createAuditQueries, computeHash, type AuditQueries } from './queries.js';
export { createAuditService, type AuditService } from './service.js';
export { auditRouter } from './routes.js';
export { auditRecordsToCsv } from './csv.js';

export type {
  AuditEvent,
  AuditEventType,
  AuditActor,
  AuditRecord,
  ListAuditQuery,
  ExportAuditQuery,
  VerificationRunEvent,
  SpecCreatedEvent,
  SpecModifiedEvent,
  PolicyOverrideEvent,
  ConfigChangedEvent,
  GateBypassEvent,
  ApiKeyCreatedEvent,
  ApiKeyRevokedEvent,
} from './types.js';
