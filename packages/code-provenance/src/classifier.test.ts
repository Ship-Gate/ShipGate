import { describe, it, expect } from 'vitest';
import {
  classifyCommit,
  getAgentDisplayName,
  determineConfidence,
  type ClassifierContext,
} from './classifier.js';
import type { CommitMetadata, AISignal } from './types.js';

function makeMeta(overrides: Partial<CommitMetadata> = {}): CommitMetadata {
  return {
    hash: 'abc123',
    message: 'test commit',
    body: '',
    authorName: 'Test User',
    authorEmail: 'test@example.com',
    authorDate: '2026-03-01T10:00:00Z',
    trailers: {},
    coAuthors: [],
    ...overrides,
  };
}

const baseCtx: ClassifierContext = {
  cwd: '/tmp/test',
  provenanceSession: null,
  configSignals: {
    hasCursorRules: false,
    hasCodexInstructions: false,
    hasCopilotInstructions: false,
    hasWindsurfRules: false,
    hasClaudeConfig: false,
  },
};

describe('classifyCommit', () => {
  it('returns null for human-only commit', () => {
    const meta = makeMeta();
    const result = classifyCommit(meta, baseCtx);
    expect(result).toBeNull();
  });

  it('detects cursor from AI-Tool trailer', () => {
    const meta = makeMeta({ trailers: { 'ai-tool': 'cursor/claude-sonnet-4' } });
    const result = classifyCommit(meta, baseCtx);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('cursor');
    expect(result!.model).toBe('claude-sonnet-4');
    expect(result!.detectionMethod).toBe('commit-trailer');
  });

  it('detects copilot from Co-authored-by', () => {
    const meta = makeMeta({
      coAuthors: [{ name: 'GitHub Copilot', email: 'noreply@github.com' }],
    });
    const result = classifyCommit(meta, baseCtx);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('copilot');
  });

  it('matches provenance session by timestamp', () => {
    const meta = makeMeta({ authorDate: '2026-03-01T12:00:00Z' });
    const ctx: ClassifierContext = {
      ...baseCtx,
      provenanceSession: {
        generator: 'cursor',
        model: 'claude-sonnet-4',
        sessionStarted: '2026-03-01T10:00:00Z',
        autoDetected: true,
      },
    };
    const result = classifyCommit(meta, ctx);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('cursor');
    expect(result!.detectionMethod).toBe('provenance-json');
  });

  it('does not match provenance session outside time window', () => {
    const meta = makeMeta({ authorDate: '2026-02-01T12:00:00Z' });
    const ctx: ClassifierContext = {
      ...baseCtx,
      provenanceSession: {
        generator: 'cursor',
        sessionStarted: '2026-03-01T10:00:00Z',
        sessionEnded: '2026-03-01T18:00:00Z',
        autoDetected: true,
      },
    };
    const result = classifyCommit(meta, ctx);
    expect(result).toBeNull();
  });

  it('falls back to config signals when no other signals exist', () => {
    const meta = makeMeta();
    const ctx: ClassifierContext = {
      ...baseCtx,
      configSignals: {
        hasCursorRules: true,
        hasCodexInstructions: false,
        hasCopilotInstructions: false,
        hasWindsurfRules: false,
        hasClaudeConfig: false,
      },
    };
    const result = classifyCommit(meta, ctx);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('cursor');
    expect(result!.detectionMethod).toBe('config-file');
  });

  it('prefers high-confidence signals over low-confidence', () => {
    const meta = makeMeta({
      trailers: { 'ai-tool': 'copilot' },
    });
    const ctx: ClassifierContext = {
      ...baseCtx,
      configSignals: { ...baseCtx.configSignals!, hasCursorRules: true },
    };
    const result = classifyCommit(meta, ctx);
    expect(result!.tool).toBe('copilot');
  });
});

describe('getAgentDisplayName', () => {
  it.each([
    ['cursor', 'Cursor'],
    ['copilot', 'GitHub Copilot'],
    ['claude-code', 'Claude Code'],
    ['codex', 'OpenAI Codex'],
    ['gemini', 'Google Gemini'],
    ['windsurf', 'Windsurf'],
    ['aider', 'Aider'],
    ['cody', 'Sourcegraph Cody'],
    ['unknown-ai', 'Unknown AI'],
  ] as const)('returns "%s" for %s', (tool, expected) => {
    expect(getAgentDisplayName(tool)).toBe(expected);
  });
});

describe('determineConfidence', () => {
  it('returns high for null agent (confident it is human)', () => {
    expect(determineConfidence(null, [])).toBe('high');
  });

  it('returns low when no signals support agent', () => {
    const agent = { tool: 'cursor' as const, detectionMethod: 'heuristic' as const };
    expect(determineConfidence(agent, [])).toBe('low');
  });

  it('returns high when multiple high-confidence signals agree', () => {
    const agent = { tool: 'cursor' as const, detectionMethod: 'commit-trailer' as const };
    const signals: AISignal[] = [
      { agent: 'cursor', confidence: 'high', method: 'commit-trailer', raw: 'AI-Tool: cursor' },
      { agent: 'cursor', confidence: 'high', method: 'co-authored-by', raw: 'Co-authored-by: Cursor' },
    ];
    expect(determineConfidence(agent, signals)).toBe('high');
  });

  it('returns medium for single medium-confidence signal', () => {
    const agent = { tool: 'cursor' as const, detectionMethod: 'commit-message' as const };
    const signals: AISignal[] = [
      { agent: 'cursor', confidence: 'medium', method: 'commit-message', raw: '[cursor]' },
    ];
    expect(determineConfidence(agent, signals)).toBe('medium');
  });
});
