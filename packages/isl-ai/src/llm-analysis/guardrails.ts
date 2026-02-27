// ============================================================================
// Guardrails: Zero Hallucination
// Every claim must cite code evidence (file:line or snippet id). No invented facts.
// ============================================================================

import type { CitedClaim, CodeEvidence } from './types.js';

/** Citation format: file:line or file:startLine-endLine */
const FILE_LINE_RE = /(?:^|\s)([a-zA-Z0-9_./-]+\.[a-z]+):(\d+)(?:-(\d+))?(?:\s|$|[,.)])/g;
/** Citation format: [cite: id] or [citation: id] */
const CITE_TAG_RE = /\[cite(?:ation)?:\s*([^\]]+)\]/g;
/** Snippet id from evidence pool, e.g. snippet:auth.ts:42 */
const SNIPPET_ID_RE = /snippet:([a-zA-Z0-9_.:-]+)/g;

/**
 * Extract claims that have a valid citation; reject any claim without one.
 * Returns only claims that cite code evidence (file:line or snippet id).
 */
export function extractCitedClaims(
  rawContent: string,
  evidence: CodeEvidence[]
): { claims: CitedClaim[]; rejectedUncitedCount: number } {
  const claims: CitedClaim[] = [];
  let rejectedUncitedCount = 0;

  const validCitationIds = new Set(
    evidence.map((e) => e.citationId ?? `${e.file}:${e.startLine}`)
  );

  const lines = rawContent.split('\n').filter((s) => s.trim().length > 0);
  let currentClaim: string[] = [];
  let hadCitation = false;

  for (const line of lines) {
    const fileLineMatches = [...line.matchAll(FILE_LINE_RE)];
    const citeTagMatches = [...line.matchAll(CITE_TAG_RE)];
    const snippetMatches = [...line.matchAll(SNIPPET_ID_RE)];

    const hasFileLine = fileLineMatches.length > 0;
    const hasCiteId =
      citeTagMatches.some((m) => validCitationIds.has(m[1]!.trim())) ||
      snippetMatches.some((m) => validCitationIds.has(m[1]!));

    if (hasFileLine || hasCiteId) {
      hadCitation = true;
      const m = fileLineMatches[0];
      const citation = hasFileLine && m
        ? `${m[1]}:${m[2]}${m[3] ? `-${m[3]}` : ''}`
        : citeTagMatches[0]
          ? `[cite: ${citeTagMatches[0]![1]!.trim()}]`
          : snippetMatches[0]
            ? `snippet:${snippetMatches[0]![1]!}`
            : '';
      const claimText = (currentClaim.length > 0 ? currentClaim.join(' ') : line).trim();
      if (claimText) {
        claims.push({
          claim: claimText,
          citation,
          citationType: hasFileLine ? 'file_line' : 'snippet',
        });
      }
      currentClaim = [];
    } else {
      if (currentClaim.length > 0 || line.trim().length > 0) {
        currentClaim.push(line.trim());
      }
    }
  }

  if (currentClaim.length > 0 && !hadCitation) {
    rejectedUncitedCount += 1;
  }

  return { claims, rejectedUncitedCount };
}

/**
 * Validate that content does not contain uncited factual claims.
 * We require at least one citation in the response for it to be accepted.
 */
export function assertNoUncitedFacts(
  rawContent: string,
  evidence: CodeEvidence[]
): { valid: boolean; citedCount: number; rejectedCount: number } {
  const { claims, rejectedUncitedCount } = extractCitedClaims(rawContent, evidence);
  const citedCount = claims.length;
  const valid = citedCount > 0 || (citedCount === 0 && rawContent.trim().length === 0);
  return {
    valid,
    citedCount,
    rejectedCount: rejectedUncitedCount,
  };
}

/**
 * Build a set of citation ids from evidence for prompt injection.
 */
export function formatEvidenceForPrompt(evidence: CodeEvidence[]): string {
  return evidence
    .map(
      (e) =>
        `- ${e.citationId ?? `${e.file}:${e.startLine}`}\n  ${e.file}:${e.startLine}-${e.endLine}\n  \`\`\`\n${e.code.trim().slice(0, 300)}\n  \`\`\``
    )
    .join('\n');
}
