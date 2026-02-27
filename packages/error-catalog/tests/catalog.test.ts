/**
 * Error catalog tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorCatalog } from '../src/catalog.js';
import type { ErrorDefinition } from '../src/types.js';

describe('ErrorCatalog', () => {
  const sampleErrors: ErrorDefinition[] = [
    {
      id: 'DUPLICATE_EMAIL',
      code: 'AUTH_001',
      domain: 'auth',
      httpStatus: 409,
      message: 'Email already exists',
      description: 'The email address is already registered',
      retriable: false,
      severity: 'error',
      causes: ['User registration with existing email'],
      resolutions: ['Use different email'],
      relatedErrors: [],
      metadata: {},
      tags: ['auth', 'registration'],
    },
    {
      id: 'RATE_LIMITED',
      code: 'AUTH_002',
      domain: 'auth',
      httpStatus: 429,
      message: 'Too many requests',
      description: 'Rate limit exceeded',
      retriable: true,
      retryAfter: 60,
      severity: 'warning',
      causes: ['Too many API calls'],
      resolutions: ['Wait and retry'],
      relatedErrors: [],
      metadata: {},
      tags: ['auth', 'rate-limit'],
    },
    {
      id: 'USER_NOT_FOUND',
      code: 'USER_001',
      domain: 'user',
      httpStatus: 404,
      message: 'User not found',
      description: 'The requested user does not exist',
      retriable: false,
      severity: 'error',
      causes: ['Invalid user ID'],
      resolutions: ['Verify user ID'],
      relatedErrors: [],
      metadata: {},
      tags: ['user'],
    },
    {
      id: 'SERVER_ERROR',
      code: 'SYS_001',
      domain: 'system',
      httpStatus: 500,
      message: 'Internal server error',
      description: 'An unexpected error occurred',
      retriable: true,
      severity: 'critical',
      causes: ['System failure'],
      resolutions: ['Contact support'],
      relatedErrors: [],
      metadata: {},
      tags: ['system'],
    },
  ];

  let catalog: ErrorCatalog;

  beforeEach(() => {
    catalog = new ErrorCatalog(sampleErrors);
  });

  describe('getAllErrors', () => {
    it('should return all errors', () => {
      const errors = catalog.getAllErrors();
      expect(errors).toHaveLength(4);
    });

    it('should sort errors by code', () => {
      const errors = catalog.getAllErrors();
      expect(errors[0].code).toBe('AUTH_001');
      expect(errors[1].code).toBe('AUTH_002');
    });
  });

  describe('getById', () => {
    it('should find error by ID', () => {
      const error = catalog.getById('DUPLICATE_EMAIL');
      expect(error).toBeDefined();
      expect(error?.code).toBe('AUTH_001');
    });

    it('should return undefined for unknown ID', () => {
      const error = catalog.getById('UNKNOWN');
      expect(error).toBeUndefined();
    });
  });

  describe('getByCode', () => {
    it('should find error by code', () => {
      const error = catalog.getByCode('AUTH_002');
      expect(error).toBeDefined();
      expect(error?.id).toBe('RATE_LIMITED');
    });
  });

  describe('getByDomain', () => {
    it('should return errors for domain', () => {
      const errors = catalog.getByDomain('auth');
      expect(errors).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const errors = catalog.getByDomain('AUTH');
      expect(errors).toHaveLength(2);
    });
  });

  describe('getByHttpStatus', () => {
    it('should return errors for status', () => {
      const errors = catalog.getByHttpStatus(409);
      expect(errors).toHaveLength(1);
      expect(errors[0].id).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('getByHttpStatusRange', () => {
    it('should return 4xx errors', () => {
      const errors = catalog.getByHttpStatusRange(400, 499);
      expect(errors).toHaveLength(3);
    });

    it('should return 5xx errors', () => {
      const errors = catalog.getByHttpStatusRange(500, 599);
      expect(errors).toHaveLength(1);
    });
  });

  describe('getBySeverity', () => {
    it('should return errors by severity', () => {
      const critical = catalog.getBySeverity('critical');
      expect(critical).toHaveLength(1);
      expect(critical[0].id).toBe('SERVER_ERROR');
    });
  });

  describe('getByTag', () => {
    it('should return errors with tag', () => {
      const errors = catalog.getByTag('auth');
      expect(errors).toHaveLength(2);
    });
  });

  describe('getRetriable', () => {
    it('should return retriable errors', () => {
      const errors = catalog.getRetriable();
      expect(errors).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('should search by ID', () => {
      const errors = catalog.search('duplicate');
      expect(errors).toHaveLength(1);
    });

    it('should search by message', () => {
      const errors = catalog.search('not found');
      expect(errors).toHaveLength(1);
    });

    it('should search by code', () => {
      const errors = catalog.search('SYS');
      expect(errors).toHaveLength(1);
    });
  });

  describe('getGroups', () => {
    it('should group by domain', () => {
      const groups = catalog.getGroups();
      expect(groups).toHaveLength(3);
      expect(groups.map((g) => g.id)).toContain('auth');
      expect(groups.map((g) => g.id)).toContain('user');
      expect(groups.map((g) => g.id)).toContain('system');
    });
  });

  describe('getDomains', () => {
    it('should return unique domains', () => {
      const domains = catalog.getDomains();
      expect(domains).toEqual(['auth', 'system', 'user']);
    });
  });

  describe('getTags', () => {
    it('should return unique tags', () => {
      const tags = catalog.getTags();
      expect(tags).toContain('auth');
      expect(tags).toContain('registration');
      expect(tags).toContain('rate-limit');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const stats = catalog.getStats();

      expect(stats.totalErrors).toBe(4);
      expect(stats.retriableCount).toBe(2);
      expect(stats.byDomain['auth']).toBe(2);
      expect(stats.byHttpStatus[409]).toBe(1);
      expect(stats.bySeverity['critical']).toBe(1);
    });
  });

  describe('validate', () => {
    it('should pass for valid catalog', () => {
      const result = catalog.validate();
      expect(result.valid).toBe(true);
    });

    it('should detect duplicate IDs', () => {
      const duplicateErrors = [
        ...sampleErrors,
        { ...sampleErrors[0] }, // Duplicate
      ];
      const badCatalog = new ErrorCatalog(duplicateErrors);
      const result = badCatalog.validate();

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.message.includes('Duplicate error ID'))).toBe(true);
    });

    it('should warn about missing descriptions', () => {
      const noDescErrors: ErrorDefinition[] = [
        {
          ...sampleErrors[0],
          id: 'NO_DESC',
          code: 'TEST_001',
          description: '',
        },
      ];
      const testCatalog = new ErrorCatalog(noDescErrors);
      const result = testCatalog.validate();

      expect(result.issues.some((i) => i.message.includes('Missing description'))).toBe(true);
    });
  });
});
