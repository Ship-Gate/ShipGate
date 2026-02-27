/**
 * Audit Analyzer
 *
 * Scans an existing repository and produces a coverage report
 * comparing detected implementations against ISL specifications.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
  AuditReport,
  AuditSummary,
  AuditOptions,
  DetectedImplementation,
  BehaviorMapping,
  RiskyZone,
  ISLBehavior,
  CoverageStatus,
  RiskLevel,
  DEFAULT_AUDIT_OPTIONS,
} from './auditTypes.js';
import {
  detectRoutesInFile,
  detectAuthInFile,
  detectHandlersInFile,
  isLikelyRouteFile,
  isLikelyAuthFile,
} from './detectors/index.js';

const AGENT_VERSION = '0.1.0';

/**
 * Options for auditWorkspace
 */
export interface AuditWorkspaceOptions extends AuditOptions {
  /** Path to workspace root */
  workspacePath: string;
  /** Path to ISL specs (relative to workspace or absolute) */
  specsPath: string;
}

/**
 * Audit a workspace against ISL specifications
 *
 * @param options - Audit options including workspace and specs paths
 * @returns Audit report with coverage analysis
 */
export async function auditWorkspace(options: AuditWorkspaceOptions): Promise<AuditReport> {
  const startTime = Date.now();
  const {
    workspacePath,
    specsPath,
    maxDepth = 15,
    ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', 'coverage'],
    includePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    includeSnippets = true,
    minConfidence = 0.3,
    timeoutMs = 60000,
  } = options;

  const warnings: string[] = [];
  let filesScanned = 0;
  let specFilesProcessed = 0;

  // Resolve specs path
  const resolvedSpecsPath = path.isAbsolute(specsPath)
    ? specsPath
    : path.join(workspacePath, specsPath);

  // 1. Scan for ISL specs
  const behaviors = await scanISLSpecs(resolvedSpecsPath, warnings);
  specFilesProcessed = behaviors.length > 0 ? 1 : 0;

  // 2. Scan workspace for implementations
  const sourceFiles = await collectSourceFiles(workspacePath, {
    maxDepth,
    ignoreDirs,
    includePatterns,
  });
  filesScanned = sourceFiles.length;

  // 3. Detect implementations
  const implementations = await detectImplementations(
    workspacePath,
    sourceFiles,
    minConfidence
  );

  // 4. Map behaviors to implementations
  const behaviorMappings = mapBehaviorsToImplementations(behaviors, implementations);

  // 5. Identify risky zones
  const riskyZones = identifyRiskyZones(implementations, behaviorMappings, sourceFiles);

  // 6. Calculate summary
  const summary = calculateSummary(behaviorMappings, implementations, riskyZones);

  const durationMs = Date.now() - startTime;

  return {
    version: '1.0',
    reportId: randomUUID(),
    workspacePath,
    specsPath,
    auditedAt: new Date().toISOString(),
    durationMs,
    summary,
    behaviorMappings,
    detectedImplementations: implementations,
    riskyZones,
    warnings,
    metadata: {
      agentVersion: AGENT_VERSION,
      filesScanned,
      specFilesProcessed,
    },
  };
}

/**
 * Scan ISL specs directory for behaviors
 */
async function scanISLSpecs(specsPath: string, warnings: string[]): Promise<ISLBehavior[]> {
  const behaviors: ISLBehavior[] = [];

  try {
    const stat = await fs.stat(specsPath);

    if (stat.isDirectory()) {
      const files = await fs.readdir(specsPath);
      for (const file of files) {
        if (file.endsWith('.isl')) {
          const filePath = path.join(specsPath, file);
          const fileBehaviors = await parseISLFile(filePath, warnings);
          behaviors.push(...fileBehaviors);
        }
      }
    } else if (stat.isFile() && specsPath.endsWith('.isl')) {
      const fileBehaviors = await parseISLFile(specsPath, warnings);
      behaviors.push(...fileBehaviors);
    }
  } catch {
    warnings.push(`Could not read specs from: ${specsPath}`);
  }

  return behaviors;
}

/**
 * Parse a single ISL file for behaviors
 */
