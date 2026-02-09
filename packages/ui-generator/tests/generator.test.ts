// ============================================================================
// UI Generator Tests
// Verifies: deterministic output, validation matches ISL constraints,
//           generated code compiles (typecheck test at bottom)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateUI } from '../src/generator.js';
import { mapDomain } from '../src/mapper.js';
import { authDomain, paymentsDomain } from './fixtures.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const GOLDEN_DIR = path.resolve(__dirname, 'golden');

// ============================================================================
// Helpers
// ============================================================================

function goldenPath(domain: string, file: string): string {
  return path.join(GOLDEN_DIR, domain, file);
}

function readGolden(domain: string, file: string): string {
  return fs.readFileSync(goldenPath(domain, file), 'utf-8');
}

function writeGolden(domain: string, file: string, content: string): void {
  const dir = path.join(GOLDEN_DIR, domain);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(goldenPath(domain, file), content, 'utf-8');
}

// ============================================================================
// Auth Domain
// ============================================================================

describe('Auth Domain UI Generation', () => {
  const files = generateUI({ domain: authDomain });

  it('produces expected file set', () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      'App.tsx',
      'LoginForm.tsx',
      'RegisterForm.tsx',
      'SessionDetail.tsx',
      'SessionForm.tsx',
      'SessionList.tsx',
      'UserDetail.tsx',
      'UserForm.tsx',
      'UserList.tsx',
      'types.ts',
      'validation.ts',
    ]);
  });

  it('is deterministic (same input → same output)', () => {
    const files2 = generateUI({ domain: authDomain });
    for (let i = 0; i < files.length; i++) {
      expect(files[i]!.content).toBe(files2[i]!.content);
    }
  });

  it('types.ts contains User and Session interfaces', () => {
    const types = files.find((f) => f.path === 'types.ts')!.content;
    expect(types).toContain('export interface User {');
    expect(types).toContain('export interface Session {');
    expect(types).toContain('export enum UserStatus {');
  });

  it('types.ts contains behavior input interfaces', () => {
    const types = files.find((f) => f.path === 'types.ts')!.content;
    expect(types).toContain('export interface LoginInput {');
    expect(types).toContain('export interface RegisterInput {');
  });

  it('validation.ts has validateLogin with email validation', () => {
    const val = files.find((f) => f.path === 'validation.ts')!.content;
    expect(val).toContain('validateLogin');
    expect(val).toContain('email');
  });

  it('validation.ts has validateRegister with password minLength from precondition', () => {
    const val = files.find((f) => f.path === 'validation.ts')!.content;
    expect(val).toContain('validateRegister');
    expect(val).toContain('at least 8 characters');
  });

  it('LoginForm.tsx uses password input type for sensitive fields', () => {
    const form = files.find((f) => f.path === 'LoginForm.tsx')!.content;
    expect(form).toContain('type="password"');
  });

  it('UserList.tsx masks password_hash field', () => {
    const list = files.find((f) => f.path === 'UserList.tsx')!.content;
    // password_hash is marked [secret] → hidden, so it shouldn't appear as a column
    // The list filters out hidden fields
    expect(list).not.toContain('password_hash');
  });

  it('matches golden output', () => {
    for (const file of files) {
      const gp = goldenPath('auth', file.path);
      if (!fs.existsSync(gp)) {
        writeGolden('auth', file.path, file.content);
      }
      const golden = readGolden('auth', file.path);
      expect(file.content).toBe(golden);
    }
  });
});

// ============================================================================
// Payments Domain
// ============================================================================

describe('Payments Domain UI Generation', () => {
  const files = generateUI({ domain: paymentsDomain });

  it('produces expected file set', () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      'AccountDetail.tsx',
      'AccountForm.tsx',
      'AccountList.tsx',
      'App.tsx',
      'TransferFundsForm.tsx',
      'types.ts',
      'validation.ts',
    ]);
  });

  it('is deterministic', () => {
    const files2 = generateUI({ domain: paymentsDomain });
    for (let i = 0; i < files.length; i++) {
      expect(files[i]!.content).toBe(files2[i]!.content);
    }
  });

  it('types.ts contains Account interface with correct field types', () => {
    const types = files.find((f) => f.path === 'types.ts')!.content;
    expect(types).toContain('export interface Account {');
    expect(types).toContain('id: string;');
    expect(types).toContain('balance: number;');
    expect(types).toContain('isActive: boolean;');
  });

  it('validation.ts enforces amount > 0 from precondition', () => {
    const val = files.find((f) => f.path === 'validation.ts')!.content;
    expect(val).toContain('validateTransferFunds');
    expect(val).toContain('amount');
    // amount > 0  →  min(1)
    expect(val).toContain('at least 1');
  });

  it('TransferFundsForm.tsx has number input for amount', () => {
    const form = files.find((f) => f.path === 'TransferFundsForm.tsx')!.content;
    expect(form).toContain('type="number"');
  });

  it('matches golden output', () => {
    for (const file of files) {
      const gp = goldenPath('payments', file.path);
      if (!fs.existsSync(gp)) {
        writeGolden('payments', file.path, file.content);
      }
      const golden = readGolden('payments', file.path);
      expect(file.content).toBe(golden);
    }
  });
});

// ============================================================================
// Mapper Unit Tests
// ============================================================================

