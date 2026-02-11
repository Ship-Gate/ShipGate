/**
 * Proof bundle ingestion — POST /api/v1/proof-bundles
 * Validates ProofBundleV1 schema, maps to report, stores raw bundle.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Queries } from '../db/queries.js';
import type { CreateReportInput, VerificationReport, ApiResponse, ApiError } from '../types.js';
import { validateBody } from '../middleware/validate.js';

const ProofBundleV1Schema = z.object({
  schemaVersion: z.literal('1.0.0'),
  bundleHash: z.string().min(1).max(64),
  spec: z.object({
    domain: z.string(),
    version: z.string(),
    specHash: z.string().optional(),
    specPath: z.string().optional(),
  }),
  verdict: z.enum(['PROVEN', 'INCOMPLETE_PROOF', 'VIOLATED', 'UNPROVEN']),
  verdictReason: z.string().optional(),
  verdicts: z.array(z.object({
    phase: z.string(),
    verdict: z.string(),
    score: z.number().optional(),
    details: z.record(z.unknown()).optional(),
    timestamp: z.string().optional(),
  })).optional(),
  claims: z.array(z.object({
    clauseId: z.string(),
    clauseType: z.string(),
    behavior: z.string().optional(),
    status: z.enum(['proven', 'not_proven', 'violated', 'unknown']),
    reason: z.string().optional(),
    source: z.object({ file: z.string(), line: z.number() }).optional(),
  })).optional(),
  createdAt: z.string(),
});

const IngestProofBundleSchema = z.object({
  proofBundle: ProofBundleV1Schema,
  repo: z.string().min(1).default('unknown'),
  branch: z.string().min(1).default('main'),
  commit: z.string().min(1).default('unknown'),
  pr: z.number().int().positive().optional(),
  triggeredBy: z.enum(['ci', 'cli', 'vscode', 'manual']).default('manual'),
});

type IngestPayload = z.infer<typeof IngestProofBundleSchema>;

function mapProofBundleToReport(payload: IngestPayload): CreateReportInput {
  const { proofBundle, repo, branch, commit, pr, triggeredBy } = payload;
  const gatePhase = proofBundle.verdicts?.find((v) => v.phase === 'gate');
  const score = gatePhase?.score ?? (proofBundle.verdict === 'VIOLATED' ? 0 : 100);
  const gateVerdict = gatePhase?.verdict;

  let verdict: 'SHIP' | 'WARN' | 'NO_SHIP' = 'SHIP';
  if (proofBundle.verdict === 'VIOLATED' || gateVerdict === 'NO_SHIP') {
    verdict = 'NO_SHIP';
  } else if (proofBundle.verdict === 'INCOMPLETE_PROOF' || gateVerdict === 'WARN') {
    verdict = 'WARN';
  }

  const violatedClaims = proofBundle.claims?.filter((c) => c.status === 'violated') ?? [];
  const filesByPath = new Map<string, { violations: string[] }>();
  for (const c of violatedClaims) {
    const path = c.source?.file ?? 'unknown';
    const existing = filesByPath.get(path) ?? { violations: [] };
    existing.violations.push(c.clauseId);
    filesByPath.set(path, existing);
  }

  const fileResults = Array.from(filesByPath.entries()).map(([path, { violations }]) => ({
    path,
    verdict: 'fail' as const,
    method: 'isl' as const,
    score: 0,
    violations,
  }));

  if (fileResults.length === 0 && violatedClaims.length > 0) {
    fileResults.push({
      path: 'unknown',
      verdict: 'fail',
      method: 'isl',
      score: 0,
      violations: violatedClaims.map((c) => c.clauseId),
    });
  }

  if (fileResults.length === 0) {
    fileResults.push({
      path: proofBundle.spec.domain,
      verdict: verdict === 'SHIP' ? 'pass' : 'fail',
      method: 'isl',
      score,
      violations: [],
    });
  }

  const total = fileResults.length;
  const specced = fileResults.filter((f) => f.verdict === 'pass').length;

  return {
    repo,
    branch,
    commit,
    pr,
    verdict,
    score,
    coverage: {
      specced,
      total,
      percentage: total > 0 ? (specced / total) * 100 : 100,
    },
    files: fileResults,
    duration: 0,
    triggeredBy: triggeredBy === 'manual' ? 'cli' : triggeredBy,
  };
}

export function proofBundlesRouter(queries: Queries): Router {
  const router = Router();

  router.post(
    '/',
    validateBody(IngestProofBundleSchema),
    (req: Request, res: Response): void => {
      try {
        const payload = req.body as IngestPayload;
        const reportInput = mapProofBundleToReport(payload);

        const report = queries.insertReportWithProofBundle(reportInput, payload.proofBundle);

        const response: ApiResponse<VerificationReport & { proofBundleHash: string }> = {
          ok: true,
          data: { ...report, proofBundleHash: payload.proofBundle.bundleHash },
        };
        res.status(201).json(response);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ingestion failed';
        const errorResponse: ApiError = { ok: false, error: message };
        res.status(400).json(errorResponse);
      }
    },
  );

  return router;
}
