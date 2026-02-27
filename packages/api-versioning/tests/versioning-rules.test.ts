/**
 * Tests for Semantic Versioning Rules
 */

import { describe, it, expect } from 'vitest';
import { createVersioningRules, determineVersionBump } from '../src/versioning-rules.js';
import { diffDomains } from '../src/migration/differ.js';
import type { Domain } from '../src/types.js';

describe('Versioning Rules', () => {
  const rules = createVersioningRules();

  describe('determineBump', () => {
    it('should suggest major bump for breaking changes', () => {
      const fromDomain: Domain = {
        name: 'User',
        version: '1.0.0',
        entities: [{
          name: 'User',
          fields: [{
            name: 'email',
            type: 'String',
            optional: false,
          }],
        }],
        behaviors: [],
        types: [],
      };

      const toDomain: Domain = {
        name: 'User',
        version: '2.0.0',
        entities: [{
          name: 'User',
          fields: [], // email removed - breaking!
        }],
        behaviors: [],
        types: [],
      };

      const diff = diffDomains(fromDomain, toDomain);
      const bump = rules.determineBump('User@1.0.0', diff);

      expect(bump.type).toBe('major');
      expect(bump.toVersion).toBe('2.0.0');
      expect(bump.breakingChanges.length).toBeGreaterThan(0);
    });

    it('should suggest minor bump for new features', () => {
      const fromDomain: Domain = {
        name: 'User',
        version: '1.0.0',
        entities: [{
          name: 'User',
          fields: [{
            name: 'email',
            type: 'String',
            optional: false,
          }],
        }],
        behaviors: [],
        types: [],
      };

      const toDomain: Domain = {
        name: 'User',
        version: '1.1.0',
        entities: [{
          name: 'User',
          fields: [
            {
              name: 'email',
              type: 'String',
              optional: false,
            },
            {
              name: 'phone', // new optional field - feature
              type: 'String',
              optional: true,
            },
          ],
        }],
        behaviors: [],
        types: [],
      };

      const diff = diffDomains(fromDomain, toDomain);
      const bump = rules.determineBump('User@1.0.0', diff);

      expect(bump.type).toBe('minor');
      expect(bump.toVersion).toBe('1.1.0');
      expect(bump.featureChanges.length).toBeGreaterThan(0);
    });

    it('should suggest patch bump for fixes', () => {
      const fromDomain: Domain = {
        name: 'User',
        version: '1.0.0',
        entities: [{
          name: 'User',
          fields: [{
            name: 'email',
            type: 'String',
            optional: false,
          }],
        }],
        behaviors: [],
        types: [],
      };

      const toDomain: Domain = {
        name: 'User',
        version: '1.0.1',
        entities: [{
          name: 'User',
          fields: [{
            name: 'email',
            type: 'String',
            optional: true, // required -> optional (relaxing constraint)
          }],
        }],
        behaviors: [],
        types: [],
      };

      const diff = diffDomains(fromDomain, toDomain);
      const bump = rules.determineBump('User@1.0.0', diff);

      expect(bump.type).toBe('patch');
      expect(bump.toVersion).toBe('1.0.1');
    });

    it('should suggest no bump when no changes', () => {
      const domain: Domain = {
        name: 'User',
        version: '1.0.0',
        entities: [{
          name: 'User',
          fields: [{
            name: 'email',
            type: 'String',
            optional: false,
          }],
        }],
        behaviors: [],
        types: [],
      };

      const diff = diffDomains(domain, domain);
      const bump = rules.determineBump('User@1.0.0', diff);

      expect(bump.type).toBe('none');
      expect(bump.toVersion).toBe('1.0.0');
    });
  });

  describe('determineVersionBump', () => {
    it('should work with domain objects', () => {
      const fromDomain: Domain = {
        name: 'User',
        version: '1.0.0',
        entities: [{
          name: 'User',
          fields: [{
            name: 'email',
            type: 'String',
            optional: false,
          }],
        }],
        behaviors: [],
        types: [],
      };

      const toDomain: Domain = {
        name: 'User',
        version: '2.0.0',
        entities: [{
          name: 'User',
          fields: [],
        }],
        behaviors: [],
        types: [],
      };

      const bump = determineVersionBump(
        { name: 'User', version: '1.0.0' },
        { name: 'User', version: '2.0.0' },
        fromDomain,
        toDomain
      );

      expect(bump.type).toBe('major');
      expect(bump.toVersion).toBe('2.0.0');
    });
  });
});
