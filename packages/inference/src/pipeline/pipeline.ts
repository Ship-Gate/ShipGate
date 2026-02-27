/**
 * 3-Tier Inference Pipeline Orchestrator
 *
 * Tier 1: Static signature extraction (always runs)
 * Tier 2: Semantic rule inference (always runs, best-effort)
 * Tier 3: AI-assisted spec completion (only when needed)
 *
 * This is the primary entry point for code → ISL inference.
 */

import { extractStaticIR, type Tier1Options } from './tier1-static.js';
import { inferSemanticRules, type Tier2Options } from './tier2-semantic.js';
import { completeWithAI, type Tier3Options } from './tier3-ai.js';
import type {
  TypedIntentIR,
  PipelineResult,
  PipelineDiagnostic,
  InferredRule,
  AICompletedRule,
  IRSymbol,
  IRFunction,
  IRMethod,
  IRInterface,
  IRClass,
  IRTypeAlias,
  IREnum,
  IRProperty,
  IRTypeRef,
} from './ir.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Source files to analyze */
  sourceFiles: string[];
  /** Domain name for the generated ISL */
  domainName: string;
  /** Tier 1 options */
  tier1?: Tier1Options;
  /** Tier 2 options */
  tier2?: Tier2Options;
  /** Tier 3 options (set enabled: false to skip AI) */
  tier3?: Tier3Options;
  /** Whether to include inferred invariants in the ISL */
  includeInvariants?: boolean;
  /** Confidence threshold for including rules in the ISL */
  confidenceThreshold?: number;
}

