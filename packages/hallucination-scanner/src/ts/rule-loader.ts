/**
 * Custom Rule Loader for HallucinationDetector
 *
 * Load user-defined rules from files or programmatically.
 *
 * @module @isl-lang/hallucination-scanner/ts/rule-loader
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { HallucinationRule } from './hallucination-rules.js';
import { getBuiltinRules } from './rules/builtin.js';
import type { RuleSetId } from './hallucination-rules.js';

export interface RuleLoaderOptions {
  /** Built-in rule sets to include (e.g. ['nextjs', 'prisma']) */
  ruleSets?: RuleSetId[];
  /** Custom rules to add */
  customRules?: HallucinationRule[];
  /** Path to a JS/TS file that exports rules (default: .hallucination-rules.js in project root) */
  rulesFile?: string;
}

/**
 * Load rules from options. Merges built-in rules (by rule set) with custom rules.
 */
export async function loadRules(options: RuleLoaderOptions = {}): Promise<HallucinationRule[]> {
  const { ruleSets = [], customRules = [], rulesFile } = options;

  const rules: HallucinationRule[] = [];
  const seenIds = new Set<string>();

  // 1. Built-in rules from rule sets (empty = all rules)
  const builtin = getBuiltinRules(ruleSets.length > 0 ? ruleSets : undefined);
  for (const r of builtin) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      rules.push(r);
    }
  }

  // 2. Custom rules from options
  for (const r of customRules) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      rules.push(r);
    }
  }

  // 3. Load from file if specified
  if (rulesFile) {
    const fileRules = await loadRulesFromFile(rulesFile);
    for (const r of fileRules) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        rules.push(r);
      }
    }
  }

  return rules;
}

/**
 * Load rules from a JS/TS file. The file must export:
 * - `rules: HallucinationRule[]` or
 * - `default: HallucinationRule[]` or
 * - individual named exports that are HallucinationRule
 */
export async function loadRulesFromFile(filePath: string): Promise<HallucinationRule[]> {
  const resolved = path.resolve(filePath);
  try {
    const mod = await import(resolved);
    if (Array.isArray(mod.rules)) return mod.rules;
    if (Array.isArray(mod.default)) return mod.default;
    const rules: HallucinationRule[] = [];
    for (const key of Object.keys(mod)) {
      if (key === 'default') continue;
      const val = mod[key];
      if (val && typeof val === 'object' && typeof val.run === 'function' && val.id) {
        rules.push(val as HallucinationRule);
      }
    }
    return rules;
  } catch (err) {
    throw new Error(`Failed to load rules from ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
