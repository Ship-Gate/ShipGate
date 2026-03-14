/**
 * Commit Metadata Parser
 *
 * Extracts AI signals from git commit metadata: trailers, co-authored-by
 * lines, commit message patterns, and author email heuristics.
 *
 * @module @isl-lang/code-provenance
 */

import { execSync } from 'child_process';
import type { CommitMetadata, CoAuthor, AISignal } from './types.js';

const COMMIT_FORMAT = '%H%n%s%n%b%n---AUTHOR---%n%an%n%ae%n%aI%n---END---';

/**
 * Fetch full commit metadata for a given hash.
 */
export function getCommitMetadata(hash: string, cwd: string): CommitMetadata | null {
  try {
    const raw = execSync(
      `git log -1 --format="${COMMIT_FORMAT}" ${hash}`,
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return parseCommitOutput(raw, hash);
  } catch {
    return null;
  }
}

/**
 * Parse the raw git log output into CommitMetadata.
 */
export function parseCommitOutput(raw: string, hash: string): CommitMetadata {
  const lines = raw.split('\n');
  const commitHash = lines[0]?.trim() || hash;
  const message = lines[1]?.trim() || '';

  const authorMarker = lines.indexOf('---AUTHOR---');
  const bodyLines = lines.slice(2, authorMarker > 2 ? authorMarker : undefined);
  const body = bodyLines.join('\n').trim();

  let authorName = '';
  let authorEmail = '';
  let authorDate = '';
  if (authorMarker >= 0) {
    authorName = lines[authorMarker + 1]?.trim() || '';
    authorEmail = lines[authorMarker + 2]?.trim() || '';
    authorDate = lines[authorMarker + 3]?.trim() || '';
  }

  const trailers = parseTrailers(body);
  const coAuthors = parseCoAuthors(body);

  return { hash: commitHash, message, body, authorName, authorEmail, authorDate, trailers, coAuthors };
}

/**
 * Extract key-value trailers from commit body.
 * Trailers are lines matching `Key: Value` at the end of the message body.
 */
export function parseTrailers(body: string): Record<string, string> {
  const trailers: Record<string, string> = {};
  const lines = body.split('\n').reverse();

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]+):\s+(.+)$/);
    if (match) {
      const key = match[1]!.toLowerCase();
      if (key !== 'co-authored-by') {
        trailers[key] = match[2]!;
      }
    } else if (line.trim() === '') {
      continue;
    } else {
      break;
    }
  }

  return trailers;
}

/**
 * Extract Co-authored-by entries from commit body.
 */
export function parseCoAuthors(body: string): CoAuthor[] {
  const coAuthors: CoAuthor[] = [];
  const regex = /Co-authored-by:\s*(.+?)\s*<([^>]+)>/gi;
  let match;
  while ((match = regex.exec(body)) !== null) {
    coAuthors.push({ name: match[1]!.trim(), email: match[2]!.trim() });
  }
  return coAuthors;
}

// ============================================================================
// AI Signal Extraction
// ============================================================================

/**
 * Extract all AI signals from a commit's metadata.
 * Returns signals sorted by confidence (highest first).
 */
export function extractAISignals(meta: CommitMetadata): AISignal[] {
  const signals: AISignal[] = [];

  extractFromTrailers(meta, signals);
  extractFromCoAuthors(meta, signals);
  extractFromMessage(meta, signals);
  extractFromAuthorEmail(meta, signals);

  signals.sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.confidence] ?? 2) - (order[b.confidence] ?? 2);
  });

  return signals;
}

function extractFromTrailers(meta: CommitMetadata, signals: AISignal[]): void {
  const aiTool = meta.trailers['ai-tool'];
  if (aiTool) {
    const [tool, model] = aiTool.split('/');
    const agent = normalizeAgentName(tool!);
    signals.push({
      agent,
      model: model || undefined,
      confidence: 'high',
      method: 'commit-trailer',
      raw: `AI-Tool: ${aiTool}`,
    });
  }

  const aiModel = meta.trailers['ai-model'];
  if (aiModel && !meta.trailers['ai-tool']) {
    signals.push({
      agent: inferAgentFromModel(aiModel),
      model: aiModel,
      confidence: 'high',
      method: 'commit-trailer',
      raw: `AI-Model: ${aiModel}`,
    });
  }

  const aiSession = meta.trailers['ai-session'];
  if (aiSession && signals.length === 0) {
    signals.push({
      agent: 'unknown-ai',
      confidence: 'medium',
      method: 'commit-trailer',
      raw: `AI-Session: ${aiSession}`,
    });
  }
}