/**
 * Run the full 3-tier inference pipeline.
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const diagnostics: PipelineDiagnostic[] = [];
  const confThreshold = options.confidenceThreshold ?? 0.5;

  // ── Tier 1: Static extraction ────────────────────────────────────────────
  let ir: TypedIntentIR;
  try {
    ir = await extractStaticIR(options.sourceFiles, options.tier1);
    diagnostics.push({
      severity: 'info',
      tier: 1,
      message: `Extracted ${ir.symbols.length} symbols, ${ir.runtimeHints.length} runtime hints`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ir: {
        sourceFiles: options.sourceFiles,
        language: 'typescript',
        symbols: [],
        runtimeHints: [],
        documentation: [],
        provenance: [],
      },
      tier2: { rules: [], gaps: [] },
      tier3: { rules: [], aiInvoked: false, reason: `Tier 1 failed: ${msg}` },
      isl: '',
      confidence: 0,
      diagnostics: [{
        severity: 'error',
        tier: 1,
        message: `Static extraction failed: ${msg}`,
      }],
    };
  }

  // ── Tier 2: Semantic inference ───────────────────────────────────────────
  const tier2 = inferSemanticRules(ir, options.tier2);
  diagnostics.push({
    severity: 'info',
    tier: 2,
    message: `Inferred ${tier2.rules.length} rules, ${tier2.gaps.length} gaps`,
  });

  if (tier2.gaps.length > 0) {
    for (const gap of tier2.gaps) {
      diagnostics.push({
        severity: 'warning',
        tier: 2,
        message: `Gap: ${gap.symbolName} missing ${gap.missingCategory} — ${gap.reason}`,
        symbolName: gap.symbolName,
      });
    }
  }

  // ── Tier 3: AI completion ────────────────────────────────────────────────
  const tier3 = await completeWithAI(ir, tier2, options.tier3);
  if (tier3.aiInvoked) {
    diagnostics.push({
      severity: 'info',
      tier: 3,
      message: `AI produced ${tier3.rules.length} additional rules. Reason: ${tier3.reason}`,
    });
  } else {
    diagnostics.push({
      severity: 'info',
      tier: 3,
      message: `AI skipped: ${tier3.reason}`,
    });
  }

  // ── Merge rules and generate ISL ─────────────────────────────────────────
  const allRules: (InferredRule | AICompletedRule)[] = [
    ...tier2.rules,
    ...tier3.rules,
  ];

  const filteredRules = allRules.filter((r) => r.confidence >= confThreshold);

  // ── Compute overall confidence ───────────────────────────────────────────
  const confidences = filteredRules.map((r) => r.confidence);
  const overall = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  // Penalize confidence for unresolved gaps
  const gapPenalty = tier2.gaps.length > 0
    ? Math.min(0.3, tier2.gaps.length * 0.05)
    : 0;
  const adjustedConfidence = Math.max(0, overall - gapPenalty);

  const isl = generateISLFromPipeline({
    domainName: options.domainName,
    ir,
    rules: filteredRules,
    includeInvariants: options.includeInvariants ?? true,
    gaps: tier2.gaps,
    overallConfidence: overall,
  });

  return {
    ir,
    tier2,
    tier3,
    isl,
    confidence: adjustedConfidence,
    diagnostics,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Generation from pipeline output
// ─────────────────────────────────────────────────────────────────────────────

interface GenerateISLArgs {
  domainName: string;
  ir: TypedIntentIR;
  rules: (InferredRule | AICompletedRule)[];
  includeInvariants: boolean;
  gaps: import('./ir.js').InferenceGap[];
  overallConfidence: number;
}

function generateISLFromPipeline(args: GenerateISLArgs): string {
  const { domainName, ir, rules, includeInvariants, gaps, overallConfidence } = args;
  const lines: string[] = [];

  // ── Header: confidence + gap summary ────────────────────────────────────
  lines.push(`# GENERATED SPEC — confidence: ${(overallConfidence * 100).toFixed(0)}%`);
  if (gaps.length > 0) {
    lines.push(`# GAPS (${gaps.length}): ${gaps.map(g => `${g.symbolName}:${g.missingCategory}`).join(', ')}`);
    lines.push('# WARNING: Gaps lower trust score. Fill gaps or accept risk explicitly.');
  }
  if (overallConfidence < 0.5) {
    lines.push('# STATUS: LOW_CONFIDENCE — this spec is insufficient for SHIP');
  }
  lines.push('');
  lines.push(`domain ${domainName} {`);
  lines.push(`  version: "1.0.0"`);
  lines.push('');

  // ── Enums ────────────────────────────────────────────────────────────────
  const enums = ir.symbols.filter((s): s is IREnum => s.kind === 'enum');
  const stringUnions = ir.symbols.filter(
    (s): s is IRTypeAlias => s.kind === 'typeAlias' && s.isStringLiteralUnion,
  );

  if (enums.length > 0 || stringUnions.length > 0) {
    lines.push('  # Enumerations');
    for (const en of enums) {
      lines.push('');
      lines.push(`  enum ${en.name} {`);
      for (const member of en.members) {
        lines.push(`    ${toScreamingSnake(member)}`);
      }
      lines.push('  }');
    }
    for (const ta of stringUnions) {
      if (ta.unionMembers) {
        lines.push('');
        lines.push(`  enum ${ta.name} {`);
        for (const member of ta.unionMembers) {
          lines.push(`    ${toScreamingSnake(member)}`);
        }
        lines.push('  }');
      }
    }
    lines.push('');
  }

  // ── Entities (from interfaces and classes) ───────────────────────────────
  const interfaces = ir.symbols.filter((s): s is IRInterface => s.kind === 'interface');
  const classes = ir.symbols.filter((s): s is IRClass => s.kind === 'class');
  const entities = [...interfaces, ...classes].filter(
    (s) => s.properties.length > 0,
  );

  if (entities.length > 0) {
    lines.push('  # Entities');
    for (const entity of entities) {
      lines.push('');
      lines.push(`  entity ${entity.name} {`);
      for (const prop of entity.properties) {
        const islType = tsTypeToIslType(prop.type);
        const optional = prop.optional ? '?' : '';
        const annotations = buildAnnotations(entity.name, prop, rules);
        const annStr = annotations.length > 0 ? ` [${annotations.join(', ')}]` : '';
        lines.push(`    ${toSnakeCase(prop.name)}: ${islType}${optional}${annStr}`);
      }

      // Entity-level invariants
      if (includeInvariants) {
        const entityInvariants = rules.filter(
          (r) => r.symbolName === entity.name && r.category === 'invariant',
        );
        if (entityInvariants.length > 0) {
          lines.push('');
          lines.push('    invariants {');
          for (const inv of entityInvariants) {
            lines.push(`      - ${inv.rule}`);
          }
          lines.push('    }');
        }
      }

      lines.push('  }');
    }
    lines.push('');
  }

  // ── Behaviors (from functions and methods) ───────────────────────────────
  const functions = ir.symbols.filter(
    (s): s is IRFunction => s.kind === 'function',
  );
  const methods: IRMethod[] = [];
  for (const cls of classes) {
    methods.push(...cls.methods);
  }
  const allFunctions: Array<IRFunction | IRMethod> = [...functions, ...methods];

  if (allFunctions.length > 0) {
    lines.push('  # Behaviors');
    for (const fn of allFunctions) {
      const symbolName = fn.kind === 'method' ? `${fn.className}.${fn.name}` : fn.name;
      const behaviorName = toPascalCase(fn.name);

      lines.push('');
      lines.push(`  behavior ${behaviorName} {`);

      // Emit gap warnings for this symbol
      const symbolGaps = gaps.filter(g => g.symbolName === symbolName || g.symbolName === fn.name);
      if (symbolGaps.length > 0) {
        for (const gap of symbolGaps) {
          lines.push(`    # GAP: missing ${gap.missingCategory} — ${gap.reason}`);
        }
        lines.push('');
      }

      // Description from JSDoc
      if (fn.jsdoc?.description) {
        lines.push(`    description: "${escapeString(fn.jsdoc.description)}"`);
        lines.push('');
      }

      // Input
      if (fn.parameters.length > 0) {
        lines.push('    input {');
        for (const param of fn.parameters) {
          const islType = tsTypeToIslType(param.type);
          const optional = param.optional ? '?' : '';
          lines.push(`      ${toSnakeCase(param.name)}: ${islType}${optional}`);
        }
        lines.push('    }');
        lines.push('');
      }

      // Output
      const returnIsl = tsTypeToIslType(fn.returnType);
      lines.push('    output {');
      lines.push(`      success: ${returnIsl === 'Void' ? 'Boolean' : returnIsl}`);

      // Error cases
      const errorRules = rules.filter(
        (r) => r.symbolName === symbolName && r.category === 'error-case',
      );
      if (errorRules.length > 0 || fn.throwsErrors.length > 0) {
        lines.push('');
        lines.push('      errors {');
        const seen = new Set<string>();
        for (const err of fn.throwsErrors) {
          const errName = toScreamingSnake(err.errorClass.replace(/Error$/, ''));
          if (seen.has(errName)) continue;
          seen.add(errName);
          lines.push(`        ${errName} {`);
          if (err.message) {
            lines.push(`          when: "${escapeString(err.message)}"`);
          }
          lines.push('          retriable: false');
          lines.push('        }');
        }
        for (const rule of errorRules) {
          const key = rule.rule.slice(0, 40);
          if (seen.has(key)) continue;
          seen.add(key);
          lines.push(`        # ${rule.rule}`);
        }
        lines.push('      }');
      }
      lines.push('    }');

      // Preconditions
      const preconditions = rules.filter(
        (r) => r.symbolName === symbolName && r.category === 'precondition',
      );
      if (preconditions.length > 0) {
        lines.push('');
        lines.push('    preconditions {');
        for (const pre of preconditions) {
          lines.push(`      ${pre.rule}`);
        }
        lines.push('    }');
      }

      // Postconditions
      const postconditions = rules.filter(
        (r) => r.symbolName === symbolName && r.category === 'postcondition',
      );
      if (postconditions.length > 0) {
        lines.push('');
        lines.push('    postconditions {');
        lines.push('      success implies {');
        for (const post of postconditions) {
          lines.push(`        - ${post.rule}`);
        }
        lines.push('      }');
        lines.push('    }');
      }

      // Effects
      const effectRules = rules.filter(
        (r) => r.symbolName === symbolName && r.category === 'effect',
      );
      if (effectRules.length > 0) {
        lines.push('');
        lines.push('    effects {');
        for (const eff of effectRules) {
          lines.push(`      - ${eff.rule}`);
        }
        lines.push('    }');
      }

      lines.push('  }');
    }
  }

  // ── Global invariants ────────────────────────────────────────────────────
  if (includeInvariants) {
    const globalInvariants = rules.filter(
      (r) =>
        r.symbolName === '__global__' && r.category === 'invariant',
    );
    const exhaustivenessRules = rules.filter(
      (r) => r.category === 'exhaustiveness',
    );

    if (globalInvariants.length > 0 || exhaustivenessRules.length > 0) {
      lines.push('');
      lines.push('  # Global Invariants');
      lines.push('');
      lines.push('  invariants GlobalRules {');
      lines.push('    always {');
      for (const inv of globalInvariants) {
        lines.push(`      - ${inv.rule}`);
      }
      for (const exh of exhaustivenessRules) {
        lines.push(`      - ${exh.rule}`);
      }
      lines.push('    }');
      lines.push('  }');
    }
  }

  lines.push('}');

  // ── Trailing metadata: confidence budget breakdown ──────────────────────
  lines.push('');
  lines.push('# ── Confidence Budget ──────────────────────────────────────');
  const tier1Count = rules.filter(r => !('groundedEvidence' in r)).length;
  const tier3Count = rules.filter(r => 'groundedEvidence' in r).length;
  lines.push(`# Rules: ${rules.length} (static: ${tier1Count}, ai: ${tier3Count})`);
  lines.push(`# Gaps: ${gaps.length}`);
  lines.push(`# Overall confidence: ${(overallConfidence * 100).toFixed(0)}%`);
  if (gaps.length > 0) {
    lines.push('# Unresolved gaps:');
    for (const gap of gaps) {
      lines.push(`#   - ${gap.symbolName}: ${gap.missingCategory} — ${gap.reason}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Type mapping
// ─────────────────────────────────────────────────────────────────────────────

function tsTypeToIslType(typeRef: IRTypeRef): string {
  const t = typeRef.text;

  // Handle Promise<T>
  if (typeRef.isPromise && typeRef.promiseInner) {
    return tsTypeStringToIsl(typeRef.promiseInner);
  }

  return tsTypeStringToIsl(t);
}

function tsTypeStringToIsl(t: string): string {
  const trimmed = t.trim();
  if (!trimmed || trimmed === 'any' || trimmed === 'unknown') return 'String';
  if (trimmed === 'string') return 'String';
  if (trimmed === 'number' || trimmed === 'bigint') return 'Int';
  if (trimmed === 'boolean') return 'Boolean';
  if (trimmed === 'void' || trimmed === 'undefined' || trimmed === 'never') return 'Void';
  if (trimmed === 'null') return 'Void';
  if (trimmed.endsWith('[]') || trimmed.startsWith('Array<') || trimmed.startsWith('ReadonlyArray<')) return 'List';
  if (trimmed.startsWith('Promise<')) {
    const inner = trimmed.slice('Promise<'.length, -1);
    return tsTypeStringToIsl(inner);
  }
  if (trimmed.startsWith('Record<') || trimmed.startsWith('Map<') || trimmed === 'object') return 'Map';
  if (trimmed === 'Date') return 'DateTime';
  if (trimmed === 'Buffer' || trimmed === 'Uint8Array') return 'Bytes';
  // Named types — preserve
  if (/^[A-Z]\w*$/.test(trimmed)) return trimmed;
  // Union types with null — pick non-null part
  if (trimmed.includes(' | null') || trimmed.includes(' | undefined')) {
    const clean = trimmed.replace(/\s*\|\s*(null|undefined)/g, '').trim();
    return tsTypeStringToIsl(clean);
  }
  return 'String';
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotation building
// ─────────────────────────────────────────────────────────────────────────────

function buildAnnotations(
  entityName: string,
  prop: IRProperty,
  rules: (InferredRule | AICompletedRule)[],
): string[] {
  const annotations: string[] = [];

  if (prop.readonly) annotations.push('immutable');

  // Check rules for this entity+field
  const fieldRules = rules.filter(
    (r) => r.symbolName === entityName && r.rule.includes(prop.name),
  );

  for (const rule of fieldRules) {
    if (rule.rule.includes('unique') && !annotations.includes('unique')) {
      annotations.push('unique');
    }
    if (rule.rule.includes('immutable') && !annotations.includes('immutable')) {
      annotations.push('immutable');
    }
    if (rule.rule.includes('never appear in logs') && !annotations.includes('secret')) {
      annotations.push('secret');
    }
  }

  // Heuristic annotations from field name
  if (prop.name === 'id' || prop.name.endsWith('_id')) {
    if (!annotations.includes('immutable')) annotations.push('immutable');
    if (prop.name === 'id' && !annotations.includes('unique')) annotations.push('unique');
  }
  if (prop.name === 'email' || prop.name.includes('email')) {
    if (!annotations.includes('unique')) annotations.push('unique');
  }
  if (
    prop.name.includes('password') ||
    prop.name.includes('secret') ||
    prop.name.includes('token') ||
    prop.name.includes('apiKey')
  ) {
    if (!annotations.includes('secret')) annotations.push('secret');
  }
  if (prop.name === 'createdAt' || prop.name === 'created_at') {
    if (!annotations.includes('immutable')) annotations.push('immutable');
  }

  return annotations;
}

// ─────────────────────────────────────────────────────────────────────────────
// String utilities
// ─────────────────────────────────────────────────────────────────────────────

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());
}

function toScreamingSnake(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
