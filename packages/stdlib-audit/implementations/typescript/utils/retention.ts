// ============================================================================
// ISL Standard Library - Retention Management
// @stdlib/audit/utils/retention
// ============================================================================

import {
  EventCategory,
  type AuditStorage,
  type RetentionPolicy,
  type AuditEvent,
} from '../types';

// ============================================================================
// DEFAULT RETENTION POLICIES
// ============================================================================

/**
 * Default retention policies based on common compliance requirements
 */
export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  // SOC2 / Security events: 1 year
  {
    category: EventCategory.SECURITY_EVENT,
    retention_days: 365,
    archive_after_days: 90,
    compliance_standard: 'SOC2',
  },
  // Authentication: 1 year
  {
    category: EventCategory.AUTHENTICATION,
    retention_days: 365,
    archive_after_days: 90,
    compliance_standard: 'SOC2',
  },
  // PCI-DSS / Data access: 1 year readily available
  {
    category: EventCategory.DATA_ACCESS,
    retention_days: 365,
    archive_after_days: 90,
    compliance_standard: 'PCI-DSS',
  },
  // Data modifications: 2 years for audit trail
  {
    category: EventCategory.DATA_MODIFICATION,
    retention_days: 730,
    archive_after_days: 180,
    compliance_standard: 'SOX',
  },
  // Admin actions: 2 years
  {
    category: EventCategory.ADMIN_ACTION,
    retention_days: 730,
    archive_after_days: 180,
    compliance_standard: 'SOX',
  },
  // Authorization: 90 days
  {
    category: EventCategory.AUTHORIZATION,
    retention_days: 90,
    compliance_standard: 'internal',
  },
  // System events: 30 days
  {
    category: EventCategory.SYSTEM_EVENT,
    retention_days: 30,
    compliance_standard: 'internal',
  },
];

// ============================================================================
// RETENTION MANAGER
// ============================================================================

export interface RetentionManagerOptions {
  storage: AuditStorage;
  policies?: RetentionPolicy[];
  archiver?: Archiver;
  
  // Scheduling
  runIntervalHours?: number;
  
  // Callbacks
  onArchive?: (events: AuditEvent[], destination: string) => void;
  onDelete?: (count: number) => void;
  onError?: (error: Error, context: string) => void;
}

export interface Archiver {
  archive(events: AuditEvent[]): Promise<string>;
}

export class RetentionManager {
  private storage: AuditStorage;
  private policies: Map<EventCategory, RetentionPolicy>;
  private archiver?: Archiver;
  private options: RetentionManagerOptions;
  private intervalId?: NodeJS.Timeout;

