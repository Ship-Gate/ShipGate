/**
 * Error Catalog - organizes and provides access to error definitions
 */

import type { ErrorDefinition, ErrorGroup } from './types.js';

/**
 * Catalog options
 */
export interface CatalogOptions {
  /** How to group errors */
  groupBy: 'domain' | 'httpStatus' | 'severity' | 'tag';
  /** How to sort errors within groups */
  sortBy: 'code' | 'id' | 'httpStatus' | 'severity';
}

/**
 * Error statistics
 */
export interface CatalogStats {
  totalErrors: number;
  byDomain: Record<string, number>;
  byHttpStatus: Record<number, number>;
  bySeverity: Record<string, number>;
  retriableCount: number;
  deprecatedCount: number;
}

/**
 * Error Catalog class
 */
export class ErrorCatalog {
  private errors: ErrorDefinition[];
  private options: CatalogOptions;
  private groupCache: Map<string, ErrorGroup[]> = new Map();

  constructor(errors: ErrorDefinition[], options: Partial<CatalogOptions> = {}) {
    this.errors = errors;
    this.options = {
      groupBy: options.groupBy ?? 'domain',
      sortBy: options.sortBy ?? 'code',
    };
  }

  /**
   * Get all errors
   */
  getAllErrors(): ErrorDefinition[] {
    return this.sortErrors([...this.errors]);
  }

  /**
   * Get error by ID
   */
  getById(id: string): ErrorDefinition | undefined {
    return this.errors.find((e) => e.id === id);
  }

  /**
   * Get error by code
   */
  getByCode(code: string): ErrorDefinition | undefined {
    return this.errors.find((e) => e.code === code);
  }

  /**
   * Get errors by domain
   */
  getByDomain(domain: string): ErrorDefinition[] {
    return this.sortErrors(
      this.errors.filter((e) => e.domain.toLowerCase() === domain.toLowerCase())
    );
  }

  /**
   * Get errors by HTTP status
   */
  getByHttpStatus(status: number): ErrorDefinition[] {
    return this.sortErrors(this.errors.filter((e) => e.httpStatus === status));
  }

  /**
   * Get errors by HTTP status range (e.g., 4xx, 5xx)
   */
  getByHttpStatusRange(min: number, max: number): ErrorDefinition[] {
    return this.sortErrors(
      this.errors.filter((e) => e.httpStatus >= min && e.httpStatus <= max)
    );
  }

  /**
   * Get errors by severity
   */
  getBySeverity(severity: string): ErrorDefinition[] {
    return this.sortErrors(
      this.errors.filter((e) => e.severity === severity)
    );
  }

  /**
   * Get errors by tag
   */
  getByTag(tag: string): ErrorDefinition[] {
    return this.sortErrors(
      this.errors.filter((e) => e.tags.includes(tag))
    );
  }

  /**
   * Get retriable errors
   */
  getRetriable(): ErrorDefinition[] {
    return this.sortErrors(this.errors.filter((e) => e.retriable));
  }

  /**
   * Get deprecated errors
   */
  getDeprecated(): ErrorDefinition[] {
    return this.sortErrors(this.errors.filter((e) => e.deprecated));
  }

  /**
   * Search errors by text
   */
  search(query: string): ErrorDefinition[] {
    const normalized = query.toLowerCase();
    return this.sortErrors(
      this.errors.filter(
        (e) =>
          e.id.toLowerCase().includes(normalized) ||
          e.code.toLowerCase().includes(normalized) ||
          e.message.toLowerCase().includes(normalized) ||
          e.description.toLowerCase().includes(normalized)
      )
    );
  }

  /**
   * Get errors grouped by current grouping option
   */
  getGroups(): ErrorGroup[] {
    const cacheKey = `${this.options.groupBy}-${this.options.sortBy}`;
    if (this.groupCache.has(cacheKey)) {
      return this.groupCache.get(cacheKey)!;
    }

    let groups: ErrorGroup[];

    switch (this.options.groupBy) {
      case 'domain':
        groups = this.groupByDomain();
        break;
      case 'httpStatus':
        groups = this.groupByHttpStatus();
        break;
      case 'severity':
        groups = this.groupBySeverity();
        break;
      case 'tag':
        groups = this.groupByTag();
        break;
      default:
        groups = this.groupByDomain();
    }

    this.groupCache.set(cacheKey, groups);
    return groups;
  }

  /**
   * Get all unique domains
   */
  getDomains(): string[] {
    const domains = new Set(this.errors.map((e) => e.domain));
    return Array.from(domains).sort();
  }

  /**
   * Get all unique tags
   */
  getTags(): string[] {
    const tags = new Set(this.errors.flatMap((e) => e.tags));
    return Array.from(tags).sort();
  }

