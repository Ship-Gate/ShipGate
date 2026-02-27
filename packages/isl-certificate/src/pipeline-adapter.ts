/**
 * Pipeline Adapter - Build CertificateInput from pipeline result
 *
 * Allows the core pipeline to generate certificates without tight coupling.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CertificateInput, CertificateVerdict, PipelineStage } from './types.js';
import type { PipelineResult } from './pipeline-types.js';

/** Overrides for certificate generation when pipeline lacks full context */
export interface CertificateOverrides {
  prompt?: string;
  specPath?: string;
  specContent?: string;
  model?: { provider: string; model: string; tokensUsed: number };
}

/** Map recommendation to verdict */
function recommendationToVerdict(
  recommendation: 'ship' | 'review' | 'block'
): CertificateVerdict {
  switch (recommendation) {
    case 'ship':
      return 'SHIP';
    case 'review':
      return 'REVIEW';
    case 'block':
    default:
      return 'NO_SHIP';
  }
}

/** Build pipeline stages from step results */
function buildStages(result: PipelineResult): PipelineStage[] {
  const stages: PipelineStage[] = [];
  const steps = result.steps as Record<string, { durationMs?: number; success?: boolean } | undefined>;
  for (const [name, step] of Object.entries(steps)) {
    if (step) {
      stages.push({
        name,
        duration: step.durationMs ?? 0,
        status: step.success ? 'success' : 'failed',
      });
    }
  }
  return stages;
}

/**
 * Build CertificateInput from pipeline result
 *
 * Use when integrating certificate generation into pipeline runs.
 */
export async function buildCertificateInputFromPipeline(
  result: PipelineResult,
  workspacePath: string,
  overrides: CertificateOverrides = {}
): Promise<CertificateInput | null> {
  const { report, steps, totalDurationMs } = result;

  // Need generated files - if none, skip certificate
  const generatedPaths = (steps.generate as { data?: { filesGenerated?: string[] } } | undefined)?.data?.filesGenerated;
  if (!generatedPaths || generatedPaths.length === 0) {
    return null;
  }

  // Resolve spec content
  let specContent = overrides.specContent;
  if (!specContent && overrides.specPath) {
    try {
      specContent = await readFile(join(workspacePath, overrides.specPath), 'utf-8');
    } catch {
      specContent = JSON.stringify(report.specFingerprint);
    }
  }
  if (!specContent) {
    specContent = report.specFingerprint;
  }

  const prompt = overrides.prompt ?? (report as { prompt?: string }).prompt ?? '';
  const scoreSummary = report.scoreSummary;
  const verdict = recommendationToVerdict(scoreSummary.recommendation);

  const testsRun = scoreSummary.totalClauses;
  const testsPassed = scoreSummary.passCount;
  const evidenceCount = (report.clauseResults?.length ?? 0) + (report.artifacts?.length ?? 0);

  // Map security scan to certificate securityChecks
  const securityScan = report.securityScan as {
    checks?: Array<{ check: string; passed: boolean; findingCount?: number }>;
  } | undefined;
  const securityChecks = securityScan?.checks?.map((c) => ({
    check: c.check,
    passed: c.passed,
    details: c.passed
      ? 'No critical/high findings'
      : `${c.findingCount ?? 0} finding(s)`,
  })) ?? [];

  return {
    prompt,
    islSpec: {
      content: specContent,
      version: (report as { specVersion?: string }).specVersion ?? '1.0',
      constructCount: report.clauseResults?.length ?? 0,
    },
    generatedFiles: generatedPaths.map((path) => ({
      path,
      tier: 1 as const,
      specCoverage: scoreSummary.passRate,
    })),
    verification: {
      verdict,
      trustScore: scoreSummary.overallScore,
      evidenceCount,
      testsRun,
      testsPassed,
      securityChecks,
    },
    model: overrides.model ?? {
      provider: 'unknown',
      model: 'unknown',
      tokensUsed: 0,
    },
    pipeline: {
      duration: totalDurationMs,
      stages: buildStages(result),
    },
  };
}
