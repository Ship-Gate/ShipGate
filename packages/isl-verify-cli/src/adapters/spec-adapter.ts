/**
 * Adapter: spec-inference InferredSpec → spec-implementation-verifier VerificationContext
 */

import type { InferredSpec as InferenceSpec } from '@isl-lang/spec-inference';
import type { InferredSpec, SpecRoute, SpecEntity, SpecBehavior } from '@isl-lang/spec-implementation-verifier';

export function toVerifierSpec(spec: InferenceSpec): InferredSpec {
  const routes: SpecRoute[] = (spec.endpoints ?? []).map((e) => ({
    method: e.method,
    path: e.path.startsWith('/') ? e.path : `/${e.path}`,
    requiresAuth: e.auth === 'authenticated' || e.auth === 'role',
    roles: e.role ? [e.role] : undefined,
    inputValidation: true,
    errorHandling: true,
  }));

  const entities: SpecEntity[] = (spec.entities ?? []).map((e) => ({
    name: e.name,
    fields: e.fields.map((f) => ({ name: f.name, type: f.type })),
  }));

  const behaviors: SpecBehavior[] = (spec.behaviors ?? []).map((b) => ({
    name: b.name,
    steps: b.postconditions ?? b.sideEffects,
    securityRequirements: undefined,
  }));

  return {
    routes,
    entities,
    behaviors,
    sourceFiles: undefined,
  };
}
