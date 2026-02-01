/**
 * Tests for Migration Validators
 */

import { describe, it, expect } from 'vitest';
import type { DomainDiff, EntityDiff } from '../src/types.js';
import { 
  checkMigrationSafety, 
  validateMigration, 
  getSafetySummary 
} from '../src/validators/safe.js';
import { 
  generateRollbackPlan, 
  canRollback, 
  getRollbackWarnings 
} from '../src/validators/rollback.js';

// Helper to create test diff
function createTestDiff(entities: EntityDiff[]): DomainDiff {
  const hasRemovedEntity = entities.some(e => e.type === 'removed');
  const hasRemovedField = entities.some(e => 
    e.changes?.some(c => c.type === 'removed')
  );
  
  return {
    domain: 'TestDomain',
    oldVersion: '1.0.0',
    newVersion: '1.1.0',
    entities,
    enums: [],
    types: [],
    breaking: hasRemovedEntity || hasRemovedField,
    stats: {
      entitiesAdded: entities.filter(e => e.type === 'added').length,
      entitiesRemoved: entities.filter(e => e.type === 'removed').length,
      entitiesModified: entities.filter(e => e.type === 'modified').length,
      fieldsAdded: 0,
      fieldsRemoved: 0,
      fieldsModified: 0,
      enumsAdded: 0,
      enumsRemoved: 0,
      enumsModified: 0,
    },
  };
}

describe('checkMigrationSafety', () => {
  it('should mark migration as safe when no breaking changes', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'UUID', nullable: false, defaultValue: { kind: 'expression', value: 'gen_random_uuid()' } },
      ],
    }]);
    
    const report = checkMigrationSafety(diff);
    
    expect(report.safe).toBe(true);
    expect(report.issues.filter(i => i.severity === 'critical')).toHaveLength(0);
  });
  
  it('should detect table drop as critical', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const report = checkMigrationSafety(diff);
    
    expect(report.safe).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        type: 'table_dropped',
        entity: 'User',
      })
    );
  });
  
  it('should detect column drop as critical', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { type: 'removed', field: 'email', oldType: 'Email' },
      ],
    }]);
    
    const report = checkMigrationSafety(diff);
    
    expect(report.safe).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        severity: 'critical',
        type: 'column_dropped',
        field: 'email',
      })
    );
  });
  
  it('should warn about nullable to required change', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { 
          type: 'modified', 
          field: 'email', 
          oldNullable: true, 
          nullable: false,
        },
      ],
    }]);
    
    const report = checkMigrationSafety(diff);
    
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        type: 'nullable_to_required',
        field: 'email',
      })
    );
  });
  
  it('should warn about required column without default', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { type: 'added', field: 'phone', newType: 'String', nullable: false },
      ],
    }]);
    
    const report = checkMigrationSafety(diff);
    
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        type: 'required_column_no_default',
        field: 'phone',
      })
    );
  });
  
  it('should include precheck SQL for issues', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const report = checkMigrationSafety(diff);
    const tableDropIssue = report.issues.find(i => i.type === 'table_dropped');
    
    expect(tableDropIssue?.precheck).toBeDefined();
    expect(tableDropIssue?.precheck).toContain('SELECT COUNT');
  });
  
  it('should generate migration strategy', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { type: 'added', field: 'phone', newType: 'String', nullable: false },
      ],
    }]);
    
    const report = checkMigrationSafety(diff);
    
    expect(report.strategy).toBeDefined();
    expect(report.strategy?.steps.length).toBeGreaterThan(0);
  });
});

describe('validateMigration', () => {
  it('should pass validation for safe migration', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [
        { type: 'added', field: 'id', newType: 'UUID', nullable: true },
      ],
    }]);
    
    const result = validateMigration(diff);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should fail validation for breaking changes', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const result = validateMigration(diff);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('breaking'))).toBe(true);
  });
  
  it('should pass with allowBreaking option', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const result = validateMigration(diff, { allowBreaking: true, allowDataLoss: true });
    
    expect(result.valid).toBe(true);
  });
  
  it('should enforce maxWarnings limit', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { type: 'added', field: 'field1', newType: 'String', nullable: false },
        { type: 'added', field: 'field2', newType: 'String', nullable: false },
        { type: 'added', field: 'field3', newType: 'String', nullable: false },
      ],
    }]);
    
    const result = validateMigration(diff, { maxWarnings: 1 });
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('warnings'))).toBe(true);
  });
});

describe('getSafetySummary', () => {
  it('should generate summary for safe migration', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: true }],
    }]);
    
    const report = checkMigrationSafety(diff);
    const summary = getSafetySummary(report);
    
    expect(summary).toContain('SAFE');
  });
  
  it('should generate summary for unsafe migration', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const report = checkMigrationSafety(diff);
    const summary = getSafetySummary(report);
    
    expect(summary).toContain('CRITICAL');
  });
});

describe('generateRollbackPlan', () => {
  it('should generate rollback for added entity', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const plan = generateRollbackPlan(diff);
    
    expect(plan.possible).toBe(true);
    expect(plan.sql).toContain('DROP TABLE');
    expect(plan.steps.length).toBeGreaterThan(0);
  });
  
  it('should mark rollback as not possible for removed entity', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const plan = generateRollbackPlan(diff);
    
    expect(plan.possible).toBe(false);
    expect(plan.dataLossWarnings.length).toBeGreaterThan(0);
  });
  
  it('should generate rollback for added column', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [
        { type: 'added', field: 'phone', newType: 'String', nullable: true },
      ],
    }]);
    
    const plan = generateRollbackPlan(diff);
    
    expect(plan.possible).toBe(true);
    expect(plan.sql).toContain('DROP COLUMN');
    expect(plan.sql).toContain('phone');
  });
  
  it('should include data preservation in steps', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const plan = generateRollbackPlan(diff);
    const dropStep = plan.steps.find(s => s.sql.includes('DROP TABLE'));
    
    expect(dropStep?.dataPreservation).toBeDefined();
    expect(dropStep?.dataPreservation?.type).toBe('backup_table');
  });
});

describe('canRollback', () => {
  it('should return true for additive changes', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    expect(canRollback(diff)).toBe(true);
  });
  
  it('should return false for dropped table', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    expect(canRollback(diff)).toBe(false);
  });
  
  it('should return false for dropped column', () => {
    const diff = createTestDiff([{
      type: 'modified',
      entity: 'User',
      changes: [{ type: 'removed', field: 'email', oldType: 'Email' }],
    }]);
    
    expect(canRollback(diff)).toBe(false);
  });
});

describe('getRollbackWarnings', () => {
  it('should warn about dropped data for new table rollback', () => {
    const diff = createTestDiff([{
      type: 'added',
      entity: 'User',
      changes: [{ type: 'added', field: 'id', newType: 'UUID', nullable: false }],
    }]);
    
    const warnings = getRollbackWarnings(diff);
    
    expect(warnings.some(w => w.includes('User'))).toBe(true);
    expect(warnings.some(w => w.includes('data'))).toBe(true);
  });
  
  it('should warn about permanent data loss for dropped table', () => {
    const diff = createTestDiff([{
      type: 'removed',
      entity: 'User',
    }]);
    
    const warnings = getRollbackWarnings(diff);
    
    expect(warnings.some(w => w.includes('permanently lost'))).toBe(true);
  });
});
