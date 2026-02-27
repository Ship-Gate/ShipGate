/**
 * ISL Studio - Audit Export
 * 
 * JSON export of violations/suppressions over time.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GateResult } from '../gate.js';
import type { Suppression } from '../suppressions.js';
import type { Exception } from './exceptions.js';

export interface AuditEntry {
  id: string;
  timestamp: string;
  type: 'gate_run' | 'suppression_added' | 'exception_granted' | 'exception_revoked';
  
  // Context
  repository?: string;
  branch?: string;
  commit?: string;
  pullRequest?: string;
  user?: string;
  
  // Gate run data
  gateResult?: {
    verdict: string;
    score: number;
    violationCount: number;
    violations: Array<{
      ruleId: string;
      message: string;
      file?: string;
      line?: number;
    }>;
  };
  
  // Suppression data
  suppression?: Suppression;
  
  // Exception data
  exception?: Exception;
  
  // Evidence
  evidenceFingerprint?: string;
}

export interface AuditLog {
  version: string;
  organization?: string;
  repository?: string;
  entries: AuditEntry[];
  exportedAt: string;
}

/**
 * Create audit entry from gate result
 */
export function createGateAuditEntry(
  result: GateResult,
  context: {
    repository?: string;
    branch?: string;
    commit?: string;
    pullRequest?: string;
    user?: string;
  }
): AuditEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'gate_run',
    ...context,
    gateResult: {
      verdict: result.verdict,
      score: result.score,
      violationCount: result.violations.length,
      violations: result.violations.map(v => ({
        ruleId: v.ruleId,
        message: v.message,
        file: v.filePath,
        line: v.line,
      })),
    },
    evidenceFingerprint: result.evidence?.fingerprint,
  };
}

/**
 * Create audit entry from suppression
 */
export function createSuppressionAuditEntry(
  suppression: Suppression,
  user?: string
): AuditEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'suppression_added',
    user,
    suppression,
  };
}

/**
 * Create audit entry from exception
 */
export function createExceptionAuditEntry(
  exception: Exception,
  type: 'exception_granted' | 'exception_revoked'
): AuditEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    user: type === 'exception_granted' ? exception.approvedBy : exception.revokedBy,
    exception,
  };
}

/**
 * Export audit log to JSON
 */
export function exportAuditLog(
  entries: AuditEntry[],
  options?: {
    organization?: string;
    repository?: string;
    startDate?: string;
    endDate?: string;
  }
): AuditLog {
  let filtered = entries;
  
  if (options?.startDate) {
    const start = new Date(options.startDate);
    filtered = filtered.filter(e => new Date(e.timestamp) >= start);
  }
  
  if (options?.endDate) {
    const end = new Date(options.endDate);
    filtered = filtered.filter(e => new Date(e.timestamp) <= end);
  }
  
  return {
    version: '1.0',
    organization: options?.organization,
    repository: options?.repository,
    entries: filtered,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Save audit log to file
 */
export async function saveAuditLog(
  log: AuditLog,
  outputPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(log, null, 2));
}

/**
 * Load audit log from file
 */
export async function loadAuditLog(inputPath: string): Promise<AuditLog | null> {
  try {
    const content = await fs.readFile(inputPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Generate audit summary
 */
export function generateAuditSummary(log: AuditLog): string {
  const lines: string[] = [];
  
  lines.push('ISL Studio Audit Summary');
  lines.push('========================\n');
  
  if (log.organization) lines.push(`Organization: ${log.organization}`);
  if (log.repository) lines.push(`Repository: ${log.repository}`);
  lines.push(`Exported: ${log.exportedAt}`);
  lines.push(`Total Entries: ${log.entries.length}\n`);
  
  // Count by type
  const byType = new Map<string, number>();
  for (const entry of log.entries) {
    byType.set(entry.type, (byType.get(entry.type) || 0) + 1);
  }
  
  lines.push('By Type:');
  for (const [type, count] of byType) {
    lines.push(`  ${type}: ${count}`);
  }
  
  // Gate run stats
  const gateRuns = log.entries.filter(e => e.type === 'gate_run' && e.gateResult);
  if (gateRuns.length > 0) {
    const ships = gateRuns.filter(e => e.gateResult?.verdict === 'SHIP').length;
    const noShips = gateRuns.filter(e => e.gateResult?.verdict === 'NO_SHIP').length;
    const avgScore = gateRuns.reduce((sum, e) => sum + (e.gateResult?.score || 0), 0) / gateRuns.length;
    
    lines.push('\nGate Run Stats:');
    lines.push(`  Total: ${gateRuns.length}`);
    lines.push(`  SHIP: ${ships} (${((ships / gateRuns.length) * 100).toFixed(1)}%)`);
    lines.push(`  NO_SHIP: ${noShips} (${((noShips / gateRuns.length) * 100).toFixed(1)}%)`);
    lines.push(`  Average Score: ${avgScore.toFixed(1)}`);
  }
  
  // Top violations
  const violationCounts = new Map<string, number>();
  for (const entry of gateRuns) {
    for (const v of entry.gateResult?.violations || []) {
      violationCounts.set(v.ruleId, (violationCounts.get(v.ruleId) || 0) + 1);
    }
  }
  
  if (violationCounts.size > 0) {
    lines.push('\nTop Violations:');
    const sorted = [...violationCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [ruleId, count] of sorted.slice(0, 5)) {
      lines.push(`  ${ruleId}: ${count}`);
    }
  }
  
  return lines.join('\n');
}
