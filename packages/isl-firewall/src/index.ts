/**
 * ISL Firewall - Agent File Write Governance
 * 
 * Intercepts and validates AI-generated content to prevent hallucinations.
 * 
 * @module @isl-lang/firewall
 * 
 * @example
 * ```typescript
 * import { createAgentFirewall } from '@isl-lang/firewall';
 * 
 * const firewall = createAgentFirewall({
 *   mode: 'enforce',
 *   projectRoot: '/path/to/project',
 * });
 * 
 * const result = await firewall.evaluate({
 *   content: 'const api = "/api/users"',
 *   filePath: 'src/api.ts',
 * });
 * 
 * if (!result.allowed) {
 *   console.log('Blocked:', result.violations);
 * }
 * ```
 */

// Main firewall
export { AgentFirewall, createAgentFirewall } from './agent-firewall.js';

// Claim extraction
export { ClaimExtractor, createClaimExtractor, type ExtractionResult } from './claim-extractor.js';

// Evidence resolution
export { EvidenceResolver, createEvidenceResolver, type ResolverConfig } from './evidence-resolver.js';

// Policy engine
export { PolicyEngine, createPolicyEngine, getAvailablePolicies } from './policy-engine.js';

// Allowlist
export { AllowlistManager, createAllowlistManager } from './allowlist.js';

// Integrated Firewall (ShipGate truthpack + policy packs)
export { 
  IntegratedFirewall, 
  createIntegratedFirewall, 
  integratedGate,
  type IntegratedGateResult,
} from './isl-studio-integration.js';

// Scanners (Host + Reality-Gap)
export {
  runHostScan,
  runRealityGapScan,
  type HostScanResult,
  type RealityGapScanResult,
  type ScanResult,
  type ScannerOptions,
  type ScannerViolation,
} from './scanners.js';

// Types
export type {
  FirewallMode,
  ConfidenceTier,
  ClaimType,
  Claim,
  EvidenceSource,
  Evidence,
  Policy,
  PolicyViolation,
  PolicyDecision,
  QuickFix,
  FirewallResult,
  FirewallRequest,
  FirewallAllowlist,
  FirewallConfig,
} from './types.js';

export { DEFAULT_FIREWALL_CONFIG } from './types.js';
