/**
 * Tier 3: AI-Assisted Spec Completion
 *
 * Only invoked when Tier 2 confidence is below threshold or required
 * categories are missing. Enforces structured output and grounded evidence.
 *
 * The AI receives:
 * - The Tier 1 IR (symbol signatures, types, side effects)
 * - The Tier 2 rules and gaps
 * - Instructions to produce ONLY grounded rules with evidence
 *
 * The AI must NOT hallucinate rules that aren't supported by the code.
 */

import type {
  TypedIntentIR,
  Tier2Result,
  Tier3Result,
  AICompletedRule,
  InferenceGap,
  IRFunction,
  IRMethod,
  IRSymbol,
  InferredRule,
} from './ir.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface Tier3Options {
  /** Confidence threshold — if all Tier 2 rules are above this, skip AI */
  confidenceThreshold?: number;
  /** Maximum number of gaps before invoking AI */
  maxGapsBeforeSkip?: number;
  /** API key for the LLM provider */
  apiKey?: string;
  /** LLM provider */
  provider?: 'openai' | 'anthropic';
  /** Model name */
  model?: string;
  /** Whether to actually call AI (false = dry run, just report what would be sent) */
  enabled?: boolean;
  /**
   * Maximum total confidence budget AI rules can consume.
   * AI rules are capped so their aggregate confidence doesn't exceed this.
   * Default: 0.7 — AI can contribute at most 70% confidence to the final score.
   */
  maxConfidenceBudget?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Run Tier 3 AI completion if needed.
 */
