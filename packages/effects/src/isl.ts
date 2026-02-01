/**
 * ISL Effect Specifications
 * 
 * Defines effect constraints in ISL syntax and provides verification
 */

import type { AnyEffect, EffectSpec, EffectConstraint } from './types';
import { collectEffects } from './runtime';

/**
 * Effect verification result
 */
export interface EffectVerificationResult {
  valid: boolean;
  errors: EffectError[];
  warnings: EffectWarning[];
  effectCounts: Map<string, number>;
}

/**
 * Effect error
 */
export interface EffectError {
  type: 'forbidden' | 'missing_required' | 'exceeded_max' | 'constraint_violation';
  message: string;
  effect?: AnyEffect;
  constraint?: EffectConstraint;
}

/**
 * Effect warning
 */
export interface EffectWarning {
  type: 'unusual_pattern' | 'performance' | 'security';
  message: string;
  effect?: AnyEffect;
}

/**
 * Parse ISL effect specification
 */
export function parseEffectSpec(isl: string): EffectSpec {
  const lines = isl.split('\n').map((l) => l.trim()).filter((l) => l);
  const spec: EffectSpec = {
    name: '',
    effects: [],
    forbidden: [],
    required: [],
  };

  for (const line of lines) {
    if (line.startsWith('effects ')) {
      spec.name = line.replace('effects ', '').replace(' {', '');
    } else if (line.startsWith('allow ')) {
      const tag = line.replace('allow ', '').replace(';', '');
      spec.effects.push({ tag, allowed: true });
    } else if (line.startsWith('forbid ')) {
      const tag = line.replace('forbid ', '').replace(';', '');
      spec.effects.push({ tag, allowed: false });
      spec.forbidden?.push(tag);
    } else if (line.startsWith('require ')) {
      const tag = line.replace('require ', '').replace(';', '');
      spec.required?.push(tag);
    } else if (line.startsWith('max ')) {
      const match = line.match(/max (\w+) (\d+)/);
      if (match) {
        const existing = spec.effects.find((e) => e.tag === match[1]);
        if (existing) {
          existing.maxOccurrences = parseInt(match[2], 10);
        } else {
          spec.effects.push({
            tag: match[1],
            allowed: true,
            maxOccurrences: parseInt(match[2], 10),
          });
        }
      }
    }
  }

  return spec;
}

/**
 * Verify effects against a specification
 */
