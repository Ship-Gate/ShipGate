import type { AuditRecord } from './types.js';

// ── CSV export ──────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'id',
  'timestamp',
  'event_type',
  'actor_id',
  'actor_email',
  'actor_role',
  'ip',
  'hash',
  'previous_hash',
  'event_data',
  'metadata',
];

/**
 * Escapes a value for CSV output.
 * Wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts audit records to a CSV string.
 * Includes hash chain columns so the export can be independently verified.
 */
export function auditRecordsToCsv(records: AuditRecord[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')];

  for (const record of records) {
    const row = [
      record.id,
      record.timestamp,
      record.event.type,
      record.actor.id,
      record.actor.email,
      record.actor.role,
      record.ip ?? '',
      record.hash,
      record.previousHash,
      JSON.stringify(record.event),
      JSON.stringify(record.metadata),
    ];
    lines.push(row.map(escapeCsv).join(','));
  }

  return lines.join('\n');
}
