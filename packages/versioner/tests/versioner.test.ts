/**
 * Tests for ISL Spec Versioner
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ChangeAnalyzer,
  analyzeChanges,
  type DomainSpec,
  type Change,
  type ChangeAnalysis,
} from '../src/analyzer.js';

import {
  Versioner,
  computeNextVersion,
  changeTypeToBump,
  isValidVersion,
  compareVersions,
} from '../src/versioner.js';

import {
  ChangelogGenerator,
  generateChangelog,
  appendToChangelog,
  createInitialChangelog,
} from '../src/changelog.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMinimalSpec(name: string): DomainSpec {
  return {
    kind: 'DomainDeclaration',
    name: { name },
    version: { value: '1.0.0' },
    entities: [],
    types: [],
    enums: [],
    behaviors: [],
    invariants: [],
  };
}

function createSpecWithEntity(name: string, entityName: string, fields: any[]): DomainSpec {
  return {
    ...createMinimalSpec(name),
    entities: [
      {
        kind: 'EntityDeclaration',
        name: { name: entityName },
        fields,
      },
    ],
  };
}

function createField(name: string, type: string, optional = false): any {
  return {
    kind: 'FieldDeclaration',
    name: { name },
    type: { kind: 'SimpleType', name: { name: type } },
    optional,
    constraints: [],
    annotations: [],
  };
}

// ============================================================================
// Analyzer Tests
// ============================================================================

describe('ChangeAnalyzer', () => {
  let analyzer: ChangeAnalyzer;

  beforeEach(() => {
    analyzer = new ChangeAnalyzer();
  });

  describe('analyze()', () => {
    it('should detect no changes for identical specs', () => {
      const spec = createMinimalSpec('Test');
      const result = analyzer.analyze(spec, spec);

      expect(result.changes).toHaveLength(0);
      expect(result.overallType).toBe('none');
    });

    it('should detect added entity as feature', () => {
      const oldSpec = createMinimalSpec('Test');
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.category).toBe('entity_added');
      expect(result.overallType).toBe('feature');
    });

    it('should detect removed entity as breaking', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
      ]);
      const newSpec = createMinimalSpec('Test');

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.breaking).toHaveLength(1);
      expect(result.breaking[0]?.category).toBe('entity_removed');
      expect(result.overallType).toBe('breaking');
    });

    it('should detect added field as feature (if optional)', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
      ]);
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String', true),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.features.length).toBeGreaterThan(0);
      expect(result.overallType).toBe('feature');
    });

    it('should detect added required field as breaking', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
      ]);
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String', false),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.breaking.length).toBeGreaterThan(0);
    });

    it('should detect removed field as breaking', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String'),
      ]);
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.breaking.length).toBeGreaterThan(0);
      expect(result.breaking.find(c => c.category === 'field_removed')).toBeDefined();
    });

    it('should detect type change as breaking', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('age', 'Int'),
      ]);
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('age', 'String'),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.breaking.length).toBeGreaterThan(0);
      expect(result.breaking.find(c => c.category === 'field_type_changed')).toBeDefined();
    });

    it('should detect field made optional as feature', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String', false),
      ]);
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String', true),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.features.length).toBeGreaterThan(0);
      expect(result.features.find(c => c.category === 'field_made_optional')).toBeDefined();
    });

    it('should detect field made required as breaking', () => {
      const oldSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String', true),
      ]);
      const newSpec = createSpecWithEntity('Test', 'User', [
        createField('id', 'UUID'),
        createField('email', 'String', false),
      ]);

      const result = analyzer.analyze(oldSpec, newSpec);

      expect(result.breaking.length).toBeGreaterThan(0);
      expect(result.breaking.find(c => c.category === 'field_made_required')).toBeDefined();
    });
  });

  describe('analyzeChanges()', () => {
    it('should be a convenience wrapper', () => {
      const spec = createMinimalSpec('Test');
      const result = analyzeChanges(spec, spec);

      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('overallType');
    });
  });
});

// ============================================================================
// Versioner Tests
// ============================================================================

describe('Versioner', () => {
  describe('computeNextVersion()', () => {
    it('should bump major for breaking changes', () => {
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [{ category: 'field_removed', type: 'breaking', path: 'User.email', description: 'Removed' }],
        features: [],
        fixes: [],
        overallType: 'breaking',
        summary: '1 breaking change',
      };

      const result = computeNextVersion('1.0.0', analysis);

      expect(result.nextVersion).toBe('2.0.0');
      expect(result.bump).toBe('major');
    });

    it('should bump minor for features', () => {
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [{ category: 'field_added', type: 'feature', path: 'User.phone', description: 'Added' }],
        fixes: [],
        overallType: 'feature',
        summary: '1 feature',
      };

      const result = computeNextVersion('1.0.0', analysis);

      expect(result.nextVersion).toBe('1.1.0');
      expect(result.bump).toBe('minor');
    });

    it('should bump patch for fixes', () => {
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [],
        fixes: [{ category: 'constraint_modified', type: 'fix', path: 'User.email', description: 'Fixed' }],
        overallType: 'fix',
        summary: '1 fix',
      };

      const result = computeNextVersion('1.0.0', analysis);

      expect(result.nextVersion).toBe('1.0.1');
      expect(result.bump).toBe('patch');
    });

    it('should not bump for no changes', () => {
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [],
        fixes: [],
        overallType: 'none',
        summary: 'No changes',
      };

      const result = computeNextVersion('1.0.0', analysis);

      expect(result.nextVersion).toBe('1.0.0');
      expect(result.bump).toBe('none');
    });

    it('should handle pre-release versions', () => {
      const versioner = new Versioner({ prerelease: 'beta' });
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [{ category: 'field_added', type: 'feature', path: 'Test', description: 'Added' }],
        fixes: [],
        overallType: 'feature',
        summary: '1 feature',
      };

      const result = versioner.computeNextVersion('1.0.0', analysis);

      expect(result.nextVersion).toContain('beta');
      expect(result.isPrerelease).toBe(true);
    });

    it('should respect allowMajor option', () => {
      const versioner = new Versioner({ allowMajor: false });
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [{ category: 'field_removed', type: 'breaking', path: 'Test', description: 'Removed' }],
        features: [],
        fixes: [],
        overallType: 'breaking',
        summary: '1 breaking change',
      };

      const result = versioner.computeNextVersion('1.0.0', analysis);

      expect(result.bump).toBe('minor');
      expect(result.nextVersion).toBe('1.1.0');
    });

    it('should respect forceBump option', () => {
      const versioner = new Versioner({ forceBump: 'major' });
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [],
        fixes: [{ category: 'documentation', type: 'fix', path: 'Test', description: 'Fixed' }],
        overallType: 'fix',
        summary: '1 fix',
      };

      const result = versioner.computeNextVersion('1.0.0', analysis);

      expect(result.bump).toBe('major');
      expect(result.nextVersion).toBe('2.0.0');
    });

    it('should handle version with v prefix', () => {
      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [],
        fixes: [{ category: 'fix', type: 'fix', path: 'Test', description: 'Fixed' }],
        overallType: 'fix',
        summary: '1 fix',
      };

      const result = computeNextVersion('v1.0.0', analysis);

      expect(result.currentVersion).toBe('1.0.0');
      expect(result.nextVersion).toBe('1.0.1');
    });
  });

  describe('helper functions', () => {
    it('changeTypeToBump should map correctly', () => {
      expect(changeTypeToBump('breaking')).toBe('major');
      expect(changeTypeToBump('feature')).toBe('minor');
      expect(changeTypeToBump('fix')).toBe('patch');
      expect(changeTypeToBump('none')).toBe('none');
    });

    it('isValidVersion should validate versions', () => {
      expect(isValidVersion('1.0.0')).toBe(true);
      expect(isValidVersion('v1.0.0')).toBe(true);
      expect(isValidVersion('1.0.0-beta.1')).toBe(true);
      expect(isValidVersion('invalid')).toBe(false);
      expect(isValidVersion('1.0')).toBe(false);
    });

    it('compareVersions should compare correctly', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    });
  });
});

// ============================================================================
// Changelog Tests
// ============================================================================

describe('ChangelogGenerator', () => {
  describe('generate()', () => {
    it('should generate markdown changelog', () => {
      const version = {
        currentVersion: '1.0.0',
        nextVersion: '1.1.0',
        bump: 'minor' as const,
        reason: 'Added new features',
        isPrerelease: false,
      };

      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [
          { category: 'field_added', type: 'feature', path: 'User.phone', description: 'Added phone field' },
        ],
        fixes: [],
        overallType: 'feature',
        summary: '1 feature',
      };

      const entry = generateChangelog(version, analysis);

      expect(entry.version).toBe('1.1.0');
      expect(entry.markdown).toContain('1.1.0');
      expect(entry.markdown).toContain('Features');
      expect(entry.plainText).toContain('FEATURES');
    });

    it('should generate changelog with breaking changes', () => {
      const version = {
        currentVersion: '1.0.0',
        nextVersion: '2.0.0',
        bump: 'major' as const,
        reason: 'Breaking changes',
        isPrerelease: false,
      };

      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [
          { category: 'field_removed', type: 'breaking', path: 'User.email', description: 'Removed email' },
        ],
        features: [],
        fixes: [],
        overallType: 'breaking',
        summary: '1 breaking change',
      };

      const entry = generateChangelog(version, analysis);

      expect(entry.markdown).toContain('Breaking Changes');
      expect(entry.markdown).toContain('User.email');
    });

    it('should handle empty changes', () => {
      const version = {
        currentVersion: '1.0.0',
        nextVersion: '1.0.0',
        bump: 'none' as const,
        reason: 'No changes',
        isPrerelease: false,
      };

      const analysis: ChangeAnalysis = {
        changes: [],
        breaking: [],
        features: [],
        fixes: [],
        overallType: 'none',
        summary: 'No changes',
      };

      const entry = generateChangelog(version, analysis);

      expect(entry.markdown).toContain('No changes');
    });
  });

  describe('appendToChangelog()', () => {
    it('should append entry to existing changelog', () => {
      const existing = '# Changelog\n\n## [1.0.0] - 2024-01-01\n\nInitial release';
      const newEntry = {
        version: '1.1.0',
        date: new Date(),
        analysis: {} as ChangeAnalysis,
        markdown: '## [1.1.0] - 2024-02-01\n\nNew features',
        plainText: '',
      };

      const result = appendToChangelog(existing, newEntry);

      expect(result).toContain('## [1.1.0]');
      expect(result).toContain('## [1.0.0]');
      expect(result.indexOf('[1.1.0]')).toBeLessThan(result.indexOf('[1.0.0]'));
    });
  });

  describe('createInitialChangelog()', () => {
    it('should create initial changelog', () => {
      const result = createInitialChangelog('Test Project');

      expect(result).toContain('# Changelog');
      expect(result).toContain('Test Project');
      expect(result).toContain('Keep a Changelog');
      expect(result).toContain('Semantic Versioning');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  it('should analyze changes and compute version', () => {
    const oldSpec = createSpecWithEntity('Auth', 'User', [
      createField('id', 'UUID'),
      createField('email', 'String'),
    ]);

    const newSpec = createSpecWithEntity('Auth', 'User', [
      createField('id', 'UUID'),
      createField('email', 'String'),
      createField('phone', 'String', true),
    ]);

    // Analyze
    const analysis = analyzeChanges(oldSpec, newSpec);
    expect(analysis.overallType).toBe('feature');

    // Compute version
    const version = computeNextVersion('1.0.0', analysis);
    expect(version.nextVersion).toBe('1.1.0');
    expect(version.bump).toBe('minor');

    // Generate changelog
    const changelog = generateChangelog(version, analysis);
    expect(changelog.markdown).toContain('1.1.0');
    expect(changelog.markdown).toContain('Features');
  });
});
