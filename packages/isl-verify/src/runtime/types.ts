/**
 * Runtime Verification Types
 * 
 * Tier 2 behavioral verification - actual HTTP requests against running app
 */

export interface RuntimeEvidence {
  endpoint: string;
  method: string;
  testCase: string;
  request: {
    headers: Record<string, string>;
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
  };
  expectedStatus: number;
  actualStatus: number;
  responseBodyMatchesType: boolean;
  responseTime_ms: number;
  passed: boolean;
  details: string;
}

export interface RuntimeVerificationResult {
  appStarted: boolean;
  appStartTimeMs: number;
  evidence: RuntimeEvidence[];
  authTestsPassed: number;
  authTestsTotal: number;
  validationTestsPassed: number;
  validationTestsTotal: number;
  responseShapeTestsPassed: number;
  responseShapeTestsTotal: number;
  totalPassed: number;
  totalTests: number;
  errors: string[];
}

export interface AppLaunchConfig {
  /** Project directory */
  projectDir: string;
  /** Start command (auto-detected from package.json if not provided) */
  startCommand?: string;
  /** Port to listen on (auto-detected or random if not provided) */
  port?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in ms to wait for app to start */
  startTimeout?: number;
  /** Health check endpoint to poll */
  healthEndpoint?: string;
  /** Database setup mode */
  databaseMode?: 'sqlite-temp' | 'postgres-test' | 'existing';
}

export interface TestDatabaseConfig {
  type: 'sqlite' | 'postgres' | 'mysql' | 'none';
  connectionString: string;
  tempDir?: string;
  runMigrations: boolean;
  seedData?: boolean;
}

export interface EndpointSpec {
  path: string;
  method: string;
  auth: 'none' | 'required' | 'admin' | 'optional';
  requestBody?: TypeShape;
  responseBody?: TypeShape;
  params?: Record<string, TypeConstraint>;
  query?: Record<string, TypeConstraint>;
}

export interface TypeShape {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  required?: string[];
  properties?: Record<string, TypeShape>;
  items?: TypeShape;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
}

export interface TypeConstraint {
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  constraints?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: unknown[];
  };
}

export interface RuntimeVerifierOptions {
  /** Base URL for the running app (auto-detected if not provided) */
  baseUrl?: string;
  /** Timeout for each HTTP request in ms */
  requestTimeout?: number;
  /** Whether to generate and use auth tokens */
  enableAuth?: boolean;
  /** Test admin user credentials */
  adminUser?: { email: string; password: string };
  /** Test regular user credentials */
  regularUser?: { email: string; password: string };
  /** Verbose logging */
  verbose?: boolean;
}
