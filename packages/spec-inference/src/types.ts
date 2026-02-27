/**
 * Core types for the Spec Inference Engine.
 * Confidence levels: high (explicit types/schemas), medium (usage patterns), low (heuristics).
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface WithConfidence {
  confidence: ConfidenceLevel;
  source?: string;
}

// ── Entity inference ────────────────────────────────────────────────────────

export interface InferredField {
  name: string;
  type: string;
  optional?: boolean;
  annotations?: string[];
  constraints?: Record<string, unknown>;
}

export interface InferredEntity extends WithConfidence {
  name: string;
  fields: InferredField[];
  relations?: { field: string; target: string; kind: 'one' | 'many' }[];
  invariants?: string[];
}

export interface InferredEnum extends WithConfidence {
  name: string;
  members: string[];
}

// ── Endpoint inference ───────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface InferredEndpoint extends WithConfidence {
  method: HttpMethod;
  path: string;
  basePath?: string;
  requestBody?: string;
  responseType?: string;
  params?: Record<string, string>;
  auth?: 'public' | 'authenticated' | 'role';
  role?: string;
  errors?: { code: string; when: string; retriable?: boolean }[];
  behaviorName?: string;
}

// ── Behavior inference ──────────────────────────────────────────────────────

export interface InferredBehavior extends WithConfidence {
  name: string;
  description?: string;
  input: Record<string, { type: string; optional?: boolean }>;
  output: {
    success: string;
    errors?: { code: string; when: string; retriable?: boolean }[];
  };
  preconditions?: string[];
  postconditions?: string[];
  sideEffects?: string[];
}

// ── Actor inference ──────────────────────────────────────────────────────────

export interface InferredActor extends WithConfidence {
  name: string;
  permissions: string[];
  roleChecks?: string[];
}

// ── Framework & ORM detection ────────────────────────────────────────────────

export type WebFramework =
  | 'nextjs'
  | 'express'
  | 'fastify'
  | 'hono'
  | 'koa'
  | 'nestjs'
  | 'unknown';

export type OrmType =
  | 'prisma'
  | 'mongoose'
  | 'drizzle'
  | 'typeorm'
  | 'knex'
  | 'unknown';

export interface FrameworkDetection {
  web: WebFramework;
  orm: OrmType;
  details: Record<string, unknown>;
}

// ── Full inferred spec ──────────────────────────────────────────────────────

export interface InferredSpec {
  domainName: string;
  entities: InferredEntity[];
  enums: InferredEnum[];
  endpoints: InferredEndpoint[];
  behaviors: InferredBehavior[];
  actors: InferredActor[];
  framework: FrameworkDetection;
}
