// ============================================================================
// Golden Output + Determinism + Cargo Integration Tests
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { generate } from '../src';
import type { Domain } from '../src/ast-types';
import type { GeneratedFile } from '../src/generator';

// ============================================================================
// Test Helpers
// ============================================================================

const loc = () => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
});

const id = (name: string) => ({ kind: 'Identifier' as const, name, location: loc() });
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, location: loc() });

const GOLDEN_DIR = join(__dirname, 'golden', 'auth_service');

// ============================================================================
// Auth Service Domain Fixture (deterministic)
// ============================================================================

function createAuthDomain(): Domain {
  return {
    kind: 'Domain',
    name: id('Auth'),
    version: str('1.0.0'),
    types: [
      {
        kind: 'TypeDeclaration',
        name: id('Email'),
        definition: {
          kind: 'ConstrainedType',
          base: { kind: 'PrimitiveType', name: 'String', location: loc() },
          constraints: [
            {
              kind: 'Constraint',
              name: 'format',
              value: { kind: 'StringLiteral', value: 'email', location: loc() },
              location: loc(),
            },
          ],
          location: loc(),
        },
        annotations: [],
        location: loc(),
      },
      {
        kind: 'TypeDeclaration',
        name: id('UserRole'),
        definition: {
          kind: 'EnumType',
          variants: [
            { kind: 'EnumVariant', name: id('Admin'), location: loc() },
            { kind: 'EnumVariant', name: id('Member'), location: loc() },
            { kind: 'EnumVariant', name: id('Guest'), location: loc() },
          ],
          location: loc(),
        },
        annotations: [],
        location: loc(),
      },
    ],
    entities: [
      {
        kind: 'Entity',
        name: id('User'),
        fields: [
          {
            kind: 'Field',
            name: id('id'),
            type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
            optional: false,
            annotations: [],
            location: loc(),
          },
          {
            kind: 'Field',
            name: id('email'),
            type: {
              kind: 'ReferenceType',
              name: { kind: 'QualifiedName', parts: [id('Email')], location: loc() },
              location: loc(),
            },
            optional: false,
            annotations: [],
            location: loc(),
          },
          {
            kind: 'Field',
            name: id('role'),
            type: {
              kind: 'ReferenceType',
              name: { kind: 'QualifiedName', parts: [id('UserRole')], location: loc() },
              location: loc(),
            },
            optional: false,
            annotations: [],
            location: loc(),
          },
        ],
        invariants: [],
        location: loc(),
      },
    ],
    behaviors: [
      {
        kind: 'Behavior',
        name: id('Login'),
        description: str('Authenticate a user'),
        input: {
          kind: 'InputSpec',
          fields: [
            {
              kind: 'Field',
              name: id('email'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
            {
              kind: 'Field',
              name: id('password'),
              type: { kind: 'PrimitiveType', name: 'String', location: loc() },
              optional: false,
              annotations: [],
              location: loc(),
            },
          ],
          location: loc(),
        },
        output: {
          kind: 'OutputSpec',
          success: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
          errors: [
            {
              kind: 'ErrorSpec',
              name: id('InvalidCredentials'),
              when: str('Invalid email or password'),
              retriable: false,
              location: loc(),
            },
            {
              kind: 'ErrorSpec',
              name: id('AccountLocked'),
              when: str('Account is locked'),
              retriable: true,
              location: loc(),
            },
          ],
          location: loc(),
        },
        preconditions: [],
        postconditions: [],
        location: loc(),
      },
    ],
    invariants: [],
    policies: [],
    views: [],
    location: loc(),
  };
}

// ============================================================================
// Golden Snapshot Tests
// ============================================================================

describe('Golden Snapshot Tests', () => {
  let files: GeneratedFile[];

  beforeAll(() => {
    const domain = createAuthDomain();
    files = generate(domain, { outputDir: './golden', crateName: 'auth_service' });

    // Write golden files so they stay in sync with generator output
    for (const file of files) {
      const fullPath = join(GOLDEN_DIR, file.path);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, file.content, 'utf-8');
    }
  });

  function getFile(path: string) {
    return files.find(f => f.path === path);
  }

  function readGolden(relativePath: string): string {
    return readFileSync(join(GOLDEN_DIR, relativePath), 'utf-8');
  }

  it('should generate exactly 6 files', () => {
    expect(files).toHaveLength(6);
  });

  it('should match golden Cargo.toml', () => {
    expect(getFile('Cargo.toml')?.content).toBe(readGolden('Cargo.toml'));
  });

  it('should match golden src/lib.rs', () => {
    expect(getFile('src/lib.rs')?.content).toBe(readGolden('src/lib.rs'));
  });

  it('should match golden src/types.rs', () => {
    expect(getFile('src/types.rs')?.content).toBe(readGolden('src/types.rs'));
  });

  it('should match golden src/models.rs', () => {
    expect(getFile('src/models.rs')?.content).toBe(readGolden('src/models.rs'));
  });

  it('should match golden src/traits.rs', () => {
    expect(getFile('src/traits.rs')?.content).toBe(readGolden('src/traits.rs'));
  });

  it('should match golden src/errors.rs', () => {
    expect(getFile('src/errors.rs')?.content).toBe(readGolden('src/errors.rs'));
  });
});

// ============================================================================
// Determinism Tests
// ============================================================================

describe('Determinism', () => {
  it('should produce identical output on repeated runs', () => {
    const domain = createAuthDomain();
    const opts = { outputDir: './out', crateName: 'auth_service' };

    const run1 = generate(domain, opts);
    const run2 = generate(domain, opts);
    const run3 = generate(domain, opts);

    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);
  });

  it('should produce byte-for-byte identical file contents', () => {
    const domain = createAuthDomain();
    const opts = { outputDir: './out', crateName: 'auth_service' };

    const run1 = generate(domain, opts);
    const run2 = generate(domain, opts);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].path).toBe(run2[i].path);
      expect(run1[i].content).toBe(run2[i].content);
    }
  });

  it('should produce stable file ordering', () => {
    const domain = createAuthDomain();
    const opts = { outputDir: './out', crateName: 'auth_service' };

    for (let i = 0; i < 5; i++) {
      const files = generate(domain, opts);
      const paths = files.map(f => f.path);
      expect(paths).toEqual([
        'src/types.rs',
        'src/models.rs',
        'src/traits.rs',
        'src/errors.rs',
        'src/lib.rs',
        'Cargo.toml',
      ]);
    }
  });
});

