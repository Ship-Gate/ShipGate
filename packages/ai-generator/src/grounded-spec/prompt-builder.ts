/**
 * Prompt Builder for Grounded Spec Generation
 *
 * Builds a structured prompt from extracted code facts that forces the AI
 * to output a constrained JSON schema with evidence citations.
 * The AI never "understands the business" — it only proposes constraints
 * grounded in the code facts we provide.
 *
 * @module @isl-lang/ai-generator/grounded-spec/prompt-builder
 */

import type {
  CodeFacts,
  GroundedSpecResponse,
} from './types.js';

// ============================================================================
// Main entry
// ============================================================================

/**
 * Build the system prompt that constrains AI to evidence-grounded output.
 */
export function buildSystemPrompt(): string {
  return `You are a specification inference engine. Your job is to propose behavioral constraints for functions based ONLY on the code facts provided.

## RULES — READ CAREFULLY

1. You MUST output valid JSON matching the schema below. No prose, no markdown, no explanation.
2. Every precondition, postcondition, invariant, error, and effect you propose MUST include an "evidence" array citing specific code facts you were given (e.g., "zod: email()", "throw ValidationError on line 42", "prisma.user.create").
3. If you CANNOT cite evidence from the provided facts, you MUST set confidence below 0.4 and your evidence array MUST contain "speculative: no direct evidence".
4. Confidence scores MUST follow these ranges:
   - 0.8–1.0: Direct evidence (throw site, schema constraint, explicit return)
   - 0.6–0.79: Strong inference (pattern matches, type constraints)
   - 0.4–0.59: Moderate inference (naming conventions, common patterns)
   - 0.0–0.39: Speculative (no direct evidence, educated guess)
5. Do NOT invent business rules. Only propose what the code actually does.
6. Do NOT add conditions the code does not check.
7. Prefer fewer high-confidence rules over many low-confidence ones.

## OUTPUT JSON SCHEMA

{
  "behaviors": [
    {
      "name": "string — function name in PascalCase",
      "description": "string — one-line summary of what the function does",
      "inputs": [{"name": "string", "type": "string"}],
      "output": {"type": "string"},
      "preconditions": [
        {"expr": "string — ISL-style expression", "confidence": 0.0-1.0, "evidence": ["string"]}
      ],
      "postconditions": [
        {"expr": "string — ISL-style expression", "confidence": 0.0-1.0, "evidence": ["string"]}
      ],
      "invariants": [
        {"expr": "string — ISL-style expression", "confidence": 0.0-1.0, "evidence": ["string"]}
      ],
      "errors": [
        {"when": "string", "throws": "string", "confidence": 0.0-1.0, "evidence": ["string"]}
      ],
      "effects": [
        {"type": "db_write|db_read|http_call|event_emit|file_io|cache|log|unknown", "target": "string", "confidence": 0.0-1.0, "evidence": ["string"]}
      ]
    }
  ]
}

Respond with ONLY the JSON object. No \`\`\` fences. No commentary.`;
}

/**
 * Build the user prompt from extracted code facts for one or more functions.
 */
export function buildUserPrompt(factsList: CodeFacts[]): string {
  const sections: string[] = [];

  sections.push('# Code Facts for Specification Inference\n');

  for (const facts of factsList) {
    sections.push(buildFunctionSection(facts));
  }

  sections.push('\n---\nAnalyze the code facts above and produce the JSON specification. Remember: every rule must cite evidence.');

  return sections.join('\n');
}

// ============================================================================
// Section builders
// ============================================================================

