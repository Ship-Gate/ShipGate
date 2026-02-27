// ============================================================================
// Proto Compile Validation Tests
//
// Validates that generated .proto files are syntactically correct proto3
// without requiring protoc or buf to be installed.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate, generateProtoOnly } from '../src/generator';
import type { DomainDeclaration } from '@isl-lang/isl-core';

// ==========================================================================
// FIXTURES
// ==========================================================================

const S = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };
const id = (name: string) => ({ kind: 'Identifier' as const, name, span: S });
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, span: S });

const testDomain: DomainDeclaration = {
  kind: 'DomainDeclaration',
  name: id('Payments'),
  version: str('2.0.0'),
  uses: [],
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      name: id('Currency'),
      baseType: { kind: 'SimpleType', name: id('String'), span: S },
      constraints: [],
      span: S,
    },
  ],
  enums: [
    {
      kind: 'EnumDeclaration',
      name: id('PaymentStatus'),
      variants: [id('PENDING'), id('COMPLETED'), id('FAILED'), id('REFUNDED')],
      span: S,
    },
  ],
  entities: [
    {
      kind: 'EntityDeclaration',
      name: id('Payment'),
      fields: [
        { kind: 'FieldDeclaration', name: id('id'), type: { kind: 'SimpleType', name: id('UUID'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('amount'), type: { kind: 'SimpleType', name: id('Decimal'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('currency'), type: { kind: 'SimpleType', name: id('Currency'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('status'), type: { kind: 'SimpleType', name: id('PaymentStatus'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('created_at'), type: { kind: 'SimpleType', name: id('Timestamp'), span: S }, optional: false, annotations: [], constraints: [], span: S },
      ],
      span: S,
    },
  ],
  behaviors: [
    {
      kind: 'BehaviorDeclaration',
      name: id('CreatePayment'),
      description: str('Process a new payment'),
      input: {
        kind: 'InputBlock',
        fields: [
          { kind: 'FieldDeclaration', name: id('amount'), type: { kind: 'SimpleType', name: id('Decimal'), span: S }, optional: false, annotations: [], constraints: [], span: S },
          { kind: 'FieldDeclaration', name: id('currency'), type: { kind: 'SimpleType', name: id('Currency'), span: S }, optional: false, annotations: [], constraints: [], span: S },
          { kind: 'FieldDeclaration', name: id('idempotency_key'), type: { kind: 'SimpleType', name: id('String'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        ],
        span: S,
      },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: id('Payment'), span: S },
        errors: [
          { kind: 'ErrorDeclaration', name: id('INSUFFICIENT_FUNDS'), when: str('Insufficient balance'), retriable: false, span: S },
          { kind: 'ErrorDeclaration', name: id('RATE_LIMITED'), when: str('Too many requests'), retriable: true, span: S },
        ],
        span: S,
      },
      span: S,
    },
  ],
  invariants: [],
  span: S,
};

// ==========================================================================
// PROTO SYNTAX VALIDATION HELPERS
// ==========================================================================

/**
 * Validate that a proto3 file has correct structure without external tools.
 * Checks syntax declaration, package, balanced braces, field numbers,
 * enum zero values, and import format.
 */
function validateProtoSyntax(content: string): string[] {
  const errors: string[] = [];
  const lines = content.split('\n');

  // 1. Must start with syntax = "proto3"
  const syntaxLine = lines.find(l => l.trim().startsWith('syntax'));
  if (!syntaxLine || !syntaxLine.includes('"proto3"')) {
    errors.push('Missing or invalid syntax declaration (expected proto3)');
  }

  // 2. Must have package declaration
  const packageLine = lines.find(l => l.trim().startsWith('package'));
  if (!packageLine) {
    errors.push('Missing package declaration');
  }

  // 3. Balanced braces
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    if (braceDepth < 0) {
      errors.push(`Unbalanced closing brace at line ${i + 1}`);
    }
  }
  if (braceDepth !== 0) {
    errors.push(`Unbalanced braces: depth ${braceDepth} at end of file`);
  }

  // 4. Field numbers must be positive integers
  const fieldPattern = /=\s*(\d+)\s*[;\[]/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fieldPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num < 0 || num > 536870911) {
        errors.push(`Invalid field number ${num} at line ${i + 1}`);
      }
      // Reserved range check
      if (num >= 19000 && num <= 19999) {
        errors.push(`Reserved field number ${num} at line ${i + 1}`);
      }
    }
  }

  // 5. Every enum must have a zero value
  const enumBlocks: { name: string; start: number; hasZero: boolean }[] = [];
  let currentEnum: { name: string; start: number; hasZero: boolean } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      currentEnum = { name: enumMatch[1], start: i + 1, hasZero: false };
    }
    if (currentEnum && trimmed.includes('= 0;')) {
      currentEnum.hasZero = true;
    }
    if (currentEnum && trimmed === '}') {
      enumBlocks.push(currentEnum);
      currentEnum = null;
    }
  }
  for (const eb of enumBlocks) {
    if (!eb.hasZero) {
      errors.push(`Enum ${eb.name} (line ${eb.start}) missing zero value (UNSPECIFIED)`);
    }
  }

  // 6. Import format validation
  const importLines = lines.filter(l => l.trim().startsWith('import'));
  for (const imp of importLines) {
    if (!imp.match(/^import\s+"[^"]+"\s*;/)) {
      errors.push(`Invalid import syntax: ${imp.trim()}`);
    }
  }

  // 7. No duplicate field numbers within a message
  const msgFieldNums = new Map<string, Map<number, number>>();
  let currentMsg: string | null = null;
  let msgDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const msgMatch = trimmed.match(/^message\s+(\w+)\s*\{/);
    if (msgMatch && msgDepth === 0) {
      currentMsg = msgMatch[1];
      msgFieldNums.set(currentMsg, new Map());
      msgDepth = 1;
      continue;
    }
    if (currentMsg) {
      for (const ch of trimmed) {
        if (ch === '{') msgDepth++;
        if (ch === '}') msgDepth--;
      }
      if (msgDepth <= 0) {
        currentMsg = null;
        msgDepth = 0;
        continue;
      }
      const fMatch = trimmed.match(/=\s*(\d+)\s*[;\[]/);
      if (fMatch && msgDepth === 1) {
        const num = parseInt(fMatch[1], 10);
        const fields = msgFieldNums.get(currentMsg)!;
        if (fields.has(num)) {
          errors.push(`Duplicate field number ${num} in message ${currentMsg} at line ${i + 1}`);
        }
        fields.set(num, i + 1);
      }
    }
  }

  return errors;
}

// ==========================================================================
// TESTS
// ==========================================================================

describe('Proto Compile Validation', () => {
  it('should generate valid proto3 syntax for simple domain', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'isl.payments.v2',
      includeValidation: true,
    });

    const errors = validateProtoSyntax(proto);
    expect(errors).toEqual([]);
  });

  it('should generate valid proto3 syntax with CRUD services', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'isl.payments.v2',
      includeValidation: true,
      generateCrud: true,
      generateStreaming: true,
    });

    const errors = validateProtoSyntax(proto);
    expect(errors).toEqual([]);
  });

  it('should have balanced braces in all generated files', () => {
    const files = generate(testDomain, {
      package: 'isl.payments.v2',
      generateTypeScript: true,
      generateGo: true,
      goPackage: 'github.com/test/payments/gen/go',
      includeConnect: true,
      generateCrud: true,
    });

    for (const file of files) {
      let depth = 0;
      for (const ch of file.content) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      expect(depth).toBe(0);
    }
  });

  it('should have correct proto3 package format', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'isl.payments.v2',
    });

    expect(proto).toMatch(/^syntax = "proto3";/m);
    expect(proto).toMatch(/^package isl\.payments\.v2;/m);
  });

  it('should not have reserved field numbers (19000-19999)', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'test.v1',
      includeValidation: true,
      generateCrud: true,
    });

    const errors = validateProtoSyntax(proto);
    const reservedErrors = errors.filter(e => e.includes('Reserved field'));
    expect(reservedErrors).toEqual([]);
  });

  it('should have UNSPECIFIED as first value in every enum', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'test.v1',
      generateCrud: true,
    });

    const errors = validateProtoSyntax(proto);
    const enumErrors = errors.filter(e => e.includes('missing zero value'));
    expect(enumErrors).toEqual([]);
  });

  it('should not have duplicate field numbers', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'test.v1',
      includeValidation: true,
    });

    const errors = validateProtoSyntax(proto);
    const dupErrors = errors.filter(e => e.includes('Duplicate field'));
    expect(dupErrors).toEqual([]);
  });

  it('should have valid import statements', () => {
    const proto = generateProtoOnly(testDomain, {
      package: 'test.v1',
      includeValidation: true,
    });

    const errors = validateProtoSyntax(proto);
    const importErrors = errors.filter(e => e.includes('Invalid import'));
    expect(importErrors).toEqual([]);
  });
});
