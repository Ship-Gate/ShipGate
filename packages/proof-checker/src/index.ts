export { verifyProofBundle } from './checker.js';
export type { VerifyOptions } from './checker.js';

export { computeHash, computeHmac, canonicalize } from './hash.js';

export { validateSchema } from './checks/schema.js';
export { verifyBundleId } from './checks/bundle-id.js';
export { verifyEvidenceCompleteness, verifyEvidenceIntegrity } from './checks/evidence.js';
export { verifyVerdictConsistency } from './checks/verdict.js';
export { verifySignature } from './checks/signature.js';
export { verifyTimestamp } from './checks/timestamp.js';
export { verifyMethodRequirements } from './checks/method-requirements.js';
export { verifyChain } from './checks/chain.js';

export type {
  ProofManifest,
  Claim,
  ClaimStatus,
  ProofMethod,
  EvidenceRef,
  VerificationResult,
  Verdict,
  CheckResult,
} from './types.js';