  /**
   * Get catalog statistics
   */
  getStats(): CatalogStats {
    const stats: CatalogStats = {
      totalErrors: this.errors.length,
      byDomain: {},
      byHttpStatus: {},
      bySeverity: {},
      retriableCount: 0,
      deprecatedCount: 0,
    };

    for (const error of this.errors) {
      // By domain
      stats.byDomain[error.domain] = (stats.byDomain[error.domain] ?? 0) + 1;

      // By HTTP status
      stats.byHttpStatus[error.httpStatus] =
        (stats.byHttpStatus[error.httpStatus] ?? 0) + 1;

      // By severity
      stats.bySeverity[error.severity] =
        (stats.bySeverity[error.severity] ?? 0) + 1;

      // Retriable
      if (error.retriable) {
        stats.retriableCount++;
      }

      // Deprecated
      if (error.deprecated) {
        stats.deprecatedCount++;
      }
    }

    return stats;
  }

  /**
   * Validate catalog for common issues
   */
  validate(): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Check for duplicate IDs
    const idCounts = new Map<string, number>();
    for (const error of this.errors) {
      idCounts.set(error.id, (idCounts.get(error.id) ?? 0) + 1);
    }
    for (const [id, count] of idCounts) {
      if (count > 1) {
        issues.push({
          type: 'error',
          message: `Duplicate error ID: ${id} (appears ${count} times)`,
          errorId: id,
        });
      }
    }

    // Check for duplicate codes
    const codeCounts = new Map<string, number>();
    for (const error of this.errors) {
      codeCounts.set(error.code, (codeCounts.get(error.code) ?? 0) + 1);
    }
    for (const [code, count] of codeCounts) {
      if (count > 1) {
        issues.push({
          type: 'error',
          message: `Duplicate error code: ${code} (appears ${count} times)`,
        });
      }
    }

    // Check for missing descriptions
    for (const error of this.errors) {
      if (!error.description || error.description.trim() === '') {
        issues.push({
          type: 'warning',
          message: `Missing description for error: ${error.id}`,
          errorId: error.id,
        });
      }
    }

    // Check for missing resolutions
    for (const error of this.errors) {
      if (error.resolutions.length === 0) {
        issues.push({
          type: 'warning',
          message: `No resolutions provided for error: ${error.id}`,
          errorId: error.id,
        });
      }
    }

    // Check for related errors that don't exist
    for (const error of this.errors) {
      for (const relatedId of error.relatedErrors) {
        if (!this.getById(relatedId)) {
          issues.push({
            type: 'warning',
            message: `Related error not found: ${relatedId} (referenced by ${error.id})`,
            errorId: error.id,
          });
        }
      }
    }

    return {
      valid: issues.filter((i) => i.type === 'error').length === 0,
      issues,
    };
  }

  // Private methods

  private groupByDomain(): ErrorGroup[] {
    const domains = this.getDomains();
    return domains.map((domain) => ({
      id: domain.toLowerCase(),
      name: this.formatDomainName(domain),
      description: `Errors in the ${domain} domain`,
      errors: this.getByDomain(domain),
    }));
  }

  private groupByHttpStatus(): ErrorGroup[] {
    const statusRanges = [
      { id: '4xx', name: 'Client Errors (4xx)', min: 400, max: 499 },
      { id: '5xx', name: 'Server Errors (5xx)', min: 500, max: 599 },
    ];

    return statusRanges
      .map((range) => ({
        id: range.id,
        name: range.name,
        errors: this.getByHttpStatusRange(range.min, range.max),
        children: this.groupBySpecificStatus(range.min, range.max),
      }))
      .filter((g) => g.errors.length > 0);
  }

  private groupBySpecificStatus(min: number, max: number): ErrorGroup[] {
    const statuses = new Set(
      this.errors
        .filter((e) => e.httpStatus >= min && e.httpStatus <= max)
        .map((e) => e.httpStatus)
    );

    return Array.from(statuses)
      .sort()
      .map((status) => ({
        id: status.toString(),
        name: `${status} ${this.getStatusName(status)}`,
        errors: this.getByHttpStatus(status),
      }));
  }

  private groupBySeverity(): ErrorGroup[] {
    const severities = ['critical', 'error', 'warning', 'info'];
    return severities
      .map((severity) => ({
        id: severity,
        name: severity.charAt(0).toUpperCase() + severity.slice(1),
        errors: this.getBySeverity(severity),
      }))
      .filter((g) => g.errors.length > 0);
  }

  private groupByTag(): ErrorGroup[] {
    const tags = this.getTags();
    return tags.map((tag) => ({
      id: tag,
      name: tag,
      errors: this.getByTag(tag),
    }));
  }

  private sortErrors(errors: ErrorDefinition[]): ErrorDefinition[] {
    return errors.sort((a, b) => {
      switch (this.options.sortBy) {
        case 'code':
          return a.code.localeCompare(b.code);
        case 'id':
          return a.id.localeCompare(b.id);
        case 'httpStatus':
          return a.httpStatus - b.httpStatus;
        case 'severity':
          return this.severityOrder(a.severity) - this.severityOrder(b.severity);
        default:
          return a.code.localeCompare(b.code);
      }
    });
  }

  private severityOrder(severity: string): number {
    const order: Record<string, number> = {
      critical: 0,
      error: 1,
      warning: 2,
      info: 3,
    };
    return order[severity] ?? 99;
  }

  private formatDomainName(domain: string): string {
    return domain
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private getStatusName(status: number): string {
    const names: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict',
      410: 'Gone',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return names[status] ?? 'Unknown';
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  errorId?: string;
}
