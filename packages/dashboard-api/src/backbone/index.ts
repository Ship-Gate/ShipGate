/**
 * Backbone module — dashboard API minimal backbone for at-scale Shipgate usage.
 *
 * Hierarchy: orgs → projects → runs → artifacts + verdicts
 */

export { BACKBONE_SCHEMA_SQL, BACKBONE_SCHEMA_VERSION } from './schema.js';

export {
  createBackboneQueries,
  type BackboneQueries,
} from './queries.js';

export { backboneRouter } from './routes.js';

export type {
  Org,
  Project,
  Run,
  Artifact,
  Verdict,
  RunWithDetails,
  RunTrigger,
  RunStatus,
  ArtifactKind,
  VerdictValue,
  CreateOrgInput,
  CreateProjectInput,
  SubmitRunInput,
  ListRunsQuery,
  ArtifactRefInput,
} from './types.js';

export {
  CreateOrgSchema,
  CreateProjectSchema,
  SubmitRunSchema,
  ListRunsQuerySchema,
  RunTriggerSchema,
  RunStatusSchema,
  ArtifactKindSchema,
  VerdictValueSchema,
  ArtifactRefSchema,
} from './types.js';
