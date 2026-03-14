/**
 * AI Tool Detection
 *
 * Detects the currently active AI coding tool from environment variables,
 * process markers, and config files. Used by the pre-commit hook to
 * automatically stamp commits with AI-Tool trailers.
 *
 * @module @isl-lang/code-provenance
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentTool, ProvenanceSession } from '../types.js';

export interface DetectedTool {
  tool: AgentTool;
  model?: string;
  source: 'env' | 'process' | 'config' | 'provenance-json';
}

/**
 * Detect the active AI tool from all available signals.
 * Returns null if no AI tool can be detected.
 */
export function detectActiveTool(cwd?: string): DetectedTool | null {
  return (
    detectFromEnvVars() ??
    detectFromProcess() ??
    detectFromProvenanceFile(cwd) ??
    null
  );
}

/**
 * Detect from ShipGate-specific env vars.
 * These are the most explicit signal — set by the user or CI.
 */
function detectFromEnvVars(): DetectedTool | null {
  const tool = process.env.SHIPGATE_AI_TOOL;
  if (tool) {
    return {
      tool: normalizeToolName(tool),
      model: process.env.SHIPGATE_AI_MODEL,
      source: 'env',
    };
  }
  return null;
}

/**
 * Detect from process/terminal environment markers.
 */
function detectFromProcess(): DetectedTool | null {
  const termProgram = process.env.TERM_PROGRAM ?? '';
  const cursorVersion = process.env.CURSOR_VERSION ?? '';

  if (cursorVersion || termProgram.toLowerCase().includes('cursor')) {
    return { tool: 'cursor', source: 'process' };
  }

  if (process.env.VSCODE_PID || termProgram.toLowerCase() === 'vscode') {
    if (process.env.GITHUB_COPILOT_ENABLED === '1' || process.env.GH_COPILOT) {
      return { tool: 'copilot', source: 'process' };
    }
    return { tool: 'copilot', source: 'process' };
  }

  if (process.env.WINDSURF_VERSION || termProgram.toLowerCase().includes('windsurf')) {
    return { tool: 'windsurf', source: 'process' };
  }

  if (process.env.AIDER_VERSION) {
    return { tool: 'aider', source: 'process' };
  }

  return null;
}

/**
 * Detect from .shipgate/provenance.json session file.
 */
function detectFromProvenanceFile(cwd?: string): DetectedTool | null {
  const root = cwd ?? process.cwd();
  const sessionPath = path.join(root, '.shipgate', 'provenance.json');

  try {
    const raw = fs.readFileSync(sessionPath, 'utf8');
    const session = JSON.parse(raw) as ProvenanceSession;

    if (session.generator) {
      return {
        tool: normalizeToolName(session.generator),
        model: session.model,
        source: 'provenance-json',
      };
    }
  } catch {
    // File doesn't exist or is invalid
  }

  return null;
}

function normalizeToolName(name: string): AgentTool {
  const lower = name.toLowerCase().trim();
  const map: Record<string, AgentTool> = {
    cursor: 'cursor',
    copilot: 'copilot',
    'github copilot': 'copilot',
    codex: 'codex',
    'openai codex': 'codex',
    claude: 'claude-code',
    'claude-code': 'claude-code',
    anthropic: 'claude-code',
    gemini: 'gemini',
    windsurf: 'windsurf',
    aider: 'aider',
    cody: 'cody',
  };
  return map[lower] ?? 'unknown-ai';
}

/**
 * Format the detected tool as a git trailer value.
 * Example: "cursor/claude-sonnet-4" or "copilot"
 */
export function formatTrailerValue(detected: DetectedTool): string {
  if (detected.model) {
    return `${detected.tool}/${detected.model}`;
  }
  return detected.tool;
}
