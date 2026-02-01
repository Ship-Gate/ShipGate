/**
 * Context Extractor
 * 
 * Scans a repository and returns a context pack for the ISL translator.
 */

import * as path from 'path';
import type {
  ContextPack,
  ExtractContextOptions,
  PolicySuggestion,
  StackInfo,
} from './contextTypes.js';
import {
  detectStack,
  detectFrameworks,
  detectDatabases,
  detectAuth,
  extractEntities,
  detectKeyFiles,
  prioritizeKeyFiles,
} from './detectors/index.js';

const EXTRACTOR_VERSION = '0.1.0';

/**
 * Extract context from a workspace directory
 * 
 * Scans the repository and returns a context pack containing:
 * - Technology stack information
 * - Detected entities from schemas/models
 * - Policy suggestions based on stack
 * - Key files for understanding the codebase
 * 
 * @param workspacePath - Path to the workspace root
 * @param options - Extraction options
 * @returns Context pack for the translator
 */
export async function extractContext(
  workspacePath: string,
  options: ExtractContextOptions = {}
): Promise<ContextPack> {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  const opts: Required<ExtractContextOptions> = {
    maxDepth: options.maxDepth ?? 10,
    ignoreDirs: options.ignoreDirs ?? ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv', 'target'],
    ignorePatterns: options.ignorePatterns ?? ['*.min.js', '*.map', '*.lock'],
    extractFields: options.extractFields ?? true,
    timeoutMs: options.timeoutMs ?? 30000,
  };

  // Normalize workspace path
  const normalizedPath = path.resolve(workspacePath);

  // Run all detections in parallel
  const [stackResult, frameworkResults, databaseResults, authResults, keyFilesRaw] = await Promise.all([
    safeDetect(() => detectStack(normalizedPath), 'stack detection', warnings),
    safeDetect(() => detectFrameworks(normalizedPath), 'framework detection', warnings),
    safeDetect(() => detectDatabases(normalizedPath), 'database detection', warnings),
    safeDetect(() => detectAuth(normalizedPath), 'auth detection', warnings),
    safeDetect(() => detectKeyFiles(normalizedPath, opts.maxDepth), 'key files detection', warnings),
  ]);

  // Extract entities from detected databases
  const detectedEntities = await safeDetect(
    () => extractEntities(normalizedPath, databaseResults || []),
    'entity extraction',
    warnings
  ) || [];

  // Build stack info
  const stack: StackInfo = {
    language: stackResult?.language || 'unknown',
    runtime: stackResult?.runtime || 'unknown',
    frameworks: (frameworkResults || []).map(f => f.framework),
    databases: (databaseResults || []).map(d => d.tech),
    auth: (authResults || []).map(a => a.approach),
    packageManager: stackResult?.packageManager,
    hasTypeScript: stackResult?.hasTypeScript || false,
    isMonorepo: stackResult?.isMonorepo || false,
  };

  // Generate policy suggestions based on stack
  const policySuggestions = generatePolicySuggestions(stack);

  // Prioritize key files
  const keyFiles = prioritizeKeyFiles(keyFilesRaw || []);

  const durationMs = Date.now() - startTime;

  return {
    workspacePath: normalizedPath,
    extractedAt: new Date().toISOString(),
    stack,
    detectedEntities,
    policySuggestions,
    keyFiles,
    warnings,
    metadata: {
      durationMs,
      filesScanned: keyFilesRaw?.length || 0,
      extractorVersion: EXTRACTOR_VERSION,
    },
  };
}

/**
 * Safely execute a detection function, catching errors
 */
async function safeDetect<T>(
  fn: () => Promise<T>,
  name: string,
  warnings: string[]
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`${name} failed: ${message}`);
    return null;
  }
}

/**
 * Generate policy suggestions based on detected stack
 */
function generatePolicySuggestions(stack: StackInfo): PolicySuggestion[] {
  const suggestions: PolicySuggestion[] = [];

  // TypeScript-specific policies
  if (stack.hasTypeScript) {
    suggestions.push({
      policyId: 'TYPE-001',
      enabled: true,
      reason: 'TypeScript project detected - enable strict type checking policies',
    });
  }

  // Auth-related policies
  if (stack.auth.length > 0) {
    suggestions.push({
      policyId: 'AUTH-001',
      enabled: true,
      reason: `Auth detected (${stack.auth.join(', ')}) - enable authentication policies`,
    });

    if (stack.auth.includes('jwt')) {
      suggestions.push({
        policyId: 'SEC-JWT-001',
        enabled: true,
        reason: 'JWT auth detected - enable JWT security policies',
      });
    }
  }

  // Database-related policies
  if (stack.databases.length > 0) {
    suggestions.push({
      policyId: 'DB-001',
      enabled: true,
      reason: `Database detected (${stack.databases.join(', ')}) - enable data integrity policies`,
    });

    if (stack.databases.includes('prisma')) {
      suggestions.push({
        policyId: 'DB-PRISMA-001',
        enabled: true,
        reason: 'Prisma detected - enable schema validation policies',
      });
    }
  }

  // Framework-specific policies
  if (stack.frameworks.includes('next')) {
    suggestions.push({
      policyId: 'NEXT-001',
      enabled: true,
      reason: 'Next.js detected - enable server-side rendering policies',
    });
  }

  if (stack.frameworks.includes('express')) {
    suggestions.push({
      policyId: 'EXPRESS-001',
      enabled: true,
      reason: 'Express detected - enable middleware security policies',
    });
  }

  // PII policies for projects with user data
  if (stack.databases.length > 0 || stack.auth.length > 0) {
    suggestions.push({
      policyId: 'PII-001',
      enabled: true,
      reason: 'User data likely present - enable PII protection policies',
    });
  }

  // API security for projects with routes
  if (stack.frameworks.some(f => ['next', 'express', 'fastify', 'nestjs', 'koa', 'hono'].includes(f))) {
    suggestions.push({
      policyId: 'API-001',
      enabled: true,
      reason: 'API framework detected - enable API security policies',
    });
  }

  return suggestions;
}

/**
 * Quick context extraction - minimal scan for speed
 */
export async function extractContextQuick(workspacePath: string): Promise<ContextPack> {
  return extractContext(workspacePath, {
    maxDepth: 3,
    extractFields: false,
    timeoutMs: 10000,
  });
}
