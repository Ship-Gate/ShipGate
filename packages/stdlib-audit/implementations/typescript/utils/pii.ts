// ============================================================================
// ISL Standard Library - PII Handling Utilities
// @stdlib/audit/utils/pii
// ============================================================================

import type { AuditEvent, Actor } from '../types';

// ============================================================================
// PII FIELD DEFINITIONS
// ============================================================================

const PII_FIELDS = {
  actor: ['email', 'ip_address', 'name'],
  // Add more PII field paths as needed
};

const MASK_CHAR = '*';
const REDACT_TEXT = '[REDACTED]';

// ============================================================================
// MASKING FUNCTIONS
// ============================================================================

/**
 * Mask PII fields while preserving structure
 * e.g., "user@example.com" -> "u***@e******.com"
 */
export function maskPii(event: AuditEvent): AuditEvent {
  return {
    ...event,
    actor: maskActor(event.actor),
  };
}

function maskActor(actor: Actor): Actor {
  return {
    ...actor,
    email: actor.email ? maskEmail(actor.email) : undefined,
    ip_address: actor.ip_address ? maskIpAddress(actor.ip_address) : undefined,
    name: actor.name ? maskName(actor.name) : undefined,
  };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return maskString(email);

  const maskedLocal = local.length > 2
    ? local[0] + MASK_CHAR.repeat(local.length - 2) + local[local.length - 1]
    : MASK_CHAR.repeat(local.length);

  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map((part, i) => {
    if (i === domainParts.length - 1) return part; // Keep TLD
    return part.length > 2
      ? part[0] + MASK_CHAR.repeat(part.length - 2) + part[part.length - 1]
      : MASK_CHAR.repeat(part.length);
  }).join('.');

  return `${maskedLocal}@${maskedDomain}`;
}

export function maskIpAddress(ip: string): string {
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${MASK_CHAR.repeat(3)}.${MASK_CHAR.repeat(3)}.${parts[3]}`;
    }
  }
  
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return `${parts[0]}:${MASK_CHAR.repeat(4)}:${MASK_CHAR.repeat(4)}:${parts[parts.length - 1]}`;
    }
  }

  return maskString(ip);
}

export function maskName(name: string): string {
  const parts = name.split(' ');
  return parts.map(part => {
    if (part.length <= 1) return MASK_CHAR;
    return part[0] + MASK_CHAR.repeat(part.length - 1);
  }).join(' ');
}

export function maskString(str: string, visibleChars: number = 2): string {
  if (str.length <= visibleChars * 2) {
    return MASK_CHAR.repeat(str.length);
  }
  return str.slice(0, visibleChars) + MASK_CHAR.repeat(str.length - visibleChars * 2) + str.slice(-visibleChars);
}

// ============================================================================
// REDACTION FUNCTIONS
// ============================================================================

/**
 * Completely redact PII fields
 */
export function redactPii(event: AuditEvent): AuditEvent {
  return {
    ...event,
    actor: redactActor(event.actor),
  };
}

function redactActor(actor: Actor): Actor {
  return {
    ...actor,
    email: actor.email ? REDACT_TEXT : undefined,
    ip_address: actor.ip_address ? REDACT_TEXT : undefined,
    name: actor.name ? REDACT_TEXT : undefined,
    // Keep non-PII fields
    id: actor.id,
    type: actor.type,
    session_id: actor.session_id,
    roles: actor.roles,
    organization_id: actor.organization_id,
  };
}

// ============================================================================
// PII DETECTION
// ============================================================================

/**
 * Check if an event contains PII
 */
export function containsPii(event: AuditEvent): boolean {
  const actor = event.actor;
  return !!(actor.email || actor.ip_address || actor.name);
}

/**
 * Get list of PII fields present in an event
 */
export function getPiiFields(event: AuditEvent): string[] {
  const fields: string[] = [];
  const actor = event.actor;

  if (actor.email) fields.push('actor.email');
  if (actor.ip_address) fields.push('actor.ip_address');
  if (actor.name) fields.push('actor.name');

  return fields;
}

// ============================================================================
// CUSTOM FIELD REDACTION
// ============================================================================

/**
 * Redact specific fields from event metadata
 */
export function redactFields(
  event: AuditEvent,
  fieldsToRedact: string[]
): AuditEvent {
  const result = { ...event };

  if (event.metadata) {
    result.metadata = redactObjectFields(event.metadata, fieldsToRedact);
  }

  if (event.changes) {
    result.changes = event.changes.map(change => ({
      ...change,
      old_value: fieldsToRedact.includes(change.field) ? REDACT_TEXT : change.old_value,
      new_value: fieldsToRedact.includes(change.field) ? REDACT_TEXT : change.new_value,
    }));
  }

  return result;
}

function redactObjectFields(
  obj: Record<string, unknown>,
  fieldsToRedact: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (fieldsToRedact.includes(key)) {
      result[key] = REDACT_TEXT;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObjectFields(value as Record<string, unknown>, fieldsToRedact);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// ANONYMIZATION
// ============================================================================

/**
 * Anonymize an event for analytics (hash identifiers, remove PII)
 */
export function anonymize(
  event: AuditEvent,
  hashFn: (input: string) => string
): AuditEvent {
  return {
    ...event,
    id: hashFn(event.id) as any,
    actor: {
      ...event.actor,
      id: hashFn(event.actor.id) as any,
      email: undefined,
      ip_address: undefined,
      name: undefined,
      session_id: event.actor.session_id ? hashFn(event.actor.session_id) : undefined,
    },
    resource: event.resource ? {
      ...event.resource,
      id: hashFn(event.resource.id) as any,
      owner_id: event.resource.owner_id ? hashFn(event.resource.owner_id) : undefined,
    } : undefined,
    source: {
      ...event.source,
      request_id: event.source.request_id ? hashFn(event.source.request_id) : undefined,
    },
  };
}
