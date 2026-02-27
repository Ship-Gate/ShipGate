// ============================================================================
// Prompt Templates for LLM-Assisted Analysis
// Rules: Never invent facts. Every claim must cite code evidence.
// ============================================================================

import type { CodeEvidence } from './types.js';
import { formatEvidenceForPrompt } from './guardrails.js';

const SYSTEM_PROMPT = `You are an analysis assistant for code and specification reasoning.

STRICT RULES:
1. NEVER invent facts. Only state what you can support with the provided evidence.
2. EVERY factual claim MUST cite code evidence using one of these formats:
   - Inline: "filename.ts:42" or "path/file.ts:10-15"
   - Tag: [cite: filename.ts:42] or [citation: snippet-id]
3. If you cannot support a claim with the given evidence, do not make the claim.
4. Prefer short, precise claims. One citation per claim.
5. Do not add file paths or line numbers that are not in the evidence list.`;

/**
 * Build system prompt for ambiguous-case analysis (no invention, citations required).
 */
export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/**
 * Build user prompt for failure analysis with evidence block.
 */
export function buildAnalysisPrompt(params: {
  failureSummary: string;
  evidence: CodeEvidence[];
  question?: string;
}): string {
  const evidenceBlock = formatEvidenceForPrompt(params.evidence);
  const question = params.question ?? 'What is the likely root cause and where in the code?';
  const evidenceSection = evidenceBlock
    ? `## Allowed code evidence (cite only these)\n${evidenceBlock}`
    : '## Note\nNo code evidence provided. State only what can be inferred from the failure summary.';
  return `## Failure summary
${params.failureSummary}

${evidenceSection}

## Task
${question}

Respond with brief, cited claims only. Each claim must end with a citation (e.g. auth.ts:42 or [cite: auth.ts:42]).`;
}

/**
 * Build user prompt for generic ambiguous analysis.
 */
export function buildAmbiguousAnalysisPrompt(params: {
  context: string;
  evidence: CodeEvidence[];
  instruction: string;
}): string {
  const evidenceBlock = formatEvidenceForPrompt(params.evidence);
  const evidenceSection = evidenceBlock
    ? `## Allowed code evidence (cite only these)\n${evidenceBlock}`
    : '## Note\nNo code evidence provided. State only what can be inferred from the context.';
  return `## Context
${params.context}

${evidenceSection}

## Instruction
${params.instruction}

Respond with brief, cited claims only. Every factual claim must cite evidence (file:line or [cite: id]).`;
}