async function parseISLFile(filePath: string, warnings: string[]): Promise<ISLBehavior[]> {
  const behaviors: ISLBehavior[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract domain name
    const domainMatch = content.match(/domain\s+(\w+)/);
    const domain = domainMatch?.[1] || 'Unknown';

    // Extract behaviors
    const behaviorPattern = /behavior\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let match: RegExpExecArray | null;

    while ((match = behaviorPattern.exec(content)) !== null) {
      const name = match[1]!;
      const body = match[2]!;

      behaviors.push({
        name,
        domain,
        specPath: filePath,
        preconditions: extractClauses(body, 'pre'),
        postconditions: extractClauses(body, 'post'),
        invariants: extractClauses(body, 'invariant'),
        effects: extractClauses(body, 'effect'),
      });
    }
  } catch {
    warnings.push(`Could not parse ISL file: ${filePath}`);
  }

  return behaviors;
}

/**
 * Extract clauses of a specific type from behavior body
 */
function extractClauses(body: string, type: string): string[] {
  const clauses: string[] = [];
  const pattern = new RegExp(`${type}\\s*\\{([^}]+)\\}|${type}\\s+([^\\n;]+)`, 'gi');

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const clause = (match[1] || match[2] || '').trim();
    if (clause) {
      clauses.push(clause);
    }
  }

  return clauses;
}

/**
 * Collect source files from workspace
 */
async function collectSourceFiles(
  workspacePath: string,
  options: { maxDepth: number; ignoreDirs: string[]; includePatterns: string[] }
): Promise<string[]> {
  const files: string[] = [];

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > options.maxDepth) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(workspacePath, fullPath);

        if (entry.isDirectory()) {
          if (!options.ignoreDirs.includes(entry.name)) {
            await scan(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          // Check if file matches include patterns
          if (matchesPatterns(relativePath, options.includePatterns)) {
            files.push(relativePath);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  await scan(workspacePath, 0);
  return files;
}

/**
 * Check if a file path matches any of the patterns
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple pattern matching (supports *.ext and **/*.ext)
    const ext = pattern.replace(/^\*+\/?\*?/, '');
    if (filePath.endsWith(ext.replace('*', ''))) {
      return true;
    }
  }
  return false;
}

/**
 * Detect implementations in source files
 */
async function detectImplementations(
  workspacePath: string,
  files: string[],
  minConfidence: number
): Promise<DetectedImplementation[]> {
  const implementations: DetectedImplementation[] = [];

  for (const file of files) {
    // Detect routes
    if (isLikelyRouteFile(file) || file.includes('api') || file.includes('route')) {
      const routes = await detectRoutesInFile(workspacePath, file);
      implementations.push(...routes.filter(r => r.confidence >= minConfidence));
    }

    // Detect auth
    if (isLikelyAuthFile(file) || file.includes('auth') || file.includes('middleware')) {
      const authImpls = await detectAuthInFile(workspacePath, file);
      implementations.push(...authImpls.filter(a => a.confidence >= minConfidence));
    }

    // Detect handlers (for service/handler/controller files)
    if (file.includes('service') || file.includes('handler') || file.includes('controller')) {
      const handlers = await detectHandlersInFile(workspacePath, file);
      implementations.push(...handlers.filter(h => h.confidence >= minConfidence));
    }
  }

  return implementations;
}

/**
 * Map ISL behaviors to detected implementations
 */
function mapBehaviorsToImplementations(
  behaviors: ISLBehavior[],
  implementations: DetectedImplementation[]
): BehaviorMapping[] {
  const mappings: BehaviorMapping[] = [];

  for (const behavior of behaviors) {
    const matchedImpls = findMatchingImplementations(behavior, implementations);
    const status = determineCoverageStatus(behavior, matchedImpls);
    const totalClauses =
      behavior.preconditions.length +
      behavior.postconditions.length +
      behavior.invariants.length +
      behavior.effects.length;

    const clausesCovered = calculateClausesCovered(behavior, matchedImpls);

    mappings.push({
      behavior,
      implementations: matchedImpls,
      status,
      coveragePercent: totalClauses > 0 ? (clausesCovered / totalClauses) * 100 : 0,
      clausesCovered,
      totalClauses,
      confidence: matchedImpls.length > 0
        ? matchedImpls.reduce((sum, i) => sum + i.confidence, 0) / matchedImpls.length
        : 0,
      notes: generateMappingNotes(behavior, matchedImpls, status),
    });
  }

  return mappings;
}

/**
 * Find implementations that match a behavior
 */
