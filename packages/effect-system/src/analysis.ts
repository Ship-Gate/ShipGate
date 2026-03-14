/**
 * Effect Analysis
 * 
 * Static analysis of effects in ISL specifications.
 */

import type {
  EffectAnalysisResult,
  EffectWarning,
  ISLEffectAnnotation,
  EffectKind,
  EffectSignature,
} from './types';
import { parseEffectAnnotations } from './runtime';

/**
 * Effect analyzer for ISL specifications
 */
export class EffectAnalyzer {
  /**
   * Analyze a behavior for effects
   */
  analyzeBehavior(behaviorSource: string): EffectAnalysisResult {
    const signature = parseEffectAnnotations(behaviorSource);
    const warnings = this.checkForWarnings(signature);
    const suggestions = this.generateSuggestions(signature, warnings);

    return {
      behavior: signature.behavior,
      effects: signature.effects,
      warnings,
      suggestions,
    };
  }

  /**
   * Analyze composition of multiple behaviors
   */
  analyzeComposition(behaviors: string[]): CompositionAnalysis {
    const signatures = behaviors.map(parseEffectAnnotations);
    const allEffects = new Map<string, ISLEffectAnnotation>();
    const conflicts: EffectConflict[] = [];

    for (const sig of signatures) {
      for (const effect of sig.effects) {
        const existing = allEffects.get(effect.name);
        if (existing && existing.kind !== effect.kind) {
          conflicts.push({
            effect: effect.name,
            behaviors: signatures.filter(s => 
              s.effects.some(e => e.name === effect.name)
            ).map(s => s.behavior),
            reason: 'Conflicting effect kinds',
          });
        }
        allEffects.set(effect.name, effect);
      }
    }

    return {
      totalEffects: Array.from(allEffects.values()),
      conflicts,
      canCompose: conflicts.length === 0,
      suggestions: this.getCompositionSuggestions(conflicts),
    };
  }

  /**
   * Check if behavior is pure (no side effects)
   */
  isPure(behaviorSource: string): boolean {
    const signature = parseEffectAnnotations(behaviorSource);
    return signature.pure;
  }

  /**
   * Get effect dependencies
   */
  getEffectDependencies(effect: ISLEffectAnnotation): ISLEffectAnnotation[] {
    const dependencies: ISLEffectAnnotation[] = [];

    // Common effect dependencies
    const dependencyMap: Record<string, string[]> = {
      database: ['logging', 'error'],
      network: ['logging', 'error', 'async'],
      filesystem: ['logging', 'error'],
      async: ['error'],
    };

    const deps = dependencyMap[effect.name] || [];
    for (const dep of deps) {
      dependencies.push({
        name: dep,
        kind: this.getEffectKind(dep),
        reversible: true,
        idempotent: dep === 'logging',
      });
    }

    return dependencies;
  }

  // Private methods

  private checkForWarnings(signature: EffectSignature): EffectWarning[] {
    const warnings: EffectWarning[] = [];

    // Check for unhandled effects
    for (const effect of signature.effects) {
      if (effect.kind === 'io' && !effect.reversible) {
        warnings.push({
          kind: 'unhandled',
          message: `Effect '${effect.name}' performs irreversible I/O`,
        });
      }
    }

    // Check for unsafe effect combinations
    const hasDatabase = signature.effects.some(e => e.name === 'database');
    const hasAsync = signature.effects.some(e => e.name === 'async');
    if (hasDatabase && hasAsync) {
      warnings.push({
        kind: 'unsafe',
        message: 'Mixing database and async effects may cause consistency issues',
      });
    }

    // Check for performance concerns
    const ioEffects = signature.effects.filter(e => e.kind === 'io');
    if (ioEffects.length > 3) {
      warnings.push({
        kind: 'performance',
        message: `Behavior has ${ioEffects.length} I/O effects, consider batching`,
      });
    }

    // Check for composition issues
    const hasState = signature.effects.some(e => e.kind === 'state');
    const hasNondeterminism = signature.effects.some(e => e.kind === 'nondeterminism');
    if (hasState && hasNondeterminism) {
      warnings.push({
        kind: 'composition',
        message: 'Combining state and nondeterminism may lead to unpredictable results',
      });
    }

    return warnings;
  }

