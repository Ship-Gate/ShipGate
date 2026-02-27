/**
 * Tests for AutoSpecGenerator and tiered verification
 */

import { describe, it, expect } from 'vitest';
import {
  generateUtilitySpec,
  isUtilityFile,
  classifyTier,
  calculateWeightedTrustScore,
  DEFAULT_TIER_CONFIG,
} from '../src/auto-spec/index.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

describe('AutoSpecGenerator', () => {
  it('extracts exports from a utility file', async () => {
    const source = `
export function getConnection(): Connection { return {} as Connection; }
export async function runQuery(sql: string): Promise<Result> { return {} as Result; }
export const DB_CONFIG = { host: 'localhost' };
export type Connection = { id: string };
export interface Result { rows: unknown[]; }
`;
    const result = await generateUtilitySpec('/fake/db.ts', source);
    expect(result).not.toBeNull();
    expect(result!.exports.length).toBeGreaterThanOrEqual(4);
    expect(result!.exports.map((e) => e.name)).toContain('getConnection');
    expect(result!.exports.map((e) => e.name)).toContain('runQuery');
    expect(result!.exports.map((e) => e.name)).toContain('DB_CONFIG');
  });

  it('extracts dependencies from imports', async () => {
    const source = `
import { Pool } from 'pg';
import * as fs from 'fs';
import config from './config';
export function foo() {}
`;
    const result = await generateUtilitySpec('/fake/utils.ts', source);
    expect(result).not.toBeNull();
    expect(result!.dependencies.some((d) => d.specifier === 'pg')).toBe(true);
  });

  it('generates parseable ISL with @tier 3 marker', async () => {
    const source = `
export function validateEmail(email: string): boolean { return true; }
export function validatePassword(pwd: string): boolean { return true; }
`;
    const result = await generateUtilitySpec('/fake/validators.ts', source);
    expect(result).not.toBeNull();
    expect(result!.islContent).toContain('# @tier 3');
    expect(result!.islContent).toContain('domain');
    expect(result!.islContent).toContain('invariants');
  });

  it('returns null for empty file', async () => {
    const result = await generateUtilitySpec('/fake/empty.ts', '');
    expect(result).toBeNull();
  });

  it('returns null for file with no exports', async () => {
    const result = await generateUtilitySpec('/fake/private.ts', 'function helper() {}');
    expect(result).toBeNull();
  });
});

describe('isUtilityFile', () => {
  it('identifies db.ts as utility', () => {
    expect(isUtilityFile('src/lib/db.ts')).toBe(true);
  });

  it('identifies validators.ts as utility', () => {
    expect(isUtilityFile('src/validators.ts')).toBe(true);
  });

  it('identifies errors.ts as utility', () => {
    expect(isUtilityFile('src/errors.ts')).toBe(true);
  });

  it('identifies middleware.ts as utility', () => {
    expect(isUtilityFile('src/middleware.ts')).toBe(true);
  });

  it('identifies config.ts as utility', () => {
    expect(isUtilityFile('src/config.ts')).toBe(true);
  });

  it('does not identify route handler as utility', () => {
    expect(isUtilityFile('src/app/api/users/route.ts')).toBe(false);
  });
});

describe('classifyTier', () => {
  it('classifies route handlers as Tier 1', () => {
    expect(classifyTier('src/app/api/users/route.ts')).toBe(1);
  });

  it('classifies services as Tier 1', () => {
    expect(classifyTier('src/services/userService.ts')).toBe(1);
  });

  it('classifies models as Tier 2', () => {
    expect(classifyTier('src/models/User.ts')).toBe(2);
  });

  it('classifies utility files as Tier 3', () => {
    expect(classifyTier('src/lib/db.ts')).toBe(3);
  });

  it('respects @tier 3 marker in spec (when provided)', () => {
    expect(classifyTier('src/some-file.ts', '# @tier 3 — Auto-generated')).toBe(3);
  });
});

describe('calculateWeightedTrustScore', () => {
  it('weights Tier 1 higher than Tier 3', () => {
    const fileScores = [
      { file: 'route.ts', score: 0.5, tier: 1 as const },
      { file: 'db.ts', score: 1.0, tier: 3 as const },
    ];
    const { overallScore } = calculateWeightedTrustScore(fileScores);
    // (0.5*3 + 1.0*1) / (3+1) = 2.5/4 = 0.625, rounded to 0.63
    expect(overallScore).toBe(0.63);
  });

  it('uses default tier config', () => {
    expect(DEFAULT_TIER_CONFIG.tier1Weight).toBe(3);
    expect(DEFAULT_TIER_CONFIG.tier2Weight).toBe(2);
    expect(DEFAULT_TIER_CONFIG.tier3Weight).toBe(1);
  });

  it('returns 0 for empty input', () => {
    const { overallScore } = calculateWeightedTrustScore([]);
    expect(overallScore).toBe(0);
  });
});