  constructor(options: RetentionManagerOptions) {
    this.storage = options.storage;
    this.archiver = options.archiver;
    this.options = options;

    // Build policy map
    this.policies = new Map();
    const policies = options.policies ?? DEFAULT_RETENTION_POLICIES;
    for (const policy of policies) {
      this.policies.set(policy.category, policy);
    }
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Start the retention manager with scheduled runs
   */
  start(): void {
    const intervalHours = this.options.runIntervalHours ?? 24;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Run immediately
    this.run().catch(err => {
      this.options.onError?.(err as Error, 'scheduled_run');
    });

    // Schedule future runs
    this.intervalId = setInterval(() => {
      this.run().catch(err => {
        this.options.onError?.(err as Error, 'scheduled_run');
      });
    }, intervalMs);
  }

  /**
   * Stop the retention manager
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  // ==========================================================================
  // MAIN OPERATIONS
  // ==========================================================================

  /**
   * Run retention processing
   */
  async run(): Promise<RetentionRunResult> {
    const result: RetentionRunResult = {
      archived: 0,
      deleted: 0,
      errors: [],
      startedAt: new Date(),
    };

    try {
      // Process each category
      for (const [category, policy] of this.policies) {
        const categoryResult = await this.processCategory(category, policy);
        result.archived += categoryResult.archived;
        result.deleted += categoryResult.deleted;
        if (categoryResult.error) {
          result.errors.push({
            category,
            error: categoryResult.error,
          });
        }
      }
    } catch (error) {
      this.options.onError?.(error as Error, 'run');
    }

    result.completedAt = new Date();
    return result;
  }

  /**
   * Process retention for a specific category
   */
  private async processCategory(
    category: EventCategory,
    policy: RetentionPolicy
  ): Promise<CategoryResult> {
    const result: CategoryResult = { archived: 0, deleted: 0 };

    try {
      const now = new Date();

      // Archive events if archiver is configured
      if (this.archiver && policy.archive_after_days) {
        const archiveDate = new Date(now);
        archiveDate.setDate(archiveDate.getDate() - policy.archive_after_days);
        
        const toArchive = await this.getEventsToArchive(category, archiveDate);
        if (toArchive.length > 0) {
          const destination = await this.archiver.archive(toArchive);
          result.archived = toArchive.length;
          this.options.onArchive?.(toArchive, destination);
        }
      }

      // Delete events past retention
      const deleteDate = new Date(now);
      deleteDate.setDate(deleteDate.getDate() - policy.retention_days);
      
      const deleted = await this.storage.deleteOlderThan(deleteDate);
      result.deleted = deleted;
      this.options.onDelete?.(deleted);

    } catch (error) {
      result.error = (error as Error).message;
      this.options.onError?.(error as Error, `process_${category}`);
    }

    return result;
  }

  /**
   * Get events that should be archived
   */
  private async getEventsToArchive(
    category: EventCategory,
    beforeDate: Date
  ): Promise<AuditEvent[]> {
    const result = await this.storage.query({
      filters: {
        category,
        timestamp_end: beforeDate,
      },
      pagination: { page: 1, page_size: 10000 },
    });
    return result.events;
  }

  // ==========================================================================
  // POLICY MANAGEMENT
  // ==========================================================================

  /**
   * Get the retention policy for a category
   */
  getPolicy(category: EventCategory): RetentionPolicy | undefined {
    return this.policies.get(category);
  }

  /**
   * Set or update a retention policy
   */
  setPolicy(policy: RetentionPolicy): void {
    this.policies.set(policy.category, policy);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Calculate retention date for an event
   */
  calculateRetentionDate(category: EventCategory, timestamp: Date): Date {
    const policy = this.policies.get(category);
    const days = policy?.retention_days ?? 90; // Default 90 days
    
    const retention = new Date(timestamp);
    retention.setDate(retention.getDate() + days);
    return retention;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface RetentionRunResult {
  archived: number;
  deleted: number;
  errors: Array<{ category: EventCategory; error: string }>;
  startedAt: Date;
  completedAt?: Date;
}

interface CategoryResult {
  archived: number;
  deleted: number;
  error?: string;
}

// ============================================================================
// COMPLIANCE HELPERS
// ============================================================================

/**
 * Check if retention policies meet compliance requirements
 */
export function validateCompliance(
  policies: RetentionPolicy[],
  standard: 'SOC2' | 'PCI-DSS' | 'HIPAA' | 'SOX' | 'GDPR'
): ComplianceValidationResult {
  const issues: ComplianceIssue[] = [];

  const requirements = getComplianceRequirements(standard);
  
  for (const req of requirements) {
    const policy = policies.find(p => p.category === req.category);
    
    if (!policy) {
      issues.push({
        category: req.category,
        severity: 'error',
        message: `Missing retention policy for ${req.category}`,
        requirement: `${standard} requires retention for ${req.category}`,
      });
      continue;
    }

    if (policy.retention_days < req.minRetentionDays) {
      issues.push({
        category: req.category,
        severity: 'error',
        message: `Retention of ${policy.retention_days} days is below minimum of ${req.minRetentionDays}`,
        requirement: `${standard} requires minimum ${req.minRetentionDays} days`,
      });
    }
  }

  return {
    compliant: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    standard,
  };
}

function getComplianceRequirements(standard: string): ComplianceRequirement[] {
  switch (standard) {
    case 'SOC2':
      return [
        { category: EventCategory.SECURITY_EVENT, minRetentionDays: 365 },
        { category: EventCategory.AUTHENTICATION, minRetentionDays: 365 },
        { category: EventCategory.DATA_ACCESS, minRetentionDays: 365 },
      ];
    case 'PCI-DSS':
      return [
        { category: EventCategory.SECURITY_EVENT, minRetentionDays: 365 },
        { category: EventCategory.AUTHENTICATION, minRetentionDays: 365 },
        { category: EventCategory.DATA_ACCESS, minRetentionDays: 365 },
        { category: EventCategory.ADMIN_ACTION, minRetentionDays: 365 },
      ];
    case 'HIPAA':
      return [
        { category: EventCategory.DATA_ACCESS, minRetentionDays: 2190 }, // 6 years
        { category: EventCategory.DATA_MODIFICATION, minRetentionDays: 2190 },
      ];
    case 'SOX':
      return [
        { category: EventCategory.DATA_MODIFICATION, minRetentionDays: 2555 }, // 7 years
        { category: EventCategory.ADMIN_ACTION, minRetentionDays: 2555 },
      ];
    case 'GDPR':
      return [
        // GDPR focuses on data minimization - shorter retention
        { category: EventCategory.DATA_ACCESS, minRetentionDays: 30 },
      ];
    default:
      return [];
  }
}

interface ComplianceRequirement {
  category: EventCategory;
  minRetentionDays: number;
}

export interface ComplianceValidationResult {
  compliant: boolean;
  issues: ComplianceIssue[];
  standard: string;
}

export interface ComplianceIssue {
  category: EventCategory;
  severity: 'error' | 'warning';
  message: string;
  requirement: string;
}