  private generateSuggestions(
    signature: EffectSignature,
    warnings: EffectWarning[]
  ): string[] {
    const suggestions: string[] = [];

    // Suggestions based on warnings
    for (const warning of warnings) {
      switch (warning.kind) {
        case 'unhandled':
          suggestions.push('Consider adding error handling for I/O operations');
          suggestions.push('Use transaction semantics for reversibility');
          break;
        case 'unsafe':
          suggestions.push('Wrap database operations in a transaction');
          suggestions.push('Use connection pooling for async database access');
          break;
        case 'performance':
          suggestions.push('Batch I/O operations where possible');
          suggestions.push('Consider using caching for repeated operations');
          break;
        case 'composition':
          suggestions.push('Isolate stateful computations');
          suggestions.push('Use deterministic seeding for reproducibility');
          break;
      }
    }

    // General suggestions
    if (!signature.pure) {
      suggestions.push('Consider extracting pure computations for easier testing');
    }

    if (signature.effects.some(e => e.kind === 'io')) {
      suggestions.push('Add timeout handling for I/O operations');
    }

    return [...new Set(suggestions)]; // Deduplicate
  }

  private getCompositionSuggestions(conflicts: EffectConflict[]): string[] {
    const suggestions: string[] = [];

    for (const conflict of conflicts) {
      suggestions.push(
        `Resolve conflict in effect '${conflict.effect}' between behaviors: ${conflict.behaviors.join(', ')}`
      );
    }

    if (conflicts.length > 0) {
      suggestions.push('Consider using effect handlers to unify effect semantics');
      suggestions.push('Refactor to have consistent effect usage across behaviors');
    }

    return suggestions;
  }

  private getEffectKind(name: string): EffectKind {
    const kindMap: Record<string, EffectKind> = {
      database: 'io',
      network: 'io',
      filesystem: 'io',
      logging: 'logging',
      metrics: 'metrics',
      error: 'exception',
      async: 'async',
      state: 'state',
      random: 'nondeterminism',
    };
    return kindMap[name] || 'custom';
  }
}

export interface CompositionAnalysis {
  totalEffects: ISLEffectAnnotation[];
  conflicts: EffectConflict[];
  canCompose: boolean;
  suggestions: string[];
}

export interface EffectConflict {
  effect: string;
  behaviors: string[];
  reason: string;
}

// ============================================================================
// Effect Pattern Registry
// ============================================================================

export interface EffectPattern {
  pattern: RegExp;
  effect: ISLEffectAnnotation;
  category?: string;
}

