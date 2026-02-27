/**
 * Scan command — Infer specs, verify implementation, detect hallucinations
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, join } from 'path';
import { SpecInferenceEngine, detectFramework } from '@isl-lang/spec-inference';
import { verifyImplementation } from '@isl-lang/spec-implementation-verifier';
import type { Finding as VerifierFinding } from '@isl-lang/spec-implementation-verifier';
import { runHostScan, runRealityGapScan } from '@isl-lang/firewall';
import { glob } from 'glob';
import { toVerifierSpec } from './adapters/spec-adapter.js';
import { loadConfig, getReportPath } from './config.js';
import type { ScanReport, Finding } from './types.js';

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: 'Next.js (App Router)',
  express: 'Express',
  fastify: 'Fastify',
  hono: 'Hono',
  koa: 'Koa',
  nestjs: 'NestJS',
  unknown: 'Unknown',
};

const ORM_LABELS: Record<string, string> = {
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  drizzle: 'Drizzle',
  typeorm: 'TypeORM',
  knex: 'Knex',
  unknown: 'None',
};

export interface ScanOptions {
  path?: string;
  verbose?: boolean;
  skipInference?: boolean;
  skipFirewall?: boolean;
}

export async function runScan(options: ScanOptions = {}): Promise<ScanReport> {
  const startTime = Date.now();
  const projectRoot = resolve(options.path ?? process.cwd());
  const config = await loadConfig(projectRoot);

  // 1. Discover source files
  const sourceDirs = config.sourceDirs ?? ['src', 'app', 'lib', 'pages'];
  const exclude = config.exclude ?? ['node_modules', 'dist', '.next'];
  const patterns = sourceDirs.map((d) => `${d}/**/*.{ts,tsx,js,jsx}`).filter((p) => {
    const full = join(projectRoot, p.split('/')[0]!);
    return existsSync(full);
  });

  let files: string[] = [];
  for (const pattern of patterns.length > 0 ? patterns : ['**/*.{ts,tsx,js,jsx}']) {
    const found = await glob(pattern, {
      cwd: projectRoot,
      ignore: exclude.map((e) => `**/${e}/**`),
      nodir: true,
    });
    files.push(...found.map((f) => join(projectRoot, f)));
  }
  files = [...new Set(files)];

  // 2. Detect framework and ORM
  const frameworkDetection = await detectFramework(projectRoot);
  const frameworkLabel = FRAMEWORK_LABELS[frameworkDetection.web] ?? frameworkDetection.web;
  const ormLabel = ORM_LABELS[frameworkDetection.orm] ?? frameworkDetection.orm;

  // 3. Infer specs (Prompt 1)
  const engine = new SpecInferenceEngine({
    projectRoot,
    sourceFiles: files.map((f) => relative(projectRoot, f)),
  });

  const inferenceResult = await engine.infer({ writeFile: true });

  const verifierSpec = toVerifierSpec(inferenceResult.spec);

  // 4. Build impl files map
  const implFiles = new Map<string, string>();
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      implFiles.set(relative(projectRoot, file), content);
    } catch {
      // Skip unreadable files
    }
  }

  // 5. Run verification engine (Prompt 2)
  const verifierResult = await verifyImplementation(
    {
      projectRoot,
      spec: verifierSpec,
      implFiles,
    },
    { skipHeavyChecks: files.length > 100 }
  );

  const findings: Finding[] = verifierResult.findings.map((f: VerifierFinding) => ({
    id: f.id,
    checker: f.checker,
    ruleId: f.ruleId,
    severity: f.severity,
    message: f.message,
    file: f.file,
    line: f.line,
    column: f.column,
    blocking: f.blocking,
    recommendation: f.recommendation,
    snippet: f.snippet,
    context: f.context,
  }));

  // 6. Run hallucination detector (Prompt 3) — Host + Reality-Gap
  if (!options.skipFirewall && files.length > 0) {
    const filePaths = files.map((f) => f);
    try {
      const [hostResult, realityResult] = await Promise.all([
        runHostScan(filePaths, {
          projectRoot,
          truthpackPath: config.truthpackPath ?? '.vibecheck/truthpack',
        }),
        runRealityGapScan(filePaths, {
          projectRoot,
          truthpackPath: config.truthpackPath ?? '.vibecheck/truthpack',
        }),
      ]);

      for (const r of hostResult.results) {
        for (const v of r.violations) {
          findings.push({
            id: `host-${v.rule}-${r.file}-${v.line ?? 0}`.replace(/[^a-z0-9-]/gi, ''),
            checker: 'HostScanner',
            ruleId: v.rule,
            severity: v.tier === 'hard_block' ? 'critical' : v.tier === 'soft_block' ? 'high' : 'medium',
            message: v.message,
            file: relative(projectRoot, r.file),
            line: v.line,
            blocking: v.tier === 'hard_block',
            recommendation: v.suggestion,
          });
        }
      }

      for (const r of realityResult.results) {
        for (const v of r.violations) {
          findings.push({
            id: `reality-${v.rule}-${r.file}-${v.line ?? 0}`.replace(/[^a-z0-9-]/gi, ''),
            checker: 'RealityGapScanner',
            ruleId: v.rule,
            severity: v.tier === 'hard_block' ? 'critical' : v.tier === 'soft_block' ? 'high' : 'medium',
            message: v.message,
            file: relative(projectRoot, r.file),
            line: v.line,
            blocking: v.tier === 'hard_block',
            recommendation: v.suggestion,
          });
        }
      }
    } catch {
      // Firewall may fail if truthpack missing — continue with verifier findings only
    }
  }

  // 7. Compute trust score and verdict
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  const trustScore = Math.max(
    0,
    Math.min(
      100,
      100 - criticalCount * 25 - highCount * 10 - mediumCount * 3 - lowCount
    )
  );

  const verdict: ScanReport['verdict'] =
    criticalCount > 0 ? 'NO_SHIP' : trustScore >= (config.threshold ?? 80) ? 'SHIP' : 'REVIEW';

  const report: ScanReport = {
    projectRoot,
    framework: frameworkLabel,
    orm: ormLabel,
    fileCount: files.length,
    trustScore,
    verdict,
    findings,
    summary: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return report;
}
