/**
 * Tests for Audit Module
 */

import { describe, it, expect } from 'vitest';
import type {
  AuditReport,
  AuditSummary,
  DetectedImplementation,
  BehaviorMapping,
  RiskyZone,
  ISLBehavior,
} from '../auditTypes.js';

describe('Audit Types', () => {
  it('should define valid AuditReport structure', () => {
    const report: AuditReport = {
      version: '1.0',
      reportId: 'test-123',
      workspacePath: '/test/workspace',
      specsPath: '/test/specs',
      auditedAt: new Date().toISOString(),
      durationMs: 1000,
      summary: {
        totalBehaviors: 10,
        implementedBehaviors: 5,
        partialBehaviors: 3,
        missingBehaviors: 2,
        coveragePercent: 65,
        totalImplementations: 20,
        unmappedImplementations: 5,
        riskyZonesCount: 3,
        riskBreakdown: {
          low: 1,
          medium: 1,
          high: 1,
          critical: 0,
        },
      },
      behaviorMappings: [],
      detectedImplementations: [],
      riskyZones: [],
      warnings: [],
      metadata: {
        agentVersion: '0.1.0',
        filesScanned: 100,
        specFilesProcessed: 5,
      },
    };

    expect(report.version).toBe('1.0');
    expect(report.summary.coveragePercent).toBe(65);
  });

  it('should define valid DetectedImplementation structure', () => {
    const impl: DetectedImplementation = {
      id: 'route-test-1',
      name: 'POST /users',
      type: 'route',
      filePath: 'src/routes/users.ts',
      line: 10,
      httpMethod: 'POST',
      routePath: '/users',
      patterns: [
        {
          type: 'validation',
          description: 'Input validation present',
          line: 12,
        },
        {
          type: 'auth-check',
          description: 'Auth check present',
          line: 11,
        },
      ],
      confidence: 0.9,
    };

    expect(impl.type).toBe('route');
    expect(impl.patterns).toHaveLength(2);
  });

  it('should define valid BehaviorMapping structure', () => {
    const behavior: ISLBehavior = {
      name: 'CreateUser',
      domain: 'UserManagement',
      specPath: 'specs/users.isl',
      preconditions: ['email is valid', 'user is authenticated'],
      postconditions: ['user exists in database'],
      invariants: [],
      effects: ['sends welcome email'],
    };

    const mapping: BehaviorMapping = {
      behavior,
      implementations: [],
      status: 'partial',
      coveragePercent: 50,
      clausesCovered: 2,
      totalClauses: 4,
      confidence: 0.7,
      notes: ['Found matching route'],
    };

    expect(mapping.status).toBe('partial');
    expect(mapping.coveragePercent).toBe(50);
  });

  it('should define valid RiskyZone structure', () => {
    const zone: RiskyZone = {
      id: 'risk-1',
      filePath: 'src/routes/admin.ts',
      startLine: 10,
      endLine: 25,
      riskLevel: 'high',
      category: 'no-auth',
      description: 'Admin route has no authentication',
      suggestion: 'Add auth middleware',
    };

    expect(zone.riskLevel).toBe('high');
    expect(zone.category).toBe('no-auth');
  });
});

describe('Audit Summary', () => {
  it('should calculate coverage correctly', () => {
    const summary: AuditSummary = {
      totalBehaviors: 10,
      implementedBehaviors: 6,
      partialBehaviors: 2,
      missingBehaviors: 2,
      coveragePercent: 70,
      totalImplementations: 15,
      unmappedImplementations: 3,
      riskyZonesCount: 4,
      riskBreakdown: {
        low: 1,
        medium: 2,
        high: 1,
        critical: 0,
      },
    };

    // Implemented + partial should equal total - missing
    expect(summary.implementedBehaviors + summary.partialBehaviors + summary.missingBehaviors)
      .toBe(summary.totalBehaviors);

    // Risk breakdown should sum to riskyZonesCount
    const totalRisks = Object.values(summary.riskBreakdown).reduce((a, b) => a + b, 0);
    expect(totalRisks).toBe(summary.riskyZonesCount);
  });
});
