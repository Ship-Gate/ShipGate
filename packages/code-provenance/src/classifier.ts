/**
 * Agent Classifier
 *
 * Combines multiple AI signals from commit metadata, provenance files,
 * and config files into a single AgentInfo with a confidence score.
 *
 * @module @isl-lang/code-provenance
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AgentInfo,
  AgentTool,
  AISignal,
  Confidence,
  CommitMetadata,
  ProvenanceSession,
} from './types.js';
import { extractAISignals } from './commit-parser.js';

export interface ClassifierContext {
  cwd: string;
  provenanceSession?: ProvenanceSession | null;
  configSignals?: ConfigSignals;
}

export interface ConfigSignals {
  hasCursorRules: boolean;
  hasCodexInstructions: boolean;
  hasCopilotInstructions: boolean;
  hasWindsurfRules: boolean;
  hasClaudeConfig: boolean;
}

/**
 * Detect config-file signals by checking for known AI tool config files.
 */
export function detectConfigSignals(cwd: string): ConfigSignals {
  const exists = (p: string) => {
    try { return fs.statSync(path.join(cwd, p)).isFile(); } catch { return false; }
  };

  return {
    hasCursorRules: exists('.cursorrules') || exists('.cursor/rules'),
    hasCodexInstructions: exists('.codex-instructions.md'),
    hasCopilotInstructions: exists('.github/copilot-instructions.md'),
    hasWindsurfRules: exists('.windsurf/rules'),
    hasClaudeConfig: exists('.claude/settings.json') || exists('.claude'),
  };
}

/**
 * Load the .shipgate/provenance.json session if it exists.
 */
export function loadProvenanceSession(cwd: string): ProvenanceSession | null {
  const sessionPath = path.join(cwd, '.shipgate', 'provenance.json');
  try {
    const raw = fs.readFileSync(sessionPath, 'utf8');
    return JSON.parse(raw) as ProvenanceSession;
  } catch {
    return null;
  }
}

/**
 * Classify a commit's AI involvement by combining all available signals.
 *
 * Priority:
 * 1. Explicit commit trailers (AI-Tool:) — highest confidence
 * 2. Co-authored-by matching known AI agents
 * 3. Provenance session timestamp match
 * 4. Commit message patterns
 * 5. Config file presence (lowest confidence)
 */
export function classifyCommit(
  meta: CommitMetadata,
  ctx: ClassifierContext,
): AgentInfo | null {
  const signals = extractAISignals(meta);

  if (ctx.provenanceSession) {
    const sessionSignal = matchProvenanceSession(meta, ctx.provenanceSession);
    if (sessionSignal) {
      signals.push(sessionSignal);
    }
  }

  if (signals.length === 0 && ctx.configSignals) {
    const configSignal = inferFromConfig(ctx.configSignals);
    if (configSignal) {
      signals.push(configSignal);
    }
  }

  if (signals.length === 0) return null;

  signals.sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.confidence] ?? 2) - (order[b.confidence] ?? 2);
  });

  const best = signals[0]!;
  return {
    tool: best.agent,
    model: best.model ?? findBestModel(signals),
    detectionMethod: best.method,
  };
}

/**
 * Match a commit timestamp against an active provenance session.
 */
function matchProvenanceSession(
  meta: CommitMetadata,
  session: ProvenanceSession,
): AISignal | null {
  if (!meta.authorDate || !session.sessionStarted) return null;

  const commitTime = new Date(meta.authorDate).getTime();
  const sessionStart = new Date(session.sessionStarted).getTime();
  const sessionEnd = session.sessionEnded
    ? new Date(session.sessionEnded).getTime()
    : Date.now();

  if (commitTime >= sessionStart && commitTime <= sessionEnd) {
    const agent = normalizeSessionGenerator(session.generator);
    return {
      agent,
      model: session.model,
      confidence: 'high',
      method: 'provenance-json',
      raw: `provenance-session: ${session.generator}/${session.model ?? 'unknown'}`,
    };
  }

  return null;
}

function normalizeSessionGenerator(generator: string): AgentTool {
  const lower = generator.toLowerCase();
  if (lower.includes('cursor')) return 'cursor';
  if (lower.includes('copilot')) return 'copilot';
  if (lower.includes('claude')) return 'claude-code';
  if (lower.includes('codex')) return 'codex';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('windsurf')) return 'windsurf';
  if (lower.includes('aider')) return 'aider';
  if (lower.includes('cody')) return 'cody';
  return 'unknown-ai';
}

/**
 * Infer a likely AI tool from config file presence.
 * This is low-confidence — the config file existing doesn't mean every
 * commit used that tool.
 */
function inferFromConfig(config: ConfigSignals): AISignal | null {
  if (config.hasCursorRules) {
    return {
      agent: 'cursor',
      confidence: 'low',
      method: 'config-file',
      raw: '.cursorrules present',
    };
  }
  if (config.hasCopilotInstructions) {
    return {
      agent: 'copilot',
      confidence: 'low',
      method: 'config-file',
      raw: '.github/copilot-instructions.md present',
    };
  }
  if (config.hasCodexInstructions) {
    return {
      agent: 'codex',
      confidence: 'low',
      method: 'config-file',
      raw: '.codex-instructions.md present',
    };
  }
  if (config.hasWindsurfRules) {
    return {
      agent: 'windsurf',
      confidence: 'low',
      method: 'config-file',
      raw: '.windsurf/rules present',
    };
  }
  if (config.hasClaudeConfig) {
    return {
      agent: 'claude-code',
      confidence: 'low',
      method: 'config-file',
      raw: '.claude config present',
    };
  }
  return null;
}

function findBestModel(signals: AISignal[]): string | undefined {
  for (const s of signals) {
    if (s.model) return s.model;
  }
  return undefined;
}

/**
 * Get the display name for an agent tool.
 */
export function getAgentDisplayName(tool: AgentTool): string {
  const names: Record<AgentTool, string> = {
    cursor: 'Cursor',
    copilot: 'GitHub Copilot',
    codex: 'OpenAI Codex',
    'claude-code': 'Claude Code',
    gemini: 'Google Gemini',
    windsurf: 'Windsurf',
    aider: 'Aider',
    cody: 'Sourcegraph Cody',
    'unknown-ai': 'Unknown AI',
  };
  return names[tool] ?? tool;
}

/**
 * Determine overall confidence based on agent info and available signals.
 */
export function determineConfidence(
  agent: AgentInfo | null,
  signals: AISignal[],
): Confidence {
  if (!agent) return 'high'; // confident it's human
  if (signals.length === 0) return 'low';

  const best = signals[0]!;
  if (best.confidence === 'high' && signals.length >= 2) return 'high';
  return best.confidence;
}
