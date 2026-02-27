/**
 * Package API Verifier Types
 */

export interface APICallEvidence {
  file: string;
  line: number;
  package: string;
  packageVersion: string;
  callChain: string;
  exists: boolean;
  verificationMethod: 'type-definitions' | 'signature-database' | 'unverifiable';
  suggestion?: string;
  deprecation?: string;
  confidence: 'definitive' | 'high' | 'medium' | 'low';
}

export interface ExtractedAPICall {
  file: string;
  line: number;
  package: string;
  callChain: string[];
  importedSymbol: string;
}

export interface PackageSignature {
  package: string;
  versionRange: string;
  methods: MethodSignature[];
  deprecated?: DeprecatedMethod[];
}

export interface MethodSignature {
  name: string;
  path: string[];
  parameters?: ParameterSignature[];
  returnType?: string;
}

export interface ParameterSignature {
  name: string;
  type: string;
  optional?: boolean;
}

export interface DeprecatedMethod {
  name: string;
  path: string[];
  deprecatedSince: string;
  replacement?: string;
  message?: string;
}

export interface APIVerificationResult {
  totalCalls: number;
  verified: number;
  hallucinated: number;
  unverifiable: number;
  evidence: APICallEvidence[];
  summary: {
    topHallucinations: string[];
    topPackages: Array<{ package: string; calls: number }>;
  };
}
