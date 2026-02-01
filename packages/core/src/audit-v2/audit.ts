/**
 * Audit Engine V2
 *
 * Scans a workspace to detect likely implementations and generates
 * an evidence-like audit report with behavior mappings and risk flags.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
  AuditReportV2,
  AuditSummaryV2,
  AuditOptionsV2,
  DetectedCandidate,
  BehaviorMapping,
  RiskFlag,
  FrameworkHint,
  BehaviorCategory,
  RiskSeverity,
  DEFAULT_AUDIT_OPTIONS_V2,
} from './types.js';
import {
  detectRoutes,
  detectAuth,
  detectDatabase,
  detectWebhooks,
  isRouteFile,
  isAuthFile,
  isDatabaseFile,
  isWebhookFile,
} from './detectors/index.js';

const ENGINE_VERSION = '2.0.0';

/**
 * Options for running workspace audit
 */
export interface AuditWorkspaceOptionsV2 extends AuditOptionsV2 {
  /** Path to workspace root */
  workspacePath: string;
}

/**
 * Run audit on a workspace
 *
 * @param options - Audit options including workspace path
 * @returns Audit report with candidates and risk flags
 */
export async function auditWorkspaceV2(
  options: AuditWorkspaceOptionsV2
): Promise<AuditReportV2> {
  const startTime = Date.now();
  const {
    workspacePath,
    maxDepth = 15,
    ignoreDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '__pycache__',
      'venv',
      'coverage',
      '.turbo',
      '.cache',
    ],
    includeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'],
    minConfidence = 0.4,
    includeSnippets = true,
    maxSnippetLines = 10,
  } = options;

  const resolvedOptions: AuditOptionsV2 = {
    maxDepth,
    ignoreDirs,
    includeExtensions,
    minConfidence,
    includeSnippets,
    maxSnippetLines,
  };

  const warnings: string[] = [];
  const allCandidates: DetectedCandidate[] = [];
  const allRiskFlags: RiskFlag[] = [];
  const allFrameworkHints: Set<FrameworkHint> = new Set();

  // Collect source files
  const sourceFiles = await collectSourceFiles(workspacePath, {
    maxDepth,
    ignoreDirs,
    includeExtensions,
  });

  let directoriesScanned = 0;

  // Process each file
  for (const filePath of sourceFiles) {
    const fullPath = path.join(workspacePath, filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');

      // Run appropriate detectors based on file characteristics
      const detectorResults = runDetectors(content, filePath, resolvedOptions);

      allCandidates.push(...detectorResults.candidates);
      allRiskFlags.push(...detectorResults.riskFlags);
      detectorResults.frameworkHints.forEach(h => allFrameworkHints.add(h));
    } catch {
      warnings.push(`Could not read file: ${filePath}`);
    }
  }

  // Count unique directories
  const directories = new Set(sourceFiles.map(f => path.dirname(f)));
  directoriesScanned = directories.size;

  // Build behavior mappings
  const behaviorMappings = buildBehaviorMappings(allCandidates, allRiskFlags);

  // Calculate summary
  const summary = calculateSummary(
    allCandidates,
    allRiskFlags,
    sourceFiles.length,
    Array.from(allFrameworkHints)
  );

  const durationMs = Date.now() - startTime;

  return {
    version: '2.0',
    reportId: randomUUID(),
    workspacePath,
    auditedAt: new Date().toISOString(),
    durationMs,
    summary,
    behaviorMappings,
    candidates: allCandidates,
    riskFlags: allRiskFlags,
    warnings,
    metadata: {
      engineVersion: ENGINE_VERSION,
      frameworks: Array.from(allFrameworkHints),
      directoriesScanned,
    },
  };
}

/**
 * Run all detectors on file content
 */
