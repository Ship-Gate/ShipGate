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

/**
 * Effect inference
 * Infer effect annotations from code
 */
export class EffectInference {
  /**
   * Infer effects from TypeScript/JavaScript code
   */
  inferFromCode(code: string): ISLEffectAnnotation[] {
    const effects: ISLEffectAnnotation[] = [];
    const seen = new Set<string>();

    const patterns: Array<{ pattern: RegExp; effect: ISLEffectAnnotation }> = [
      {
        pattern: /fetch\s*\(|axios\.|http\./i,
        effect: { name: 'network', kind: 'io', reversible: false, idempotent: false },
      },
      {
        pattern: /fs\.|readFile|writeFile|unlink/i,
        effect: { name: 'filesystem', kind: 'io', reversible: false, idempotent: false },
      },
      {
        pattern: /console\.|logger\.|log\(/i,
        effect: { name: 'logging', kind: 'logging', reversible: false, idempotent: true },
      },
      {
        pattern: /Math\.random|crypto\.random|uuid/i,
        effect: { name: 'random', kind: 'nondeterminism', reversible: true, idempotent: false },
      },
      {
        pattern: /Date\.now|new Date|setTimeout|setInterval/i,
        effect: { name: 'time', kind: 'io', reversible: false, idempotent: false },
      },
      {
        pattern: /throw\s+|catch\s*\(|\.catch\(/i,
        effect: { name: 'error', kind: 'exception', reversible: true, idempotent: true },
      },
      {
        pattern: /async\s+|await\s+|Promise\./i,
        effect: { name: 'async', kind: 'async', reversible: true, idempotent: false },
      },
      {
        pattern: /\.query\(|\.execute\(|prisma\.|knex\./i,
        effect: { name: 'database', kind: 'io', reversible: false, idempotent: false },
      },
    ];

    for (const { pattern, effect } of patterns) {
      if (pattern.test(code) && !seen.has(effect.name)) {
        effects.push(effect);
        seen.add(effect.name);
      }
    }

    return effects;
  }

  /**
   * Generate ISL effect annotations
   */
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

/**
 * Create effect analyzer
 */
export function createEffectAnalyzer(): EffectAnalyzer {
  return new EffectAnalyzer();
}

/**
 * Create effect inference engine
 */
export function createEffectInference(): EffectInference {
  return new EffectInference();
}