function findMatchingImplementations(
  behavior: ISLBehavior,
  implementations: DetectedImplementation[]
): DetectedImplementation[] {
  const behaviorName = behavior.name.toLowerCase();
  const matches: DetectedImplementation[] = [];

  for (const impl of implementations) {
    const implName = impl.name.toLowerCase();
    const fnName = impl.functionName?.toLowerCase() || '';

    // Check for name similarity
    if (
      implName.includes(behaviorName) ||
      behaviorName.includes(implName) ||
      fnName.includes(behaviorName) ||
      behaviorName.includes(fnName)
    ) {
      matches.push(impl);
      continue;
    }

    // Check for HTTP method + route path match (e.g., CreateUser -> POST /users)
    if (impl.type === 'route' && impl.httpMethod && impl.routePath) {
      const routeWords = impl.routePath.split('/').filter(Boolean);
      const behaviorWords = behaviorName.split(/(?=[A-Z])/).map(w => w.toLowerCase());

      const hasOverlap = behaviorWords.some(bw =>
        routeWords.some(rw => rw.includes(bw) || bw.includes(rw))
      );

      if (hasOverlap) {
        matches.push(impl);
      }
    }
  }

  return matches;
}

/**
 * Determine coverage status based on implementations
 */
function determineCoverageStatus(
  behavior: ISLBehavior,
  implementations: DetectedImplementation[]
): CoverageStatus {
  if (implementations.length === 0) {
    return 'missing';
  }

  const totalClauses =
    behavior.preconditions.length +
    behavior.postconditions.length +
    behavior.invariants.length +
    behavior.effects.length;

  if (totalClauses === 0) {
    return 'unknown';
  }

  // Check if implementations have matching patterns
  const hasAuthPatterns = implementations.some(i =>
    i.patterns.some(p => p.type === 'auth-check')
  );
  const hasValidation = implementations.some(i =>
    i.patterns.some(p => p.type === 'validation')
  );
  const hasErrorHandling = implementations.some(i =>
    i.patterns.some(p => p.type === 'error-handling')
  );

  const patternScore =
    (hasAuthPatterns ? 1 : 0) +
    (hasValidation ? 1 : 0) +
    (hasErrorHandling ? 1 : 0);

  if (patternScore >= 2) {
    return 'covered';
  }

  return 'partial';
}

/**
 * Calculate how many clauses are covered
 */
function calculateClausesCovered(
  behavior: ISLBehavior,
  implementations: DetectedImplementation[]
): number {
  let covered = 0;

  // Preconditions covered by validation/auth patterns
  const hasValidation = implementations.some(i =>
    i.patterns.some(p => p.type === 'validation')
  );
  const hasAuth = implementations.some(i =>
    i.patterns.some(p => p.type === 'auth-check')
  );

  if (hasValidation && behavior.preconditions.length > 0) {
    covered += Math.ceil(behavior.preconditions.length / 2);
  }
  if (hasAuth && behavior.preconditions.some(p => /auth|permission|role/i.test(p))) {
    covered += Math.ceil(behavior.preconditions.length / 2);
  }

  // Postconditions covered by database/assertion patterns
  const hasDatabase = implementations.some(i =>
    i.patterns.some(p => p.type === 'database')
  );
  const hasAssertion = implementations.some(i =>
    i.patterns.some(p => p.type === 'assertion')
  );

  if ((hasDatabase || hasAssertion) && behavior.postconditions.length > 0) {
    covered += Math.ceil(behavior.postconditions.length / 2);
  }

  // Effects covered by external-call patterns
  const hasExternalCall = implementations.some(i =>
    i.patterns.some(p => p.type === 'external-call')
  );

  if (hasExternalCall && behavior.effects.length > 0) {
    covered += Math.ceil(behavior.effects.length / 2);
  }

  return covered;
}

/**
 * Generate notes for a behavior mapping
 */
function generateMappingNotes(
  behavior: ISLBehavior,
  implementations: DetectedImplementation[],
  status: CoverageStatus
): string[] {
  const notes: string[] = [];

  if (implementations.length === 0) {
    notes.push(`No implementation found for behavior '${behavior.name}'`);
    return notes;
  }

  notes.push(`Found ${implementations.length} matching implementation(s)`);

  // Check for missing patterns
  const hasAuth = implementations.some(i => i.patterns.some(p => p.type === 'auth-check'));
  const hasValidation = implementations.some(i => i.patterns.some(p => p.type === 'validation'));

  if (behavior.preconditions.length > 0 && !hasValidation) {
    notes.push('Warning: Preconditions defined but no validation detected');
  }

  if (behavior.preconditions.some(p => /auth|permission/i.test(p)) && !hasAuth) {
    notes.push('Warning: Auth preconditions defined but no auth check detected');
  }

  if (status === 'partial') {
    notes.push('Coverage is partial - review implementation for completeness');
  }

  return notes;
}

/**
 * Identify risky zones in the codebase
 */