function runDetectors(
  content: string,
  filePath: string,
  options: AuditOptionsV2
): {
  candidates: DetectedCandidate[];
  riskFlags: RiskFlag[];
  frameworkHints: FrameworkHint[];
} {
  const candidates: DetectedCandidate[] = [];
  const riskFlags: RiskFlag[] = [];
  const frameworkHints: Set<FrameworkHint> = new Set();

  // Always run route detection on likely route files
  if (isRouteFile(filePath) || /api|route|controller|endpoint/i.test(filePath)) {
    const routeResult = detectRoutes(content, filePath, options);
    candidates.push(...routeResult.candidates);
    riskFlags.push(...routeResult.riskFlags);
    routeResult.frameworkHints.forEach(h => frameworkHints.add(h));
  }

  // Run auth detection on likely auth files or any file with auth patterns
  if (isAuthFile(filePath) || /auth|session|login|middleware|guard/i.test(filePath) || content.includes('auth')) {
    const authResult = detectAuth(content, filePath, options);
    candidates.push(...authResult.candidates);
    riskFlags.push(...authResult.riskFlags);
    authResult.frameworkHints.forEach(h => frameworkHints.add(h));
  }

  // Run database detection on likely db files or files with db patterns
  if (isDatabaseFile(filePath) || /repository|service|model|db|prisma|drizzle/i.test(filePath)) {
    const dbResult = detectDatabase(content, filePath, options);
    candidates.push(...dbResult.candidates);
    riskFlags.push(...dbResult.riskFlags);
    dbResult.frameworkHints.forEach(h => frameworkHints.add(h));
  }

  // Run webhook detection on likely webhook files
  if (isWebhookFile(filePath) || /webhook|hook|callback/i.test(filePath)) {
    const webhookResult = detectWebhooks(content, filePath, options);
    candidates.push(...webhookResult.candidates);
    riskFlags.push(...webhookResult.riskFlags);
    webhookResult.frameworkHints.forEach(h => frameworkHints.add(h));
  }

  return {
    candidates,
    riskFlags,
    frameworkHints: Array.from(frameworkHints),
  };
}

/**
 * Collect source files from workspace
 */