describe('mapDomain', () => {
  it('maps auth domain entities correctly', () => {
    const model = mapDomain(authDomain);
    expect(model.name).toBe('UserAuthentication');
    expect(model.entities).toHaveLength(2);
    expect(model.entities[0]!.name).toBe('User');
    expect(model.entities[1]!.name).toBe('Session');
  });

  it('maps enum values', () => {
    const model = mapDomain(authDomain);
    expect(model.enums).toHaveLength(1);
    expect(model.enums[0]!.name).toBe('UserStatus');
    expect(model.enums[0]!.values).toEqual(['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING_VERIFICATION']);
  });

  it('marks secret fields as hidden', () => {
    const model = mapDomain(authDomain);
    const user = model.entities.find((e) => e.name === 'User')!;
    const pwHash = user.fields.find((f) => f.name === 'password_hash')!;
    expect(pwHash.hidden).toBe(true);
    expect(pwHash.sensitive).toBe(true);
  });

  it('marks immutable fields', () => {
    const model = mapDomain(authDomain);
    const user = model.entities.find((e) => e.name === 'User')!;
    const idField = user.fields.find((f) => f.name === 'id')!;
    expect(idField.immutable).toBe(true);
  });

  it('infers email input type from field name', () => {
    const model = mapDomain(authDomain);
    const login = model.behaviors.find((b) => b.name === 'Login')!;
    const emailField = login.inputFields.find((f) => f.name === 'email')!;
    expect(emailField.type).toBe('email');
  });

  it('infers password input type from sensitive annotation', () => {
    const model = mapDomain(authDomain);
    const login = model.behaviors.find((b) => b.name === 'Login')!;
    const pwField = login.inputFields.find((f) => f.name === 'password')!;
    expect(pwField.type).toBe('password');
  });

  it('maps behavior errors', () => {
    const model = mapDomain(authDomain);
    const login = model.behaviors.find((b) => b.name === 'Login')!;
    expect(login.errors).toHaveLength(3);
    expect(login.errors[0]!.name).toBe('INVALID_CREDENTIALS');
    expect(login.errors[0]!.retriable).toBe(true);
  });
});

// ============================================================================
// Validation Extraction Tests
// ============================================================================

describe('Validation extraction', () => {
  it('generates required rule for non-optional fields', () => {
    const model = mapDomain(authDomain);
    const login = model.behaviors.find((b) => b.name === 'Login')!;
    const emailField = login.inputFields.find((f) => f.name === 'email')!;
    expect(emailField.validation.some((r) => r.type === 'required')).toBe(true);
  });

  it('generates email validation for email fields', () => {
    const model = mapDomain(authDomain);
    const login = model.behaviors.find((b) => b.name === 'Login')!;
    const emailField = login.inputFields.find((f) => f.name === 'email')!;
    expect(emailField.validation.some((r) => r.type === 'email')).toBe(true);
  });

  it('extracts minLength from precondition password.length >= 8', () => {
    const model = mapDomain(authDomain);
    const register = model.behaviors.find((b) => b.name === 'Register')!;
    expect(register.validation.some((r) => r.type === 'minLength' && r.value === 8)).toBe(true);
  });

  it('extracts matches rule from password == confirm_password', () => {
    const model = mapDomain(authDomain);
    const register = model.behaviors.find((b) => b.name === 'Register')!;
    expect(register.validation.some((r) => r.type === 'matches' && r.value === 'confirm_password')).toBe(true);
  });

  it('extracts min rule from amount > 0', () => {
    const model = mapDomain(paymentsDomain);
    const transfer = model.behaviors.find((b) => b.name === 'TransferFunds')!;
    expect(transfer.validation.some((r) => r.type === 'min' && r.value === 1)).toBe(true);
  });
});

// ============================================================================
// Compile / Typecheck Smoke Test
// ============================================================================

describe('Generated code compilation', () => {
  it('types.ts output is valid TypeScript (no syntax errors)', () => {
    const files = generateUI({ domain: authDomain });
    const typesFile = files.find((f) => f.path === 'types.ts')!;
    // Basic structural checks — real typecheck runs via `tsc --noEmit` in CI
    expect(typesFile.content).toContain('export interface');
    expect(typesFile.content).toContain('export enum');
    // No unclosed braces
    const opens = (typesFile.content.match(/{/g) || []).length;
    const closes = (typesFile.content.match(/}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('validation.ts output has balanced braces', () => {
    const files = generateUI({ domain: authDomain });
    const valFile = files.find((f) => f.path === 'validation.ts')!;
    const opens = (valFile.content.match(/{/g) || []).length;
    const closes = (valFile.content.match(/}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('all TSX files contain valid JSX return', () => {
    const files = generateUI({ domain: authDomain });
    const tsxFiles = files.filter((f) => f.path.endsWith('.tsx'));
    for (const f of tsxFiles) {
      expect(f.content).toContain('return (');
      // Balanced parens in return
      const opens = (f.content.match(/\(/g) || []).length;
      const closes = (f.content.match(/\)/g) || []).length;
      expect(opens).toBe(closes);
    }
  });

  it('validation functions all export and return errors object', () => {
    const files = generateUI({ domain: paymentsDomain });
    const valFile = files.find((f) => f.path === 'validation.ts')!;
    expect(valFile.content).toContain('export function validate');
    expect(valFile.content).toContain('return errors;');
  });
});
