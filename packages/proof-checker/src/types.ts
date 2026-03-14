export type ProofMethod =
  | 'smt-proof'
  | 'pbt-exhaustive'
  | 'static-analysis'
  | 'runtime-trace'
  | 'heuristic';

export type ClaimStatus = 'proven' | 'violated' | 'unknown';

export interface EvidenceRef {
  type: string;
  hash: string;
  path: string;
}

export interface Claim {
  id: string;
  property: string;
  status: ClaimStatus;
  method: ProofMethod;
  evidence?: EvidenceRef[];
}

export interface ProofManifest {
  schemaVersion: string;
  bundleId: string;
  spec: {
    hash: string;
    domain: string;
  };
  verdict: string;
  claims: Claim[];
  signature?: string;
  timestamp: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

export type Verdict = 'VERIFIED' | 'REJECTED' | 'INCOMPLETE';

export interface VerificationResult {
  valid: boolean;
  verdict: Verdict;
  reasons: string[];
  checks: CheckResult[];
}