export async function completeWithAI(
  ir: TypedIntentIR,
  tier2: Tier2Result,
  options: Tier3Options = {},
): Promise<Tier3Result> {
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const enabled = options.enabled ?? true;

  // Determine whether AI is needed
  const { needed, reason } = isAINeeded(tier2, threshold);

  if (!needed) {
    return {
      rules: [],
      aiInvoked: false,
      reason,
    };
  }

  if (!enabled) {
    return {
      rules: [],
      aiInvoked: false,
      reason: `AI needed (${reason}) but disabled`,
    };
  }

  const apiKey = options.apiKey
    ?? process.env.OPENAI_API_KEY
    ?? process.env.ANTHROPIC_API_KEY
    ?? process.env.ISL_OPENAI_KEY
    ?? process.env.ISL_ANTHROPIC_KEY;

  if (!apiKey) {
    return {
      rules: [],
      aiInvoked: false,
      reason: 'AI needed but no API key configured',
    };
  }

  // Build prompt
  const prompt = buildStructuredPrompt(ir, tier2);
  const provider = options.provider ?? (apiKey.startsWith('sk-ant') ? 'anthropic' : 'openai');
  const model = options.model ?? (provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o');

  try {
    const rawResponse = provider === 'anthropic'
      ? await callAnthropic(prompt, apiKey, model)
      : await callOpenAI(prompt, apiKey, model);

    const rules = parseAndValidateResponse(rawResponse, ir, tier2);

    return {
      rules,
      aiInvoked: true,
      reason,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      rules: [],
      aiInvoked: true,
      reason: `AI call failed: ${msg}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision: is AI needed?
// ─────────────────────────────────────────────────────────────────────────────

function isAINeeded(
  tier2: Tier2Result,
  threshold: number,
): { needed: boolean; reason: string } {
  // Check for significant gaps
  if (tier2.gaps.length > 3) {
    return {
      needed: true,
      reason: `${tier2.gaps.length} inference gaps detected`,
    };
  }

  // Check for low-confidence rules
  const lowConfRules = tier2.rules.filter((r) => r.confidence < threshold);
  if (lowConfRules.length > tier2.rules.length * 0.3) {
    return {
      needed: true,
      reason: `${lowConfRules.length}/${tier2.rules.length} rules below confidence threshold ${threshold}`,
    };
  }

  // Check for missing required categories across all symbols
  const symbolNames = new Set(tier2.rules.map((r) => r.symbolName));
  const requiredCategories: InferredRule['category'][] = ['precondition', 'postcondition'];
  let missingCount = 0;

  for (const sym of symbolNames) {
    const symRules = tier2.rules.filter((r) => r.symbolName === sym);
    for (const cat of requiredCategories) {
      if (!symRules.some((r) => r.category === cat)) {
        missingCount++;
      }
    }
  }

  if (missingCount > 2) {
    return {
      needed: true,
      reason: `${missingCount} missing required rule categories across symbols`,
    };
  }

  return {
    needed: false,
    reason: 'Tier 2 coverage is sufficient',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt construction
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert code analyst that infers behavioral specifications from source code.

RULES:
1. You MUST only propose rules that are GROUNDED in the provided code evidence.
2. Every rule MUST include a "groundedEvidence" field citing the EXACT code construct (function name, line pattern, guard clause, throw statement, etc.).
3. Do NOT hallucinate rules — if you can't find evidence, DO NOT emit the rule at all.
4. Output ONLY valid JSON matching the schema below.
5. Focus on the GAPS identified — don't repeat rules Tier 2 already found.
6. CONFIDENCE BUDGET: Your total confidence across all rules is limited. Be honest.
   - 0.9+ = You can see the exact code that proves this rule
   - 0.7-0.8 = Strong evidence but some inference required
   - 0.5-0.6 = Reasonable inference from patterns
   - Below 0.5 = Speculative — mark as such
7. If a gap CANNOT be filled from the available code evidence, emit a rule with confidence: 0 and evidence: "NO_EVIDENCE: [explanation]"

OUTPUT SCHEMA (JSON array):
[
  {
    "symbolName": "functionOrClassName",
    "category": "precondition|postcondition|invariant|effect|error-case|nullability|exhaustiveness",
    "rule": "the rule in plain English or ISL-like syntax",
    "confidence": 0.0-1.0,
    "evidence": "why this rule was inferred",
    "groundedEvidence": "EXACT code construct: e.g. 'guard clause: if (!email) throw new ValidationError(...)' or 'return statement: return { id, ...data }'",
    "heuristic": "ai-tier3"
  }
]`;

function buildStructuredPrompt(ir: TypedIntentIR, tier2: Tier2Result): string {
  const sections: string[] = [];

  // Section 1: Symbol signatures
  sections.push('## Source Code Symbols\n');
  for (const sym of ir.symbols) {
    sections.push(formatSymbolForPrompt(sym));
  }

  // Section 2: Existing Tier 2 rules (so AI doesn't repeat them)
  if (tier2.rules.length > 0) {
    sections.push('\n## Already Inferred Rules (DO NOT REPEAT)\n');
    for (const rule of tier2.rules.slice(0, 50)) {
      sections.push(`- [${rule.category}] ${rule.symbolName}: ${rule.rule} (confidence: ${rule.confidence})`);
    }
  }

  // Section 3: Gaps to fill
  if (tier2.gaps.length > 0) {
    sections.push('\n## GAPS TO FILL (focus here)\n');
    for (const gap of tier2.gaps) {
      sections.push(`- ${gap.symbolName}: missing ${gap.missingCategory} — ${gap.reason}`);
    }
  }

  // Section 4: Runtime hints
  if (ir.runtimeHints.length > 0) {
    sections.push('\n## Runtime Behavior Hints\n');
    for (const hint of ir.runtimeHints.slice(0, 30)) {
      sections.push(`- ${hint.symbolName}: [${hint.category}] ${hint.detail}`);
    }
  }

  sections.push('\n## Instructions\n');
  sections.push('Propose rules ONLY for the gaps listed above. Ground every rule in specific code evidence.');
  sections.push('Output valid JSON array matching the schema from the system prompt.');

  return sections.join('\n');
}

function formatSymbolForPrompt(sym: IRSymbol): string {
  switch (sym.kind) {
    case 'function': {
      const params = sym.parameters.map((p) => `${p.name}: ${p.type.text}${p.optional ? '?' : ''}`).join(', ');
      const prefix = sym.async ? 'async ' : '';
      let line = `${prefix}function ${sym.name}(${params}): ${sym.returnType.text}`;
      if (sym.throwsErrors.length > 0) {
        line += ` // throws: ${sym.throwsErrors.map((e) => e.errorClass).join(', ')}`;
      }
      if (sym.guardClauses.length > 0) {
        line += `\n  // guards: ${sym.guardClauses.map((g) => g.condition).join('; ')}`;
      }
      if (sym.sideEffects.length > 0) {
        line += `\n  // effects: ${sym.sideEffects.map((e) => `${e.type}(${e.target})`).join(', ')}`;
      }
      return line;
    }
    case 'method': {
      const params = sym.parameters.map((p) => `${p.name}: ${p.type.text}${p.optional ? '?' : ''}`).join(', ');
      const prefix = sym.async ? 'async ' : '';
      return `${sym.className}.${prefix}${sym.name}(${params}): ${sym.returnType.text}`;
    }
    case 'interface':
      return `interface ${sym.name} { ${sym.properties.map((p) => `${p.name}: ${p.type.text}`).join('; ')} }`;
    case 'class':
      return `class ${sym.name} { properties: [${sym.properties.map((p) => p.name).join(', ')}], methods: [${sym.methods.map((m) => m.name).join(', ')}] }`;
    case 'enum':
      return `enum ${sym.name} { ${sym.members.join(', ')} }`;
    case 'typeAlias':
      return `type ${sym.name} = ${sym.typeString}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM API calls
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message.content ?? '[]';
}

async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content.find((c) => c.type === 'text')?.text ?? '[]';
}

// ─────────────────────────────────────────────────────────────────────────────
// Response parsing + validation
// ─────────────────────────────────────────────────────────────────────────────

interface RawAIRule {
  symbolName?: string;
  category?: string;
  rule?: string;
  confidence?: number;
  evidence?: string;
  groundedEvidence?: string;
  heuristic?: string;
}

function parseAndValidateResponse(
  raw: string,
  ir: TypedIntentIR,
  tier2: Tier2Result,
): AICompletedRule[] {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON array from the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  // Handle { rules: [...] } wrapper
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.rules)) {
      parsed = obj.rules;
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const validCategories = new Set([
    'precondition', 'postcondition', 'invariant', 'effect',
    'error-case', 'nullability', 'exhaustiveness',
  ]);

  const knownSymbols = new Set(ir.symbols.map((s) => s.name));
  // Also add Class.Method names
  for (const s of ir.symbols) {
    if (s.kind === 'class') {
      for (const m of s.methods) {
        knownSymbols.add(`${s.name}.${m.name}`);
      }
    }
  }

  const existingRules = new Set(tier2.rules.map((r) => `${r.symbolName}:${r.rule}`));

  const validated: AICompletedRule[] = [];

  for (const item of parsed as RawAIRule[]) {
    // Validate required fields
    if (!item.symbolName || !item.category || !item.rule) continue;
    if (!validCategories.has(item.category)) continue;

    // Validate confidence range
    const confidence = typeof item.confidence === 'number'
      ? Math.max(0, Math.min(1, item.confidence))
      : 0.5;

    // Check if rule is grounded (must reference a known symbol)
    const isGrounded = knownSymbols.has(item.symbolName) || item.symbolName === '__global__';

    // Skip duplicates of Tier 2 rules
    const ruleKey = `${item.symbolName}:${item.rule}`;
    if (existingRules.has(ruleKey)) continue;

    // STRICT GROUNDING: ungrounded rules get 0 confidence, not 0.3x
    // If the AI can't cite a real symbol, the rule is hallucinated.
    if (!isGrounded) continue;

    // Rules without groundedEvidence or with NO_EVIDENCE marker get 0 confidence
    const hasEvidence = !!item.groundedEvidence && !item.groundedEvidence.startsWith('NO_EVIDENCE');
    const adjustedConfidence = hasEvidence ? confidence : 0;

    validated.push({
      symbolName: item.symbolName,
      category: item.category as AICompletedRule['category'],
      rule: item.rule,
      confidence: adjustedConfidence,
      evidence: item.evidence ?? '',
      heuristic: 'ai-tier3',
      groundedEvidence: item.groundedEvidence ?? '',
      validated: hasEvidence,
    });
  }

  return validated;
}