function extractFromCoAuthors(meta: CommitMetadata, signals: AISignal[]): void {
  for (const coAuthor of meta.coAuthors) {
    const agent = identifyCoAuthor(coAuthor);
    if (agent) {
      signals.push({
        agent: agent.tool,
        model: agent.model,
        confidence: 'high',
        method: 'co-authored-by',
        raw: `Co-authored-by: ${coAuthor.name} <${coAuthor.email}>`,
      });
    }
  }
}

const MESSAGE_PATTERNS: Array<{ pattern: RegExp; agent: import('./types.js').AgentTool; model?: string }> = [
  { pattern: /\[cursor\]/i, agent: 'cursor' },
  { pattern: /\[copilot\]/i, agent: 'copilot' },
  { pattern: /\[claude\]/i, agent: 'claude-code' },
  { pattern: /\[codex\]/i, agent: 'codex' },
  { pattern: /\[gemini\]/i, agent: 'gemini' },
  { pattern: /\[windsurf\]/i, agent: 'windsurf' },
  { pattern: /\[aider\]/i, agent: 'aider' },
  { pattern: /\[cody\]/i, agent: 'cody' },
  { pattern: /generated\s+(?:by|with|via)\s+cursor/i, agent: 'cursor' },
  { pattern: /generated\s+(?:by|with|via)\s+copilot/i, agent: 'copilot' },
  { pattern: /generated\s+(?:by|with|via)\s+claude/i, agent: 'claude-code' },
  { pattern: /generated\s+(?:by|with|via)\s+codex/i, agent: 'codex' },
  { pattern: /generated\s+(?:by|with|via)\s+gemini/i, agent: 'gemini' },
  { pattern: /generated\s+(?:by|with|via)\s+windsurf/i, agent: 'windsurf' },
  { pattern: /via\s+cursor\s+composer/i, agent: 'cursor' },
  { pattern: /aider:/i, agent: 'aider' },
  { pattern: /aider\s+commit/i, agent: 'aider' },
];

function extractFromMessage(meta: CommitMetadata, signals: AISignal[]): void {
  const text = `${meta.message}\n${meta.body}`;
  for (const { pattern, agent, model } of MESSAGE_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({
        agent,
        model,
        confidence: 'medium',
        method: 'commit-message',
        raw: text.match(pattern)![0]!,
      });
      return;
    }
  }
}

function extractFromAuthorEmail(meta: CommitMetadata, signals: AISignal[]): void {
  const email = meta.authorEmail.toLowerCase();
  if (email.includes('copilot') || email.includes('github-actions')) return;
  if (email === 'noreply@github.com') {
    signals.push({
      agent: 'copilot',
      confidence: 'low',
      method: 'author-heuristic',
      raw: `author-email: ${meta.authorEmail}`,
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

const CO_AUTHOR_MAP: Record<string, { tool: import('./types.js').AgentTool; model?: string }> = {
  'copilot': { tool: 'copilot' },
  'github copilot': { tool: 'copilot' },
  'claude': { tool: 'claude-code' },
  'anthropic': { tool: 'claude-code' },
  'cursor': { tool: 'cursor' },
  'codeium': { tool: 'cody' },
  'cody': { tool: 'cody' },
  'gemini': { tool: 'gemini' },
  'google': { tool: 'gemini' },
};

function identifyCoAuthor(coAuthor: CoAuthor): { tool: import('./types.js').AgentTool; model?: string } | null {
  const nameLower = coAuthor.name.toLowerCase();
  const emailLower = coAuthor.email.toLowerCase();

  for (const [key, value] of Object.entries(CO_AUTHOR_MAP)) {
    if (nameLower.includes(key) || emailLower.includes(key)) {
      return value;
    }
  }

  if (emailLower.includes('noreply') && emailLower.includes('github')) {
    return { tool: 'copilot' };
  }

  return null;
}

export function normalizeAgentName(name: string): import('./types.js').AgentTool {
  const lower = name.toLowerCase().trim();
  const MAP: Record<string, import('./types.js').AgentTool> = {
    cursor: 'cursor',
    copilot: 'copilot',
    'github copilot': 'copilot',
    'gh copilot': 'copilot',
    codex: 'codex',
    'openai codex': 'codex',
    claude: 'claude-code',
    'claude-code': 'claude-code',
    anthropic: 'claude-code',
    gemini: 'gemini',
    'google gemini': 'gemini',
    windsurf: 'windsurf',
    aider: 'aider',
    cody: 'cody',
    codeium: 'cody',
  };
  return MAP[lower] ?? 'unknown-ai';
}

function inferAgentFromModel(model: string): import('./types.js').AgentTool {
  const lower = model.toLowerCase();
  if (lower.includes('claude')) return 'claude-code';
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'codex';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('deepseek') || lower.includes('codestral')) return 'unknown-ai';
  return 'unknown-ai';
}
