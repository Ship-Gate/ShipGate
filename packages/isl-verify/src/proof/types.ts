export interface ImportEvidence {
  source: string;
  line: number;
  importPath: string;
  symbols: string[];
  resolvedTo: string | null;
  symbolsVerified: boolean;
  status: 'verified' | 'unresolved_module' | 'unresolved_symbol' | 'missing_types';
}

export interface AuthEvidence {
  route: string;
  file: string;
  line: number;
  shouldBeProtected: boolean;
  protectionReason: string;
  isProtected: boolean;
  authMethod: string | null;
  authVerifiedAt: number | null;
  issues: string[];
}

export interface Finding {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export type PropertyStatus = 'PROVEN' | 'PARTIAL' | 'FAILED' | 'NOT_VERIFIED';

export type PropertyName = 
  | 'import-integrity' 
  | 'auth-coverage' 
  | 'secret-exposure' 
  | 'sql-injection' 
  | 'error-handling' 
  | 'type-safety' 
  | 'xss-prevention' 
  | 'dependency-security' 
  | 'rate-limiting' 
  | 'logging-compliance' 
  | 'data-encryption' 
  | 'session-security' 
  | 'input-validation'
  // Tier 2: Runtime behavioral properties
  | 'runtime-auth-blocking'
  | 'runtime-input-validation'
  | 'runtime-response-shape'
  | 'runtime-no-data-leak';

export interface PropertyProof {
  property: PropertyName;
  status: PropertyStatus;
  summary: string;
  evidence: ImportEvidence[] | AuthEvidence[] | SecretEvidence[] | SQLEvidence[] | ErrorHandlingEvidence[] | TypeSafetyEvidence[] | RuntimeTestEvidence[];
  findings: Finding[];
  method: 'static-ast-analysis' | 'pattern-matching' | 'entropy-analysis' | 'tsc-validation' | 'runtime-http-test';
  confidence: 'definitive' | 'high' | 'medium';
  duration_ms: number;
}

export interface ProjectContext {
  rootPath: string;
  sourceFiles: string[];
  packageJson?: Record<string, unknown>;
  gitignorePath?: string;
  tsconfigPath?: string;
}

export interface PropertyProver {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  prove(project: ProjectContext): Promise<PropertyProof>;
}

export interface SecretEvidence {
  file: string;
  line: number;
  pattern: string;
  entropy?: number;
  variableName?: string;
  context: string;
}

export interface SQLEvidence {
  file: string;
  line: number;
  orm: string | null;
  queryMethod: string;
  safetyLevel: 'safe' | 'parameterized' | 'unsafe';
  context: string;
}

export interface ErrorHandlingEvidence {
  file: string;
  line: number;
  handler: string;
  type: 'try-catch' | 'error-middleware' | 'promise-catch' | 'missing';
  hasStackLeak: boolean;
  hasMeaningfulHandler: boolean;
  context: string;
}

export interface TypeSafetyEvidence {
  file: string;
  totalFunctions: number;
  typedFunctions: number;
  anyUsages: number;
  tsIgnores: number;
  typeAssertions: number;
  tscResult: 'pass' | 'fail' | 'not-typescript';
  errors: string[];
}

export interface RuntimeTestEvidence {
  endpoint: string;
  method: string;
  testCase: string;
  expectedStatus: number;
  actualStatus: number;
  responseTime_ms: number;
  passed: boolean;
  details: string;
}

export interface FileHash {
  path: string;
  hash: string;  // SHA-256
}

export interface ProofBundle {
  version: '1.0';
  id: string;                    // UUIDv4
  timestamp: string;             // ISO 8601
  project: {
    name: string;                // from package.json
    path: string;
    commit: string | null;       // git HEAD SHA, null if not a git repo
    branch: string | null;
    framework: string;
    language: 'typescript' | 'javascript';
    fileCount: number;
    loc: number;                 // lines of code scanned
  };
  fileHashes: FileHash[];
  properties: PropertyProof[];   // all prover results
  summary: {
    proven: number;              // count of PROVEN properties
    partial: number;
    failed: number;
    notVerified: number;
    overallVerdict: 'VERIFIED' | 'PARTIAL' | 'INSUFFICIENT';
    trustScore: number;          // 0-100
    residualRisks: string[];     // explicit list of what was NOT checked
  };
  metadata: {
    toolVersion: string;
    proversRun: string[];
    duration_ms: number;
    config: Record<string, unknown>;  // sanitized config (no secrets)
  };
  signature: string;             // HMAC-SHA256
}
