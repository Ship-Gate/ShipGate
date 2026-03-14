/**
 * ISL Spec Parser / Validator
 *
 * Parses raw ISL text from the LLM and validates it, extracting
 * structured entity/behavior data.
 * @module @isl-lang/spec-generator/parser
 */

import type { GeneratedSpec, EntitySpec, BehaviorSpec, EntityField, ErrorCase } from './types.js';

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:isl|typescript|ts)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

function extractChangeSummary(raw: string): string {
  const match = raw.match(/^\/\/\s*Changes:\s*(.+)/m);
  return match?.[1]?.trim() ?? '';
}

function parseEntityFields(block: string): EntityField[] {
  const fields: EntityField[] = [];
  const fieldRe = /^\s*(\w+)\s*:\s*([A-Za-z]+(?:\[[^\]]*\])?)\s*(\[[^\]]*\])?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(block)) !== null) {
    const name = m[1]!.trim();
    if (['invariants', 'input', 'output', 'pre', 'post', 'temporal'].includes(name)) continue;
    const rawType = m[2]!.trim();
    const rawMods = (m[3] ?? '').replace(/[\[\]]/g, '');
    const modifiers = rawMods ? rawMods.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const optional = modifiers.includes('optional');
    fields.push({ name, type: rawType, modifiers, optional });
  }
  return fields;
}

function parseInvariants(block: string): string[] {
  const inv: string[] = [];
  const match = block.match(/invariants\s*\{([^}]*)\}/s);
  if (!match) return inv;
  const inner = match[1]!;
  for (const line of inner.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      inv.push(trimmed);
    }
  }
  return inv;
}

function parseEntities(isl: string): EntitySpec[] {
  const entities: EntitySpec[] = [];
  const entityRe = /entity\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
  let m: RegExpExecArray | null;
  while ((m = entityRe.exec(isl)) !== null) {
    const name = m[1]!;
    const body = m[2]!;
    entities.push({
      name,
      fields: parseEntityFields(body),
      invariants: parseInvariants(body),
    });
  }
  return entities;
}

function parseErrorCases(outputBlock: string): ErrorCase[] {
  const errors: ErrorCase[] = [];
  const errBlockMatch = outputBlock.match(/errors\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
  if (!errBlockMatch) return errors;
  const inner = errBlockMatch[1]!;
  const caseRe = /(\w+)\s*\{[^}]*when\s*:\s*["']([^"']+)["'][^}]*\}/gs;
  let m: RegExpExecArray | null;
  while ((m = caseRe.exec(inner)) !== null) {
    errors.push({ name: m[1]!, when: m[2]! });
  }
  return errors;
}

function parseBehaviorInput(inputBlock: string): EntityField[] {
  return parseEntityFields(inputBlock);
}

function parseBehaviors(isl: string): BehaviorSpec[] {
  const behaviors: BehaviorSpec[] = [];
  const behaviorRe = /behavior\s+(\w+)\s*\{([\s\S]*?)(?=\n\s*(?:behavior|entity|enum|\}))/g;
  let m: RegExpExecArray | null;
  while ((m = behaviorRe.exec(isl)) !== null) {
    const name = m[1]!;
    const body = m[2]!;

    const inputMatch = body.match(/input\s*\{([^}]*)\}/s);
    const outputMatch = body.match(/output\s*\{([\s\S]*?)(?=pre\s*\{|post\s*|temporal\s*\{|\}$)/s);
    const preMatch = body.match(/pre\s*\{([^}]*)\}/s);
    const postMatch = body.match(/post\s+success\s*\{([^}]*)\}/s);

    const input = inputMatch ? parseBehaviorInput(inputMatch[1]!) : [];
    const outputBlock = outputMatch?.[1] ?? '';
    const errors = parseErrorCases(outputBlock);

    const successTypeMatch = outputBlock.match(/success\s*:\s*(\w+)/);
    const successType = successTypeMatch?.[1];

    const preconditions = preMatch
      ? preMatch[1]!.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
      : [];
    const postconditions = postMatch
      ? postMatch[1]!.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'))
      : [];

    behaviors.push({
      name,
      input,
      output: { successType, errors },
      preconditions,
      postconditions,
    });
  }
  return behaviors;
}

function parseEnums(isl: string): Array<{ name: string; values: string[] }> {
  const enums: Array<{ name: string; values: string[] }> = [];
  const enumRe = /enum\s+(\w+)\s*\{([^}]*)\}/gs;
  let m: RegExpExecArray | null;
  while ((m = enumRe.exec(isl)) !== null) {
    const values = m[2]!
      .split(/\s+/)
      .map((v) => v.trim())
      .filter((v) => v && /^[A-Z_]+$/.test(v));
    if (values.length > 0) enums.push({ name: m[1]!, values });
  }
  return enums;
}

function extractDomainName(isl: string): string {
  const match = isl.match(/domain\s+(\w+)\s*\{/);
  return match?.[1] ?? 'GeneratedApp';
}

function extractVersion(isl: string): string {
  const match = isl.match(/version\s*:\s*["']([^"']+)["']/);
  return match?.[1] ?? '1.0.0';
}

function validateISL(isl: string): string[] {
  const errors: string[] = [];
  if (!isl.match(/^domain\s+\w+\s*\{/m)) {
    errors.push('Missing domain declaration');
  }
  const entities = (isl.match(/^entity\s+\w+/gm) ?? []).length;
  const behaviors = (isl.match(/^behavior\s+\w+/gm) ?? []).length;
  if (entities === 0) errors.push('Spec has no entity definitions');
  if (behaviors === 0) errors.push('Spec has no behavior definitions');
  const behaviorBlocks = [...isl.matchAll(/behavior\s+(\w+)\s*\{([\s\S]*?)(?=\n\s*(?:behavior|entity|enum|\}))/g)];
  for (const bm of behaviorBlocks) {
    const bname = bm[1];
    const bbody = bm[2]!;
    if (!bbody.includes('errors')) {
      errors.push(`Behavior "${bname}" has no error cases — add at least one error block`);
    }
  }
  if (!isl.includes('}')) {
    errors.push('Spec appears to be missing closing braces');
  }
  return errors;
}

export function parseGeneratedISL(
  raw: string,
  prompt: string,
  model: string,
): GeneratedSpec {
  const cleaned = stripMarkdownFences(raw);
  const changeSummary = extractChangeSummary(cleaned);
  const errors = validateISL(cleaned);

  return {
    domainName: extractDomainName(cleaned),
    version: extractVersion(cleaned),
    description: changeSummary || prompt.slice(0, 120),
    entities: parseEntities(cleaned),
    enums: parseEnums(cleaned),
    behaviors: parseBehaviors(cleaned),
    rawISL: cleaned,
    isValid: errors.length === 0,
    validationErrors: errors,
    prompt,
    model,
    generatedAt: new Date().toISOString(),
  };
}