function buildFunctionSection(facts: CodeFacts): string {
  const parts: string[] = [];
  const sig = facts.signature;

  // Header
  parts.push(`## Function: ${sig.name}`);
  parts.push(`File: ${sig.location.file}:${sig.location.startLine}-${sig.location.endLine}`);
  parts.push('');

  // Signature
  parts.push('### Typed Signature');
  const asyncPrefix = sig.isAsync ? 'async ' : '';
  const typeParams = sig.typeParameters.length > 0 ? `<${sig.typeParameters.join(', ')}>` : '';
  const params = sig.params
    .map((p) => {
      const opt = p.optional ? '?' : '';
      const type = p.type ? `: ${p.type}` : '';
      const rest = p.rest ? '...' : '';
      const def = p.defaultValue ? ` = ${p.defaultValue}` : '';
      return `${rest}${p.name}${opt}${type}${def}`;
    })
    .join(', ');
  const ret = sig.returnType ? `: ${sig.returnType}` : '';
  parts.push(`\`${asyncPrefix}function ${sig.name}${typeParams}(${params})${ret}\``);
  parts.push(`Exported: ${sig.isExported}`);
  parts.push('');

  // Control Flow IR
  const cf = facts.controlFlow;
  parts.push('### Control Flow Summary');
  parts.push(`- Branches: ${cf.branches}`);
  parts.push(`- Loops: ${cf.loops}`);
  parts.push(`- Early returns: ${cf.earlyReturns}`);
  parts.push(`- Await points: ${cf.awaitPoints}`);
  parts.push('');

  // Throw sites
  if (cf.throwSites.length > 0) {
    parts.push('### Throw Sites');
    for (const t of cf.throwSites) {
      const cond = t.condition ? ` (when: ${t.condition})` : '';
      const msg = t.message ? ` — "${t.message}"` : '';
      parts.push(`- Line ${t.line}: throw ${t.errorType}${msg}${cond}`);
    }
    parts.push('');
  }

  // External calls
  if (cf.externalCalls.length > 0) {
    parts.push('### External Calls');
    for (const c of cf.externalCalls) {
      const method = c.method ? `.${c.method}` : '';
      const aw = c.isAwait ? ' [await]' : '';
      parts.push(`- Line ${c.line}: ${c.callee}${method}()${aw}`);
    }
    parts.push('');
  }

  // Return shapes
  if (cf.returnShapes.length > 0) {
    parts.push('### Return Shape Samples');
    for (const r of cf.returnShapes) {
      const fields = r.fields.length > 0 ? ` — fields: {${r.fields.join(', ')}}` : '';
      parts.push(`- Line ${r.line}: ${truncate(r.expression, 120)}${fields}`);
    }
    parts.push('');
  }

  // Docstring
  if (facts.docstring) {
    parts.push('### Docstring');
    if (facts.docstring.summary) {
      parts.push(`Summary: ${facts.docstring.summary}`);
    }
    for (const p of facts.docstring.params) {
      parts.push(`@param ${p.name} — ${p.description}`);
    }
    if (facts.docstring.returns) {
      parts.push(`@returns ${facts.docstring.returns}`);
    }
    for (const t of facts.docstring.throws) {
      parts.push(`@throws {${t.type}} ${t.description}`);
    }
    parts.push('');
  }

  // Schemas
  if (facts.schemas.length > 0) {
    parts.push('### Detected Schemas');
    for (const s of facts.schemas) {
      parts.push(`- ${s.kind}: ${s.name}`);
      for (const f of s.fields) {
        const constraints = f.constraints.length > 0 ? ` [${f.constraints.join(', ')}]` : '';
        const opt = f.optional ? '?' : '';
        parts.push(`  - ${f.name}${opt}: ${f.type}${constraints}`);
      }
    }
    parts.push('');
  }

  // Call sites
  if (facts.callSites.length > 0) {
    parts.push('### Example Call Sites (top 3)');
    for (const cs of facts.callSites) {
      parts.push(`- ${cs.file}:${cs.line}: \`${truncate(cs.snippet, 150)}\``);
    }
    parts.push('');
  }

  // Source code
  parts.push('### Source Code');
  parts.push('```typescript');
  parts.push(facts.sourceCode);
  parts.push('```');
  parts.push('');

  return parts.join('\n');
}

// ============================================================================
// Response parsing
// ============================================================================

/**
 * Parse the AI response into the structured GroundedSpecResponse.
 * Handles markdown fences, trailing commas, and other common LLM quirks.
 */
export function parseAIResponse(raw: string): GroundedSpecResponse {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');

  // Strip any leading prose before the JSON
  const jsonStart = cleaned.indexOf('{');
  if (jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }

  // Strip any trailing prose after the JSON
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  // Fix trailing commas (common LLM mistake)
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Failed to parse AI response as JSON: ${e instanceof Error ? e.message : String(e)}\n` +
      `Raw (first 500 chars): ${raw.slice(0, 500)}`,
    );
  }

  // Validate shape
  if (!parsed || typeof parsed !== 'object' || !('behaviors' in parsed)) {
    throw new Error(
      'AI response missing "behaviors" key. ' +
      `Got keys: ${Object.keys(parsed as object).join(', ')}`,
    );
  }

  const response = parsed as GroundedSpecResponse;

  // Validate each behavior has required fields
  for (const b of response.behaviors) {
    if (!b.name) throw new Error('Behavior missing "name" field');
    b.preconditions = b.preconditions ?? [];
    b.postconditions = b.postconditions ?? [];
    b.invariants = b.invariants ?? [];
    b.errors = b.errors ?? [];
    b.effects = b.effects ?? [];
    b.inputs = b.inputs ?? [];
    b.output = b.output ?? { type: 'void' };
    b.description = b.description ?? '';
  }

  return response;
}

// ============================================================================
// Helpers
// ============================================================================

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + '...' : s;
}