function identifyRiskyZones(
  implementations: DetectedImplementation[],
  mappings: BehaviorMapping[],
  allFiles: string[]
): RiskyZone[] {
  const riskyZones: RiskyZone[] = [];

  // Find routes without auth
  for (const impl of implementations) {
    if (impl.type === 'route') {
      const hasAuth = impl.patterns.some(p => p.type === 'auth-check');
      const hasValidation = impl.patterns.some(p => p.type === 'validation');

      if (!hasAuth) {
        riskyZones.push({
          id: `risk-${impl.id}-no-auth`,
          filePath: impl.filePath,
          startLine: impl.line,
          endLine: impl.endLine || impl.line,
          riskLevel: 'high',
          category: 'no-auth',
          description: `Route '${impl.name}' has no authentication check`,
          suggestion: 'Add authentication middleware or guard',
          snippet: impl.routePath,
        });
      }

      if (!hasValidation) {
        riskyZones.push({
          id: `risk-${impl.id}-no-validation`,
          filePath: impl.filePath,
          startLine: impl.line,
          endLine: impl.endLine || impl.line,
          riskLevel: 'medium',
          category: 'missing-validation',
          description: `Route '${impl.name}' has no input validation`,
          suggestion: 'Add input validation using zod, yup, or similar',
        });
      }
    }
  }

  // Find uncovered behaviors
  for (const mapping of mappings) {
    if (mapping.status === 'missing') {
      riskyZones.push({
        id: `risk-uncovered-${mapping.behavior.name}`,
        filePath: mapping.behavior.specPath,
        startLine: 1,
        endLine: 1,
        riskLevel: 'critical',
        category: 'uncovered-behavior',
        description: `ISL behavior '${mapping.behavior.name}' has no implementation`,
        suggestion: `Implement the ${mapping.behavior.name} behavior`,
        relatedBehavior: mapping.behavior.name,
      });
    }
  }

  return riskyZones;
}

/**
 * Calculate audit summary
 */
function calculateSummary(
  mappings: BehaviorMapping[],
  implementations: DetectedImplementation[],
  riskyZones: RiskyZone[]
): AuditSummary {
  const implementedBehaviors = mappings.filter(m => m.status === 'covered').length;
  const partialBehaviors = mappings.filter(m => m.status === 'partial').length;
  const missingBehaviors = mappings.filter(m => m.status === 'missing').length;

  const totalBehaviors = mappings.length;
  const coveragePercent = totalBehaviors > 0
    ? ((implementedBehaviors + partialBehaviors * 0.5) / totalBehaviors) * 100
    : 100;

  // Count implementations without matching behavior
  const mappedImplIds = new Set(
    mappings.flatMap(m => m.implementations.map(i => i.id))
  );
  const unmappedImplementations = implementations.filter(i => !mappedImplIds.has(i.id)).length;

  // Risk breakdown
  const riskBreakdown: Record<RiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const zone of riskyZones) {
    riskBreakdown[zone.riskLevel]++;
  }

  return {
    totalBehaviors,
    implementedBehaviors,
    partialBehaviors,
    missingBehaviors,
    coveragePercent: Math.round(coveragePercent * 10) / 10,
    totalImplementations: implementations.length,
    unmappedImplementations,
    riskyZonesCount: riskyZones.length,
    riskBreakdown,
  };
}

/**
 * Format audit report as JSON suitable for Studio display
 */
export function formatAuditReportForStudio(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Get a text summary of the audit report
 */
export function getAuditSummaryText(report: AuditReport): string {
  const { summary } = report;
  const lines: string[] = [
    '=== ISL Audit Report ===',
    '',
    `Coverage: ${summary.coveragePercent}%`,
    '',
    'Behaviors:',
    `  Implemented: ${summary.implementedBehaviors}`,
    `  Partial:     ${summary.partialBehaviors}`,
    `  Missing:     ${summary.missingBehaviors}`,
    `  Total:       ${summary.totalBehaviors}`,
    '',
    'Implementations:',
    `  Detected:    ${summary.totalImplementations}`,
    `  Unmapped:    ${summary.unmappedImplementations}`,
    '',
    'Risk Zones:',
    `  Critical:    ${summary.riskBreakdown.critical}`,
    `  High:        ${summary.riskBreakdown.high}`,
    `  Medium:      ${summary.riskBreakdown.medium}`,
    `  Low:         ${summary.riskBreakdown.low}`,
    '',
    `Duration: ${report.durationMs}ms`,
    `Files Scanned: ${report.metadata.filesScanned}`,
  ];

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join('\n');
}
