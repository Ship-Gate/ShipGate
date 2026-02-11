// ============================================================================
// ISL Standard Library - Built-in Compliance Rules
// @stdlib/audit/compliance/rules
// ============================================================================

import type { AuditEntry } from '../types.js';
import { EventCategory, EventOutcome } from '../types.js';
import type { ComplianceRule, RuleResult, RuleSeverity } from './types.js';

// ============================================================================
// RULE FACTORY
// ============================================================================

export function createRule(config: {
  id: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  standard?: string;
  check: (entries: AuditEntry[]) => { passed: boolean; message: string; details?: string; affectedEntries?: string[] };
}): ComplianceRule {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    severity: config.severity,
    standard: config.standard,
    evaluate(entries: AuditEntry[]): RuleResult {
      const result = config.check(entries);
      return {
        ruleId: config.id,
        passed: result.passed,
        message: result.message,
        details: result.details,
        affectedEntries: result.affectedEntries,
      };
    },
  };
}

// ============================================================================
// BUILT-IN RULES
// ============================================================================

export const noGapsInAuthEvents = createRule({
  id: 'AUTH_CONTINUITY',
  name: 'Authentication Event Continuity',
  description: 'Ensures authentication events are recorded without gaps exceeding 24 hours',
  severity: 'high',
  standard: 'SOC2',
  check(entries) {
    const authEntries = entries
      .filter((e) => e.category === EventCategory.AUTHENTICATION)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (authEntries.length < 2) {
      return { passed: true, message: 'Insufficient auth events to evaluate continuity' };
    }

    const maxGapMs = 24 * 60 * 60 * 1000;
    for (let i = 1; i < authEntries.length; i++) {
      const prev = authEntries[i - 1];
      const curr = authEntries[i];
      if (!prev || !curr) continue;
      const gap = curr.timestamp.getTime() - prev.timestamp.getTime();
      if (gap > maxGapMs) {
        return {
          passed: false,
          message: `Gap of ${Math.round(gap / 3600000)}h between auth events`,
          details: `Between ${prev.id} and ${curr.id}`,
          affectedEntries: [prev.id, curr.id],
        };
      }
    }
    return { passed: true, message: 'No gaps exceeding 24h in auth events' };
  },
});

export const allEntriesHaveHash = createRule({
  id: 'INTEGRITY_HASH',
  name: 'Entry Integrity Hash Present',
  description: 'All audit entries must have a cryptographic hash for tamper detection',
  severity: 'critical',
  standard: 'SOC2',
  check(entries) {
    const missing = entries.filter((e) => !e.hash);
    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} entries missing integrity hash`,
        affectedEntries: missing.map((e) => e.id),
      };
    }
    return { passed: true, message: 'All entries have integrity hashes' };
  },
});

export const failedLoginThreshold = createRule({
  id: 'FAILED_LOGIN_RATE',
  name: 'Failed Login Rate',
  description: 'Failed login attempts should not exceed 20% of total auth events',
  severity: 'high',
  standard: 'PCI-DSS',
  check(entries) {
    const authEntries = entries.filter((e) => e.category === EventCategory.AUTHENTICATION);
    if (authEntries.length === 0) {
      return { passed: true, message: 'No auth events to evaluate' };
    }
    const failed = authEntries.filter((e) => e.outcome === EventOutcome.FAILURE);
    const rate = failed.length / authEntries.length;
    if (rate > 0.2) {
      return {
        passed: false,
        message: `Failed login rate ${(rate * 100).toFixed(1)}% exceeds 20% threshold`,
        details: `${failed.length} failures out of ${authEntries.length} auth events`,
      };
    }
    return { passed: true, message: `Failed login rate ${(rate * 100).toFixed(1)}% within threshold` };
  },
});

export const adminActionsHaveResource = createRule({
  id: 'ADMIN_RESOURCE_TRACKING',
  name: 'Admin Actions Resource Tracking',
  description: 'Admin actions must specify the affected resource',
  severity: 'medium',
  standard: 'SOX',
  check(entries) {
    const adminEntries = entries.filter((e) => e.category === EventCategory.ADMIN_ACTION);
    const missing = adminEntries.filter((e) => !e.resource);
    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} admin actions missing resource information`,
        affectedEntries: missing.map((e) => e.id),
      };
    }
    return { passed: true, message: 'All admin actions have resource tracking' };
  },
});

export const dataModificationsHaveChanges = createRule({
  id: 'DATA_MOD_CHANGES',
  name: 'Data Modification Change Tracking',
  description: 'Data modification events should include change details',
  severity: 'medium',
  standard: 'SOX',
  check(entries) {
    const modEntries = entries.filter((e) => e.category === EventCategory.DATA_MODIFICATION);
    const missing = modEntries.filter((e) => !e.changes || e.changes.length === 0);
    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} data modifications missing change details`,
        affectedEntries: missing.map((e) => e.id),
      };
    }
    return { passed: true, message: 'All data modifications have change tracking' };
  },
});

export const securityEventsHaveActor = createRule({
  id: 'SECURITY_ACTOR',
  name: 'Security Events Actor Identification',
  description: 'Security events must identify the actor',
  severity: 'critical',
  standard: 'SOC2',
  check(entries) {
    const secEntries = entries.filter((e) => e.category === EventCategory.SECURITY_EVENT);
    const missing = secEntries.filter((e) => !e.actor.id);
    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} security events missing actor identification`,
        affectedEntries: missing.map((e) => e.id),
      };
    }
    return { passed: true, message: 'All security events have actor identification' };
  },
});

// ============================================================================
// RULE SETS
// ============================================================================

export const SOC2_RULES: ComplianceRule[] = [
  noGapsInAuthEvents,
  allEntriesHaveHash,
  securityEventsHaveActor,
];

export const PCI_DSS_RULES: ComplianceRule[] = [
  allEntriesHaveHash,
  failedLoginThreshold,
  securityEventsHaveActor,
];

export const SOX_RULES: ComplianceRule[] = [
  adminActionsHaveResource,
  dataModificationsHaveChanges,
  allEntriesHaveHash,
];

export const ALL_BUILT_IN_RULES: ComplianceRule[] = [
  noGapsInAuthEvents,
  allEntriesHaveHash,
  failedLoginThreshold,
  adminActionsHaveResource,
  dataModificationsHaveChanges,
  securityEventsHaveActor,
];
