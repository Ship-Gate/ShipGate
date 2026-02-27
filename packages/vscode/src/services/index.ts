/**
 * ISL VSCode Extension - Services
 * 
 * Service layer for the Generate & Build workflow.
 */

export { SpecStorageService } from './SpecStorageService';
export type { SpecMetadata, StoredSpec, SpecStorageOptions } from './SpecStorageService';

export { EvidenceStorageService } from './EvidenceStorageService';
export type {
  EvidenceReport,
  EvidenceStorageOptions,
  EvidenceQuery,
  VerificationResult,
  TrustScore,
  BuildResult,
} from './EvidenceStorageService';

export { BuildOrchestratorService } from './BuildOrchestratorService';
export type {
  BuildContext,
  BuildOrchestratorOptions,
  BuildRunResult,
  McpClientAbstraction,
  McpToolResponse,
} from './BuildOrchestratorService';
