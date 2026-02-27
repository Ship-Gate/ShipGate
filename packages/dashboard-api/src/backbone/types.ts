/**
 * Backbone types — Zod schemas + TypeScript interfaces for
 * orgs / projects / runs / artifacts / verdicts.
 */

import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────

export const RunTriggerSchema = z.enum(['ci', 'cli', 'manual']);
export type RunTrigger = z.infer<typeof RunTriggerSchema>;

export const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const ArtifactKindSchema = z.enum([
  'proof_bundle',
  'isl_spec',
  'coverage_report',
  'log',
  'other',
]);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export const VerdictValueSchema = z.enum(['SHIP', 'WARN', 'NO_SHIP']);
export type VerdictValue = z.infer<typeof VerdictValueSchema>;

// ── Entity interfaces ──────────────────────────────────────────────────

export interface Org {
  id: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  repoUrl: string | null;
  createdAt: string;
}

export interface Run {
  id: string;
  projectId: string;
  commitSha: string | null;
  branch: string | null;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  meta: Record<string, unknown> | null;
}

export interface Artifact {
  id: string;
  runId: string;
  kind: ArtifactKind;
  path: string;
  sha256: string | null;
  sizeBytes: number | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface Verdict {
  id: string;
  runId: string;
  verdict: VerdictValue;
  score: number;
  reason: string | null;
  ruleIds: string[];
  createdAt: string;
}

// ── Input schemas (request bodies) ─────────────────────────────────────

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(128),
});
export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;

export const CreateProjectSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(256),
  repoUrl: z.string().url().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const ArtifactRefSchema = z.object({
  kind: ArtifactKindSchema,
  path: z.string().min(1),
  sha256: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  meta: z.record(z.unknown()).optional(),
});
export type ArtifactRefInput = z.infer<typeof ArtifactRefSchema>;

export const SubmitRunSchema = z.object({
  projectId: z.string().uuid(),
  commitSha: z.string().optional(),
  branch: z.string().optional(),
  trigger: RunTriggerSchema,
  artifacts: z.array(ArtifactRefSchema).optional().default([]),
  verdict: z
    .object({
      verdict: VerdictValueSchema,
      score: z.number().min(0).max(100),
      reason: z.string().optional(),
      ruleIds: z.array(z.string()).optional().default([]),
    })
    .optional(),
  meta: z.record(z.unknown()).optional(),
});
export type SubmitRunInput = z.infer<typeof SubmitRunSchema>;

export const ListRunsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: RunStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;

// ── Rich response types ────────────────────────────────────────────────

export interface RunWithDetails extends Run {
  artifacts: Artifact[];
  verdict: Verdict | null;
}
