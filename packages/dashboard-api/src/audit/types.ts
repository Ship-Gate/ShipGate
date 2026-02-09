import { z } from 'zod';

// ── Audit event types ───────────────────────────────────────────────────

export const AuditEventTypeSchema = z.enum([
  'verification_run',
  'spec_created',
  'spec_modified',
  'policy_override',
  'config_changed',
  'gate_bypass',
  'api_key_created',
  'api_key_revoked',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// ── Individual event shapes ─────────────────────────────────────────────

export interface VerificationRunEvent {
  type: 'verification_run';
  verdict: string;
  score: number;
  repo: string;
  commit: string;
}

export interface SpecCreatedEvent {
  type: 'spec_created';
  file: string;
  repo: string;
  author: string;
}

export interface SpecModifiedEvent {
  type: 'spec_modified';
  file: string;
  repo: string;
  author: string;
  diff: string;
}

export interface PolicyOverrideEvent {
  type: 'policy_override';
  policy: string;
  reason: string;
  approver: string;
}

export interface ConfigChangedEvent {
  type: 'config_changed';
  field: string;
  oldValue: string;
  newValue: string;
  author: string;
}

export interface GateBypassEvent {
  type: 'gate_bypass';
  repo: string;
  commit: string;
  reason: string;
  approver: string;
}

export interface ApiKeyCreatedEvent {
  type: 'api_key_created';
  userId: string;
  keyName: string;
}

export interface ApiKeyRevokedEvent {
  type: 'api_key_revoked';
  userId: string;
  keyName: string;
  reason: string;
}

export type AuditEvent =
  | VerificationRunEvent
  | SpecCreatedEvent
  | SpecModifiedEvent
  | PolicyOverrideEvent
  | ConfigChangedEvent
  | GateBypassEvent
  | ApiKeyCreatedEvent
  | ApiKeyRevokedEvent;

// ── Actor ───────────────────────────────────────────────────────────────

export interface AuditActor {
  id: string;
  email: string;
  role: string;
}

export const AuditActorSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
});

// ── Full audit record ───────────────────────────────────────────────────

export interface AuditRecord {
  id: string;
  timestamp: string;
  event: AuditEvent;
  actor: AuditActor;
  metadata: Record<string, unknown>;
  ip?: string;
  hash: string;
  previousHash: string;
}

// ── Query params ────────────────────────────────────────────────────────

export const ListAuditQuerySchema = z.object({
  type: AuditEventTypeSchema.optional(),
  actor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;

export const ExportAuditQuerySchema = z.object({
  type: AuditEventTypeSchema.optional(),
  actor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ExportAuditQuery = z.infer<typeof ExportAuditQuerySchema>;
