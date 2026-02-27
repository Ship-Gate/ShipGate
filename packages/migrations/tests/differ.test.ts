/**
 * Tests for ISL Domain Differ
 */

import { describe, it, expect } from 'vitest';
import type { DomainDeclaration, EntityDeclaration, FieldDeclaration } from '@isl-lang/isl-core';
import { diffDomains, emptyDiff, isDiffEmpty, getDiffSummary } from '../src/differ.js';

// Helper to create mock span
const mockSpan = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };

// Helper to create mock identifier
function id(name: string) {
  return { kind: 'Identifier' as const, name, span: mockSpan };
}

// Helper to create mock simple type
function simpleType(name: string) {
  return { kind: 'SimpleType' as const, name: id(name), span: mockSpan };
}

// Helper to create mock field
function field(name: string, type: string, optional = false): FieldDeclaration {
  return {
    kind: 'FieldDeclaration',
    name: id(name),
    type: simpleType(type),
    optional,
    annotations: [],
    constraints: [],
    span: mockSpan,
  };
}

// Helper to create mock entity
function entity(name: string, fields: FieldDeclaration[]): EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name: id(name),
    fields,
    span: mockSpan,
  };
}

// Helper to create mock domain
function domain(name: string, entities: EntityDeclaration[], version?: string): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: id(name),
    version: version ? { kind: 'StringLiteral', value: version, span: mockSpan } : undefined,
    imports: [],
    entities,
    types: [],
    enums: [],
    behaviors: [],
    invariants: [],
    span: mockSpan,
  };
}

describe('diffDomains', () => {
  it('should detect no changes between identical domains', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('name', 'String'),
      ]),
    ]);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('name', 'String'),
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(0);
    expect(diff.breaking).toBe(false);
    expect(isDiffEmpty(diff)).toBe(true);
  });
  
  it('should detect added entity', () => {
    const oldDomain = domain('Test', []);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('name', 'String'),
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(1);
    expect(diff.entities[0].type).toBe('added');
    expect(diff.entities[0].entity).toBe('User');
    expect(diff.entities[0].changes).toHaveLength(2);
    expect(diff.breaking).toBe(false);
  });
  
  it('should detect removed entity', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('name', 'String'),
      ]),
    ]);
    
    const newDomain = domain('Test', []);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(1);
    expect(diff.entities[0].type).toBe('removed');
    expect(diff.entities[0].entity).toBe('User');
    expect(diff.breaking).toBe(true);
  });
  
  it('should detect added field', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
      ]),
    ]);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('email', 'Email'),
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(1);
    expect(diff.entities[0].type).toBe('modified');
    expect(diff.entities[0].changes).toHaveLength(1);
    expect(diff.entities[0].changes![0].type).toBe('added');
    expect(diff.entities[0].changes![0].field).toBe('email');
  });
  
  it('should detect removed field', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('email', 'Email'),
      ]),
    ]);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(1);
    expect(diff.entities[0].type).toBe('modified');
    expect(diff.entities[0].changes).toHaveLength(1);
    expect(diff.entities[0].changes![0].type).toBe('removed');
    expect(diff.entities[0].changes![0].field).toBe('email');
    expect(diff.breaking).toBe(true);
  });
  
  it('should detect type change', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('age', 'Int'),
      ]),
    ]);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('age', 'String'),
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(1);
    expect(diff.entities[0].changes).toHaveLength(1);
    expect(diff.entities[0].changes![0].type).toBe('modified');
    expect(diff.entities[0].changes![0].oldType).toBe('Int');
    expect(diff.entities[0].changes![0].newType).toBe('String');
    expect(diff.breaking).toBe(true);
  });
  
  it('should detect nullable change', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('email', 'Email', true), // optional
      ]),
    ]);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('email', 'Email', false), // required
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.entities).toHaveLength(1);
    expect(diff.entities[0].changes).toHaveLength(1);
    expect(diff.entities[0].changes![0].type).toBe('modified');
    expect(diff.entities[0].changes![0].oldNullable).toBe(true);
    expect(diff.entities[0].changes![0].nullable).toBe(false);
    expect(diff.breaking).toBe(true);
  });
  
  it('should calculate correct stats', () => {
    const oldDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('name', 'String'),
      ]),
      entity('Post', [
        field('id', 'UUID'),
      ]),
    ]);
    
    const newDomain = domain('Test', [
      entity('User', [
        field('id', 'UUID'),
        field('email', 'Email'), // added
      ]),
      entity('Comment', [ // added
        field('id', 'UUID'),
      ]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    
    expect(diff.stats.entitiesAdded).toBe(1);
    expect(diff.stats.entitiesRemoved).toBe(1);
    expect(diff.stats.entitiesModified).toBe(1);
    expect(diff.stats.fieldsAdded).toBe(2); // email + Comment.id
    expect(diff.stats.fieldsRemoved).toBe(1); // name
  });
});

describe('emptyDiff', () => {
  it('should create empty diff', () => {
    const testDomain = domain('Test', []);
    const diff = emptyDiff(testDomain);
    
    expect(diff.domain).toBe('Test');
    expect(diff.entities).toHaveLength(0);
    expect(diff.enums).toHaveLength(0);
    expect(diff.types).toHaveLength(0);
    expect(diff.breaking).toBe(false);
  });
});

describe('getDiffSummary', () => {
  it('should generate summary for changes', () => {
    const oldDomain = domain('Test', []);
    const newDomain = domain('Test', [
      entity('User', [field('id', 'UUID')]),
      entity('Post', [field('id', 'UUID')]),
    ]);
    
    const diff = diffDomains(oldDomain, newDomain);
    const summary = getDiffSummary(diff);
    
    expect(summary).toContain('2 entities added');
  });
  
  it('should return "No changes" for empty diff', () => {
    const testDomain = domain('Test', []);
    const diff = emptyDiff(testDomain);
    const summary = getDiffSummary(diff);
    
    expect(summary).toBe('No changes');
  });
});