async function collectSourceFiles(
  workspacePath: string,
  options: {
    maxDepth: number;
    ignoreDirs: string[];
    includeExtensions: string[];
  }
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
          const ext = path.extname(entry.name);
          if (options.includeExtensions.includes(ext)) {
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
 * Build behavior mappings from candidates and risks
 */
function buildBehaviorMappings(
  candidates: DetectedCandidate[],
  riskFlags: RiskFlag[]
): BehaviorMapping[] {
  const mappings: BehaviorMapping[] = [];

  // Group candidates by category
  const candidatesByCategory = new Map<BehaviorCategory, DetectedCandidate[]>();

  for (const candidate of candidates) {
    const existing = candidatesByCategory.get(candidate.category) || [];
    existing.push(candidate);
    candidatesByCategory.set(candidate.category, existing);
  }

  // Create mapping for each category
  for (const [category, categoryCandidates] of candidatesByCategory) {
    // Get related risk flags
    const relatedRisks = riskFlags.filter(r =>
      r.relatedCandidates?.some(id =>
        categoryCandidates.some(c => c.id === id)
      )
    );

    // Group by behavior name (route path, function name, etc.)
    const byBehavior = new Map<string, DetectedCandidate[]>();

    for (const candidate of categoryCandidates) {
      const behaviorKey =
        candidate.routePath || candidate.functionName || candidate.name;
      const existing = byBehavior.get(behaviorKey) || [];
      existing.push(candidate);
      byBehavior.set(behaviorKey, existing);
    }

    for (const [behaviorName, behaviorCandidates] of byBehavior) {
      const behaviorRisks = relatedRisks.filter(r =>
        r.relatedCandidates?.some(id =>
          behaviorCandidates.some(c => c.id === id)
        )
      );

      const notes: string[] = [];
      if (behaviorCandidates.length > 1) {
        notes.push(`Found ${behaviorCandidates.length} related implementations`);
      }
      if (behaviorRisks.length > 0) {
        notes.push(`${behaviorRisks.length} risk flag(s) identified`);
      }

      mappings.push({
        behaviorName,
        category,
        candidates: behaviorCandidates,
        riskFlags: behaviorRisks,
        status: behaviorCandidates.length > 0 ? 'found' : 'missing',
        notes,
      });
    }
  }

  return mappings;
}

/**
 * Calculate audit summary
 */
function calculateSummary(
  candidates: DetectedCandidate[],
  riskFlags: RiskFlag[],
  filesScanned: number,
  frameworks: FrameworkHint[]
): AuditSummaryV2 {
  // Count by category
  const candidatesByCategory: Record<BehaviorCategory, number> = {
    route: 0,
    handler: 0,
    auth: 0,
    database: 0,
    webhook: 0,
    middleware: 0,
    service: 0,
    unknown: 0,
  };

  for (const candidate of candidates) {
    candidatesByCategory[candidate.category]++;
  }

  // Count by severity
  const risksBySeverity: Record<RiskSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
  };

  for (const risk of riskFlags) {
    risksBySeverity[risk.severity]++;
  }

  // Calculate health score (100 - weighted risk penalty)
  const riskPenalty =
    risksBySeverity.critical * 25 +
    risksBySeverity.error * 10 +
    risksBySeverity.warning * 3 +
    risksBySeverity.info * 1;

  const healthScore = Math.max(0, Math.min(100, 100 - riskPenalty));

  return {
    totalCandidates: candidates.length,
    candidatesByCategory,
    totalRiskFlags: riskFlags.length,
    risksBySeverity,
    filesScanned,
    detectedFrameworks: frameworks.filter(f => f !== 'unknown'),
    healthScore,
  };
}

/**
 * Format audit report as JSON string
 */
export function formatAuditReportV2(report: AuditReportV2): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Get a text summary of the audit report
 */
export function getAuditSummaryTextV2(report: AuditReportV2): string {
  const { summary } = report;
  const lines: string[] = [
    '╔══════════════════════════════════════════╗',
    '║         ISL AUDIT REPORT V2              ║',
    '╚══════════════════════════════════════════╝',
    '',
    `Health Score: ${summary.healthScore}/100`,
    '',
    '── Detected Candidates ──────────────────────',
    `  Routes:     ${summary.candidatesByCategory.route}`,
    `  Auth:       ${summary.candidatesByCategory.auth}`,
    `  Database:   ${summary.candidatesByCategory.database}`,
    `  Webhooks:   ${summary.candidatesByCategory.webhook}`,
    `  Handlers:   ${summary.candidatesByCategory.handler}`,
    `  Services:   ${summary.candidatesByCategory.service}`,
    `  Total:      ${summary.totalCandidates}`,
    '',
    '── Risk Flags ───────────────────────────────',
    `  Critical:   ${summary.risksBySeverity.critical}`,
    `  Error:      ${summary.risksBySeverity.error}`,
    `  Warning:    ${summary.risksBySeverity.warning}`,
    `  Info:       ${summary.risksBySeverity.info}`,
    `  Total:      ${summary.totalRiskFlags}`,
    '',
    '── Metadata ─────────────────────────────────',
    `  Files Scanned:  ${summary.filesScanned}`,
    `  Frameworks:     ${summary.detectedFrameworks.join(', ') || 'none detected'}`,
    `  Duration:       ${report.durationMs}ms`,
    '',
  ];

  if (report.warnings.length > 0) {
    lines.push('── Warnings ─────────────────────────────────');
    for (const warning of report.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
    lines.push('');
  }

  // List critical/error risks
  const criticalRisks = report.riskFlags.filter(
    r => r.severity === 'critical' || r.severity === 'error'
  );

  if (criticalRisks.length > 0) {
    lines.push('── High Priority Issues ─────────────────────');
    for (const risk of criticalRisks.slice(0, 10)) {
      lines.push(`  [${risk.severity.toUpperCase()}] ${risk.description}`);
      lines.push(`    └─ ${risk.filePath}:${risk.line}`);
    }
    if (criticalRisks.length > 10) {
      lines.push(`  ... and ${criticalRisks.length - 10} more`);
    }
  }

  return lines.join('\n');
}