export function verifyEffects(
  effects: AnyEffect | AnyEffect[],
  spec: EffectSpec
): EffectVerificationResult {
  const allEffects = Array.isArray(effects)
    ? effects.flatMap((e) => collectEffects(e))
    : collectEffects(effects);

  const errors: EffectError[] = [];
  const warnings: EffectWarning[] = [];
  const effectCounts = new Map<string, number>();

  // Count effects
  for (const effect of allEffects) {
    effectCounts.set(effect._tag, (effectCounts.get(effect._tag) ?? 0) + 1);
  }

  // Check forbidden effects
  for (const forbidden of spec.forbidden ?? []) {
    if (effectCounts.has(forbidden)) {
      errors.push({
        type: 'forbidden',
        message: `Forbidden effect used: ${forbidden}`,
        effect: allEffects.find((e) => e._tag === forbidden),
      });
    }
  }

  // Check required effects
  for (const required of spec.required ?? []) {
    if (!effectCounts.has(required)) {
      errors.push({
        type: 'missing_required',
        message: `Required effect missing: ${required}`,
      });
    }
  }

  // Check constraints
  for (const constraint of spec.effects) {
    const count = effectCounts.get(constraint.tag) ?? 0;

    if (!constraint.allowed && count > 0) {
      errors.push({
        type: 'constraint_violation',
        message: `Effect ${constraint.tag} is not allowed`,
        constraint,
      });
    }

    if (constraint.maxOccurrences !== undefined && count > constraint.maxOccurrences) {
      errors.push({
        type: 'exceeded_max',
        message: `Effect ${constraint.tag} exceeded max occurrences (${count} > ${constraint.maxOccurrences})`,
        constraint,
      });
    }
  }

  // Add warnings for common issues
  if ((effectCounts.get('Network') ?? 0) > 10) {
    warnings.push({
      type: 'performance',
      message: 'High number of network effects detected, consider batching',
    });
  }

  if ((effectCounts.get('Shell') ?? 0) > 0) {
    warnings.push({
      type: 'security',
      message: 'Shell effects detected, ensure proper input sanitization',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectCounts,
  };
}

/**
 * Generate ISL effect specification from effects
 */
export function generateEffectSpec(
  name: string,
  effects: AnyEffect | AnyEffect[]
): string {
  const allEffects = Array.isArray(effects)
    ? effects.flatMap((e) => collectEffects(e))
    : collectEffects(effects);

  const effectTags = new Set(allEffects.map((e) => e._tag));
  const effectCounts = new Map<string, number>();

  for (const effect of allEffects) {
    effectCounts.set(effect._tag, (effectCounts.get(effect._tag) ?? 0) + 1);
  }

  const lines = [`effects ${name} {`];

  for (const tag of effectTags) {
    if (tag === 'Sequence' || tag === 'Parallel' || tag === 'Conditional') {
      continue;
    }
    lines.push(`  allow ${tag};`);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * ISL effect DSL builder
 */
export class EffectSpecBuilder {
  private spec: EffectSpec;

  constructor(name: string) {
    this.spec = {
      name,
      effects: [],
      forbidden: [],
      required: [],
    };
  }

  allow(tag: string, maxOccurrences?: number): this {
    this.spec.effects.push({ tag, allowed: true, maxOccurrences });
    return this;
  }

  forbid(tag: string): this {
    this.spec.effects.push({ tag, allowed: false });
    this.spec.forbidden?.push(tag);
    return this;
  }

  require(tag: string): this {
    this.spec.required?.push(tag);
    return this;
  }

  description(desc: string): this {
    this.spec.description = desc;
    return this;
  }

  build(): EffectSpec {
    return this.spec;
  }

  toISL(): string {
    const lines = [`effects ${this.spec.name} {`];

    if (this.spec.description) {
      lines.push(`  // ${this.spec.description}`);
    }

    for (const tag of this.spec.required ?? []) {
      lines.push(`  require ${tag};`);
    }

    for (const constraint of this.spec.effects) {
      if (constraint.allowed) {
        if (constraint.maxOccurrences !== undefined) {
          lines.push(`  allow ${constraint.tag};`);
          lines.push(`  max ${constraint.tag} ${constraint.maxOccurrences};`);
        } else {
          lines.push(`  allow ${constraint.tag};`);
        }
      } else {
        lines.push(`  forbid ${constraint.tag};`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }
}

/**
 * Create an effect spec builder
 */
export function effectSpec(name: string): EffectSpecBuilder {
  return new EffectSpecBuilder(name);
}

/**
 * Pre-built effect specifications for common patterns
 */
export const CommonEffectSpecs = {
  /**
   * Pure computation - no side effects
   */
  pure: effectSpec('Pure')
    .description('Pure computation with no side effects')
    .forbid('Network')
    .forbid('Database')
    .forbid('FileSystem')
    .forbid('Shell')
    .forbid('Message')
    .allow('Log')
    .allow('Time')
    .build(),

  /**
   * Read-only - can read but not write
   */
  readOnly: effectSpec('ReadOnly')
    .description('Read-only operations')
    .allow('Read')
    .allow('Network', 10)
    .allow('Database')
    .allow('Log')
    .forbid('Write')
    .forbid('Shell')
    .build(),

  /**
   * HTTP service - network and logging only
   */
  httpService: effectSpec('HttpService')
    .description('HTTP service behavior')
    .allow('Network')
    .allow('Log')
    .allow('Time')
    .allow('Random')
    .allow('Env')
    .forbid('FileSystem')
    .forbid('Shell')
    .build(),

  /**
   * Database service - database operations
   */
  databaseService: effectSpec('DatabaseService')
    .description('Database service behavior')
    .allow('Database')
    .allow('Log')
    .allow('Time')
    .forbid('Network')
    .forbid('FileSystem')
    .forbid('Shell')
    .build(),

  /**
   * Background job - full access
   */
  backgroundJob: effectSpec('BackgroundJob')
    .description('Background job with full effect access')
    .allow('Network')
    .allow('Database')
    .allow('FileSystem')
    .allow('Message')
    .allow('Log')
    .allow('Time')
    .allow('Random')
    .allow('Env')
    .forbid('Shell')
    .build(),
};
