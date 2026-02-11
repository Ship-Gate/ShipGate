// ============================================================================
// ISL Standard Library - Audit Entry Builder
// @stdlib/audit/trail/entry
// ============================================================================

import { createHash, randomUUID } from 'crypto';
import type {
  AuditEntry,
  AuditEntryId,
  ActorId,
  ResourceId,
  RecordInput,
  Result,
  RecordError,
} from '../types.js';
import { Ok, Err } from '../types.js';
import { invalidInput, invalidTimestamp } from '../errors.js';

// ============================================================================
// ENTRY CREATION
// ============================================================================

export function createEntry(
  input: RecordInput,
  options?: EntryOptions,
): Result<AuditEntry, RecordError> {
  const validation = validateInput(input);
  if (!validation.ok) return validation;

  const now = new Date();
  const timestamp = input.timestamp ?? now;

  if (timestamp > now) {
    return Err(invalidTimestamp());
  }

  const id = randomUUID() as AuditEntryId;

  const entry: AuditEntry = {
    id,
    action: input.action,
    category: input.category,
    outcome: input.outcome,
    description: input.description,
    actor: {
      ...input.actor,
      id: input.actor.id as ActorId,
    },
    resource: input.resource
      ? { ...input.resource, id: input.resource.id as ResourceId }
      : undefined,
    source: input.source,
    metadata: input.metadata,
    tags: input.tags,
    changes: input.changes,
    error_code: input.error_code,
    error_message: input.error_message,
    timestamp,
    duration_ms: input.duration_ms,
    retention_until: options?.retentionUntil,
    compliance_flags: options?.complianceFlags,
    hash: options?.enableHashing !== false ? hashEntry(id, input, timestamp) : undefined,
    previous_hash: options?.previousHash,
  };

  return Ok(entry);
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateInput(input: RecordInput): Result<void, RecordError> {
  if (!input.action || input.action.length === 0) {
    return Err(invalidInput('action', 'Action is required'));
  }
  if (input.action.length > 255) {
    return Err(invalidInput('action', 'Action must be <= 255 characters'));
  }
  if (!input.actor?.id || input.actor.id.length === 0) {
    return Err(invalidInput('actor.id', 'Actor ID is required'));
  }
  if (!input.source?.service || input.source.service.length === 0) {
    return Err(invalidInput('source.service', 'Source service is required'));
  }
  if (input.resource) {
    if (!input.resource.id || input.resource.id.length === 0) {
      return Err(invalidInput('resource.id', 'Resource ID is required'));
    }
    if (!input.resource.type || input.resource.type.length === 0) {
      return Err(invalidInput('resource.type', 'Resource type is required'));
    }
  }
  if (input.duration_ms !== undefined && input.duration_ms < 0) {
    return Err(invalidInput('duration_ms', 'Duration must be >= 0'));
  }
  return Ok(undefined as void);
}

// ============================================================================
// HASHING
// ============================================================================

function hashEntry(id: string, input: RecordInput, timestamp: Date): string {
  const content = JSON.stringify({
    id,
    action: input.action,
    category: input.category,
    outcome: input.outcome,
    actor_id: input.actor.id,
    actor_type: input.actor.type,
    resource_type: input.resource?.type ?? null,
    resource_id: input.resource?.id ?? null,
    service: input.source.service,
    timestamp: timestamp.toISOString(),
  });
  return createHash('sha256').update(content).digest('hex');
}

// ============================================================================
// OPTIONS
// ============================================================================

export interface EntryOptions {
  enableHashing?: boolean;
  previousHash?: string;
  retentionUntil?: Date;
  complianceFlags?: string[];
}
