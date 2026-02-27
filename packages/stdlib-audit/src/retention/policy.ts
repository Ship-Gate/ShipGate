// ============================================================================
// ISL Standard Library - Retention Policy Defaults
// @stdlib/audit/retention/policy
// ============================================================================

import { EventCategory } from '../types.js';
import type { RetentionPolicy } from './types.js';

// ============================================================================
// DEFAULT POLICIES
// ============================================================================

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    category: EventCategory.SECURITY_EVENT,
    retention_days: 365,
    archive_after_days: 90,
    compliance_standard: 'SOC2',
  },
  {
    category: EventCategory.AUTHENTICATION,
    retention_days: 365,
    archive_after_days: 90,
    compliance_standard: 'SOC2',
  },
  {
    category: EventCategory.DATA_ACCESS,
    retention_days: 365,
    archive_after_days: 90,
    compliance_standard: 'PCI-DSS',
  },
  {
    category: EventCategory.DATA_MODIFICATION,
    retention_days: 730,
    archive_after_days: 180,
    compliance_standard: 'SOX',
  },
  {
    category: EventCategory.ADMIN_ACTION,
    retention_days: 730,
    archive_after_days: 180,
    compliance_standard: 'SOX',
  },
  {
    category: EventCategory.AUTHORIZATION,
    retention_days: 90,
    compliance_standard: 'internal',
  },
  {
    category: EventCategory.SYSTEM_EVENT,
    retention_days: 30,
    compliance_standard: 'internal',
  },
];

// ============================================================================
// POLICY HELPERS
// ============================================================================

export function getPolicyForCategory(
  policies: RetentionPolicy[],
  category: EventCategory,
): RetentionPolicy | undefined {
  return policies.find((p) => p.category === category);
}

export function calculateRetentionDate(
  policy: RetentionPolicy,
  eventTimestamp: Date,
): Date {
  const d = new Date(eventTimestamp);
  d.setUTCDate(d.getUTCDate() + policy.retention_days);
  return d;
}
