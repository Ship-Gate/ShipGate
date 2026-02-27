/**
 * AI Provenance Metadata
 *
 * Vendor-agnostic provenance for AI-generated artifacts.
 * Captures generator, model, prompt/context digests, and timestamp.
 * Optional — never blocks verification.
 *
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Provenance Format
// ============================================================================

/**
 * Minimal AI provenance format (vendor-agnostic)
 *
 * Supports: Cursor, Copilot, Claude, ChatGPT, or any AI tool.
 */
export interface AIProvenance {
  /** AI tool (cursor, copilot, claude, chatgpt, etc.) */
  generator: string;
  /** Model identifier (e.g., gpt-4, claude-3-opus) */
  model: string;
  /** SHA-256 digest of prompt text */
  promptDigest: string;
  /** SHA-256 digest of context (optional) */
  contextDigest?: string;
  /** ISO timestamp when generation occurred */
  generatedAt: string;
}

// ============================================================================
// Environment Variables
// ============================================================================

/** AI tool identifier (e.g., cursor, copilot, claude) */
export const ENV_AI_TOOL = 'SHIPGATE_AI_TOOL';
/** Model identifier */
export const ENV_AI_MODEL = 'SHIPGATE_AI_MODEL';
/** SHA-256 of prompt text */
export const ENV_PROMPT_SHA = 'SHIPGATE_PROMPT_SHA';
/** SHA-256 of context (optional) */
export const ENV_CONTEXT_SHA = 'SHIPGATE_CONTEXT_SHA';

// ============================================================================
// Loader
// ============================================================================

/**
 * Load provenance from environment variables.
 * Env vars take precedence over sidecar file.
 */
function loadProvenanceFromEnv(): AIProvenance | null {
  const generator = process.env[ENV_AI_TOOL]?.trim();
  const model = process.env[ENV_AI_MODEL]?.trim();
  const promptDigest = process.env[ENV_PROMPT_SHA]?.trim();
  const contextDigest = process.env[ENV_CONTEXT_SHA]?.trim();

  if (!generator || !model || !promptDigest) {
    return null;
  }

  return {
    generator,
    model,
    promptDigest,
    contextDigest: contextDigest || undefined,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Load provenance from .shipgate/provenance.json sidecar file.
 */
async function loadProvenanceFromFile(projectRoot: string): Promise<AIProvenance | null> {
  const sidecarPath = path.join(projectRoot, '.shipgate', 'provenance.json');
  try {
    const content = await fs.readFile(sidecarPath, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const generator = typeof parsed.generator === 'string' ? parsed.generator.trim() : '';
    const model = typeof parsed.model === 'string' ? parsed.model.trim() : '';
    const promptDigest = typeof parsed.promptDigest === 'string' ? parsed.promptDigest.trim() : '';
    const contextDigest =
      typeof parsed.contextDigest === 'string' ? parsed.contextDigest.trim() : undefined;
    const generatedAt =
      typeof parsed.generatedAt === 'string'
        ? parsed.generatedAt
        : new Date().toISOString();

    if (!generator || !model || !promptDigest) {
      return null;
    }

    return {
      generator,
      model,
      promptDigest,
      contextDigest,
      generatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Load AI provenance from env vars and optional .shipgate/provenance.json.
 * Env vars override sidecar. Returns null if no provenance available.
 *
 * @param projectRoot - Project root (for sidecar path)
 * @returns Provenance or null
 */
export async function loadProvenance(projectRoot: string): Promise<AIProvenance | null> {
  const fromEnv = loadProvenanceFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  return loadProvenanceFromFile(projectRoot);
}

/**
 * Load provenance synchronously (env only).
 * Use when async file read is not available.
 */
export function loadProvenanceSync(): AIProvenance | null {
  return loadProvenanceFromEnv();
}

// ============================================================================
// Template for provenance init
// ============================================================================

export const PROVENANCE_TEMPLATE: AIProvenance = {
  generator: 'cursor',
  model: 'claude-sonnet-4',
  promptDigest: 'REPLACE_WITH_SHA256_OF_PROMPT',
  contextDigest: 'REPLACE_WITH_SHA256_OF_CONTEXT',
  generatedAt: new Date().toISOString(),
};