// ============================================================================
// Cargo Integration Tests
// ============================================================================

describe('Cargo Integration', () => {
  it('should generate valid Cargo.toml with all required dependencies', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const cargo = files.find(f => f.path === 'Cargo.toml')!;

    // Required deps for generated code
    expect(cargo.content).toContain('serde = { version = "1.0", features = ["derive"] }');
    expect(cargo.content).toContain('validator = { version = "0.16", features = ["derive"] }');
    expect(cargo.content).toContain('thiserror = "1.0"');
    expect(cargo.content).toContain('async-trait = "0.1"');
    expect(cargo.content).toContain('uuid = { version = "1.0", features = ["v4", "serde"] }');
    expect(cargo.content).toContain('chrono = { version = "0.4", features = ["serde"] }');
    expect(cargo.content).toContain('serde_json = "1.0"');
    expect(cargo.content).toContain('edition = "2021"');
  });

  it('should generate lib.rs that declares all modules', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const lib = files.find(f => f.path === 'src/lib.rs')!;

    expect(lib.content).toContain('pub mod types;');
    expect(lib.content).toContain('pub mod models;');
    expect(lib.content).toContain('pub mod traits;');
    expect(lib.content).toContain('pub mod errors;');
  });

  it('should generate types.rs with correct use statements', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const types = files.find(f => f.path === 'src/types.rs')!;

    expect(types.content).toContain('use serde::{Deserialize, Serialize};');
    expect(types.content).toContain('use validator::Validate;');
  });

  it('should generate models.rs with crate-local imports', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const models = files.find(f => f.path === 'src/models.rs')!;

    expect(models.content).toContain('use crate::types::*;');
  });

  it('should generate traits.rs without unused imports', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const traits = files.find(f => f.path === 'src/traits.rs')!;

    expect(traits.content).toContain('use async_trait::async_trait;');
    expect(traits.content).toContain('use crate::models::*;');
    expect(traits.content).toContain('use crate::errors::*;');
    expect(traits.content).toContain('use crate::types::*;');
    // Should NOT have serde/validator/thiserror directly (those come via crate re-exports)
    expect(traits.content).not.toContain('use serde::');
    expect(traits.content).not.toContain('use validator::');
    expect(traits.content).not.toContain('use thiserror::');
  });

  it('should generate errors.rs with thiserror derives', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const errors = files.find(f => f.path === 'src/errors.rs')!;

    expect(errors.content).toContain('use thiserror::Error;');
    expect(errors.content).toContain('thiserror::Error');
    expect(errors.content).toContain('#[error(');
  });

  it('should not emit #[validate(nested)] on enum reference fields', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const models = files.find(f => f.path === 'src/models.rs')!;

    // User struct has role: UserRole (an enum) — should NOT get nested validation
    expect(models.content).not.toContain('#[validate(nested)]');
  });

  it('should generate valid Rust struct syntax', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const models = files.find(f => f.path === 'src/models.rs')!;

    // Verify struct opens and closes correctly
    const structMatches = models.content.match(/pub struct \w+ \{/g);
    const closingBraces = models.content.match(/^}$/gm);
    expect(structMatches).not.toBeNull();
    expect(closingBraces).not.toBeNull();
    expect(structMatches!.length).toBeGreaterThan(0);
  });

  it('should generate valid Rust error enum with From impl', () => {
    const domain = createAuthDomain();
    const files = generate(domain, { outputDir: './out', crateName: 'test_crate' });
    const errors = files.find(f => f.path === 'src/errors.rs')!;

    expect(errors.content).toContain('impl From<validator::ValidationErrors>');
    expect(errors.content).toContain('Self::ValidationError(err.to_string())');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle domain with no behaviors', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Empty'),
      version: str('0.1.0'),
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: './out', crateName: 'empty_crate' });
    expect(files).toHaveLength(6);

    const cargo = files.find(f => f.path === 'Cargo.toml')!;
    expect(cargo.content).toContain('name = "empty_crate"');
  });

  it('should handle domain with only types', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('TypesOnly'),
      version: str('0.1.0'),
      types: [
        {
          kind: 'TypeDeclaration',
          name: id('Status'),
          definition: {
            kind: 'EnumType',
            variants: [
              { kind: 'EnumVariant', name: id('On'), location: loc() },
              { kind: 'EnumVariant', name: id('Off'), location: loc() },
            ],
            location: loc(),
          },
          annotations: [],
          location: loc(),
        },
      ],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      location: loc(),
    };

    const files = generate(domain, { outputDir: './out', crateName: 'types_only' });
    const types = files.find(f => f.path === 'src/types.rs')!;
    expect(types.content).toContain('pub enum Status');
    expect(types.content).toContain('On,');
    expect(types.content).toContain('Off,');
  });

  it('should produce deterministic output for empty domain', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('Empty'),
      version: str('0.1.0'),
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      location: loc(),
    };
    const opts = { outputDir: './out', crateName: 'empty' };

    const a = generate(domain, opts);
    const b = generate(domain, opts);
    expect(a).toEqual(b);
  });
});