const DEFAULT_EFFECT_PATTERNS: EffectPattern[] = [
  // Network / HTTP
  { pattern: /\bfetch\s*\(/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\baxios\.\w+/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bhttp\.\w+/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bXMLHttpRequest\b/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bWebSocket\b/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bgot\.\w+\(/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bsuperagent\b/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bky\.\w+\(/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },
  { pattern: /\bundici\.\w+/, effect: { name: 'network', kind: 'io', reversible: false, idempotent: false }, category: 'network' },

  // Filesystem
  { pattern: /\bfs\./, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },
  { pattern: /\breadFileSync\b|\breadFile\b/, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },
  { pattern: /\bwriteFileSync\b|\bwriteFile\b/, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },
  { pattern: /\bunlink\b|\bunlinkSync\b/, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },
  { pattern: /\bmkdir\b|\bmkdirSync\b/, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },
  { pattern: /\brmdir\b|\brm\b/, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },
  { pattern: /\bDeno\.readTextFile\b|\bDeno\.writeTextFile\b/, effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false }, category: 'filesystem' },

  // Logging
  { pattern: /\bconsole\.(log|error|warn|info|debug|trace)\b/, effect: { name: 'logging', kind: 'logging', reversible: false, idempotent: true }, category: 'logging' },
  { pattern: /\blogger\.\w+/, effect: { name: 'logging', kind: 'logging', reversible: false, idempotent: true }, category: 'logging' },
  { pattern: /\bpino\(|\bwinston\.\w+|\bbunyan\.\w+/, effect: { name: 'logging', kind: 'logging', reversible: false, idempotent: true }, category: 'logging' },
  { pattern: /\blog4js\.\w+/, effect: { name: 'logging', kind: 'logging', reversible: false, idempotent: true }, category: 'logging' },

  // Nondeterminism
  { pattern: /\bMath\.random\b/, effect: { name: 'random', kind: 'nondeterminism', reversible: true, idempotent: false }, category: 'nondeterminism' },
  { pattern: /\bcrypto\.random\w*/, effect: { name: 'random', kind: 'nondeterminism', reversible: true, idempotent: false }, category: 'nondeterminism' },
  { pattern: /\bcrypto\.getRandomValues\b/, effect: { name: 'random', kind: 'nondeterminism', reversible: true, idempotent: false }, category: 'nondeterminism' },
  { pattern: /\buuid\b|\bnanoid\b|\bcuid\b|\bulid\b/, effect: { name: 'random', kind: 'nondeterminism', reversible: true, idempotent: false }, category: 'nondeterminism' },

  // Time
  { pattern: /\bDate\.now\b|\bnew Date\b/, effect: { name: 'time', kind: 'io', reversible: false, idempotent: false }, category: 'time' },
  { pattern: /\bsetTimeout\b|\bsetInterval\b/, effect: { name: 'time', kind: 'io', reversible: false, idempotent: false }, category: 'time' },
  { pattern: /\bperformance\.now\b|\bprocess\.hrtime\b/, effect: { name: 'time', kind: 'io', reversible: false, idempotent: false }, category: 'time' },

  // Exception
  { pattern: /\bthrow\s+/, effect: { name: 'error', kind: 'exception', reversible: true, idempotent: true }, category: 'exception' },
  { pattern: /\.catch\s*\(|\bcatch\s*\(/, effect: { name: 'error', kind: 'exception', reversible: true, idempotent: true }, category: 'exception' },
  { pattern: /\bprocess\.exit\b/, effect: { name: 'error', kind: 'exception', reversible: false, idempotent: false }, category: 'exception' },

  // Async
  { pattern: /\basync\s+function\b|\basync\s*\(/, effect: { name: 'async', kind: 'async', reversible: true, idempotent: false }, category: 'async' },
  { pattern: /\bawait\s+/, effect: { name: 'async', kind: 'async', reversible: true, idempotent: false }, category: 'async' },
  { pattern: /\bPromise\.\w+/, effect: { name: 'async', kind: 'async', reversible: true, idempotent: false }, category: 'async' },
  { pattern: /\bnew\s+Worker\b|\bworker_threads\b/, effect: { name: 'async', kind: 'async', reversible: true, idempotent: false }, category: 'async' },

  // Database
  { pattern: /\.query\s*\(|\.execute\s*\(/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\bprisma\.\w+/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\bknex\.\w+|\bknex\(/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\bsequelize\.\w+/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\btypeorm\b|\bgetRepository\b|\bgetManager\b/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\bmongoose\.\w+|\bMongoClient\b/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\bdrizzle\.\w+/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },
  { pattern: /\bredis\.\w+|\bRedis\(/, effect: { name: 'database', kind: 'io', reversible: false, idempotent: false }, category: 'database' },

  // State
  { pattern: /\bsetState\s*\(|\buseState\b/, effect: { name: 'state', kind: 'state', reversible: true, idempotent: false }, category: 'state' },
  { pattern: /\bstore\.dispatch\b|\bstore\.commit\b/, effect: { name: 'state', kind: 'state', reversible: true, idempotent: false }, category: 'state' },
  { pattern: /\buseReducer\b|\buseContext\b/, effect: { name: 'state', kind: 'state', reversible: true, idempotent: false }, category: 'state' },

  // Metrics
  { pattern: /\bmetrics\.\w+|\bstatsd\.\w+|\bprometheus\.\w+/, effect: { name: 'metrics', kind: 'metrics', reversible: false, idempotent: true }, category: 'metrics' },
  { pattern: /\bopentelemetry\.\w+|\btracer\.\w+/, effect: { name: 'metrics', kind: 'metrics', reversible: false, idempotent: true }, category: 'metrics' },

  // Process / Shell
  { pattern: /\bchild_process\.\w+|\bexecSync\b|\bexec\b|\bspawn\b/, effect: { name: 'process', kind: 'io', reversible: false, idempotent: false }, category: 'process' },
  { pattern: /\bDeno\.run\b|\bDeno\.Command\b/, effect: { name: 'process', kind: 'io', reversible: false, idempotent: false }, category: 'process' },

  // Environment
  { pattern: /\bprocess\.env\b|\bDeno\.env\b/, effect: { name: 'environment', kind: 'io', reversible: false, idempotent: true }, category: 'environment' },

  // Crypto
  { pattern: /\bcrypto\.createHash\b|\bcrypto\.createCipher\b|\bcrypto\.createSign\b/, effect: { name: 'crypto', kind: 'io', reversible: false, idempotent: true }, category: 'crypto' },
  { pattern: /\bbcrypt\.\w+|\bargon2\.\w+/, effect: { name: 'crypto', kind: 'io', reversible: false, idempotent: true }, category: 'crypto' },
];

const globalPatternRegistry: EffectPattern[] = [...DEFAULT_EFFECT_PATTERNS];

export function registerEffectPattern(pattern: EffectPattern): void {
  globalPatternRegistry.push(pattern);
}

export function registerEffectPatterns(patterns: EffectPattern[]): void {
  globalPatternRegistry.push(...patterns);
}

export function clearCustomPatterns(): void {
  globalPatternRegistry.length = 0;
  globalPatternRegistry.push(...DEFAULT_EFFECT_PATTERNS);
}

export function getEffectPatterns(): readonly EffectPattern[] {
  return globalPatternRegistry;
}

// ============================================================================
// Type-Aware Effect Inference
// ============================================================================

export interface TypeInfo {
  name: string;
  module?: string;
  returnType?: string;
  effectKind?: EffectKind;
}

const TYPE_EFFECT_MAP: Map<string, ISLEffectAnnotation> = new Map([
  ['Promise', { name: 'async', kind: 'async', reversible: true, idempotent: false }],
  ['Observable', { name: 'async', kind: 'async', reversible: true, idempotent: false }],
  ['ReadableStream', { name: 'io', kind: 'io', reversible: false, idempotent: false }],
  ['WritableStream', { name: 'io', kind: 'io', reversible: false, idempotent: false }],
  ['Response', { name: 'network', kind: 'io', reversible: false, idempotent: false }],
  ['Request', { name: 'network', kind: 'io', reversible: false, idempotent: false }],
  ['EventEmitter', { name: 'async', kind: 'async', reversible: true, idempotent: false }],
  ['Socket', { name: 'network', kind: 'io', reversible: false, idempotent: false }],
  ['Connection', { name: 'database', kind: 'io', reversible: false, idempotent: false }],
  ['Pool', { name: 'database', kind: 'io', reversible: false, idempotent: false }],
  ['Transaction', { name: 'database', kind: 'io', reversible: false, idempotent: false }],
  ['Generator', { name: 'state', kind: 'state', reversible: true, idempotent: false }],
  ['AsyncGenerator', { name: 'async', kind: 'async', reversible: true, idempotent: false }],
]);

export function registerTypeEffect(typeName: string, effect: ISLEffectAnnotation): void {
  TYPE_EFFECT_MAP.set(typeName, effect);
}

export class EffectInference {
  private patterns: EffectPattern[];
  private typeMap: Map<string, ISLEffectAnnotation>;

  constructor(
    customPatterns?: EffectPattern[],
    customTypeMap?: Map<string, ISLEffectAnnotation>
  ) {
    this.patterns = customPatterns ?? [...globalPatternRegistry];
    this.typeMap = customTypeMap ?? new Map(TYPE_EFFECT_MAP);
  }

  addPattern(pattern: EffectPattern): void {
    this.patterns.push(pattern);
  }

  addTypeMapping(typeName: string, effect: ISLEffectAnnotation): void {
    this.typeMap.set(typeName, effect);
  }

  inferFromCode(code: string): ISLEffectAnnotation[] {
    const effects: ISLEffectAnnotation[] = [];
    const seen = new Set<string>();

    for (const { pattern, effect } of this.patterns) {
      if (pattern.test(code) && !seen.has(effect.name)) {
        effects.push({ ...effect });
        seen.add(effect.name);
      }
    }

    const typeEffects = this.inferFromReturnTypes(code);
    for (const effect of typeEffects) {
      if (!seen.has(effect.name)) {
        effects.push(effect);
        seen.add(effect.name);
      }
    }

    const importEffects = this.inferFromImports(code);
    for (const effect of importEffects) {
      if (!seen.has(effect.name)) {
        effects.push(effect);
        seen.add(effect.name);
      }
    }

    return effects;
  }

  inferFromReturnTypes(code: string): ISLEffectAnnotation[] {
    const effects: ISLEffectAnnotation[] = [];
    const seen = new Set<string>();

    const returnTypePattern = /:\s*(Promise|Observable|ReadableStream|WritableStream|Response|Request|EventEmitter|Socket|Connection|Pool|Transaction|Generator|AsyncGenerator)\b/g;
    let match: RegExpExecArray | null;
    while ((match = returnTypePattern.exec(code)) !== null) {
      const typeName = match[1]!;
      const effect = this.typeMap.get(typeName);
      if (effect && !seen.has(effect.name)) {
        effects.push({ ...effect });
        seen.add(effect.name);
      }
    }

    const genericPattern = /:\s*(\w+)<[^>]*>/g;
    while ((match = genericPattern.exec(code)) !== null) {
      const typeName = match[1]!;
      const effect = this.typeMap.get(typeName);
      if (effect && !seen.has(effect.name)) {
        effects.push({ ...effect });
        seen.add(effect.name);
      }
    }

    return effects;
  }

  inferFromImports(code: string): ISLEffectAnnotation[] {
    const effects: ISLEffectAnnotation[] = [];
    const seen = new Set<string>();

    const importModuleEffects: Record<string, ISLEffectAnnotation> = {
      'fs': { name: 'filesystem', kind: 'io', reversible: false, idempotent: false },
      'fs/promises': { name: 'filesystem', kind: 'io', reversible: false, idempotent: false },
      'node:fs': { name: 'filesystem', kind: 'io', reversible: false, idempotent: false },
      'node:fs/promises': { name: 'filesystem', kind: 'io', reversible: false, idempotent: false },
      'http': { name: 'network', kind: 'io', reversible: false, idempotent: false },
      'https': { name: 'network', kind: 'io', reversible: false, idempotent: false },
      'node:http': { name: 'network', kind: 'io', reversible: false, idempotent: false },
      'net': { name: 'network', kind: 'io', reversible: false, idempotent: false },
      'child_process': { name: 'process', kind: 'io', reversible: false, idempotent: false },
      'node:child_process': { name: 'process', kind: 'io', reversible: false, idempotent: false },
      'crypto': { name: 'crypto', kind: 'io', reversible: false, idempotent: true },
      'node:crypto': { name: 'crypto', kind: 'io', reversible: false, idempotent: true },
      'pg': { name: 'database', kind: 'io', reversible: false, idempotent: false },
      'mysql2': { name: 'database', kind: 'io', reversible: false, idempotent: false },
      'better-sqlite3': { name: 'database', kind: 'io', reversible: false, idempotent: false },
      'redis': { name: 'database', kind: 'io', reversible: false, idempotent: false },
      'ioredis': { name: 'database', kind: 'io', reversible: false, idempotent: false },
      'mongoose': { name: 'database', kind: 'io', reversible: false, idempotent: false },
      'axios': { name: 'network', kind: 'io', reversible: false, idempotent: false },
      'got': { name: 'network', kind: 'io', reversible: false, idempotent: false },
      'node-fetch': { name: 'network', kind: 'io', reversible: false, idempotent: false },
    };

    const importPattern = /(?:import\s+.*\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(code)) !== null) {
      const moduleName = match[1] ?? match[2];
      if (moduleName) {
        const effect = importModuleEffects[moduleName];
        if (effect && !seen.has(effect.name)) {
          effects.push({ ...effect });
          seen.add(effect.name);
        }
      }
    }

    return effects;
  }

  generateISLAnnotations(effects: ISLEffectAnnotation[]): string {
    if (effects.length === 0) {
      return '# Pure behavior (no side effects)';
    }

    const lines = ['# Effects:', ...effects.map(e => 
      `#   - ${e.name}: ${e.kind}${e.reversible ? ' (reversible)' : ''}${e.idempotent ? ' (idempotent)' : ''}`
    )];

    return lines.join('\n');
  }
}

export function createEffectAnalyzer(): EffectAnalyzer {
  return new EffectAnalyzer();
}

export function createEffectInference(
  customPatterns?: EffectPattern[],
  customTypeMap?: Map<string, ISLEffectAnnotation>
): EffectInference {
  return new EffectInference(customPatterns, customTypeMap);
}
