export type AssertionSeverity = 'critical' | 'warning';
export type AssertionSource = 'isl-spec' | 'inferred';
export type AssertionType = 'precondition' | 'postcondition' | 'invariant';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Assertion {
  expression: string;
  description: string;
  severity: AssertionSeverity;
  source: AssertionSource;
}

export interface Contract {
  id: string;
  route: string;
  method: HttpMethod;
  preconditions: Assertion[];
  postconditions: Assertion[];
  invariants: Assertion[];
}

export interface ContractViolation {
  contractId: string;
  assertionType: AssertionType;
  expression: string;
  actual: unknown;
  expected: unknown;
  timestamp: number;
  requestId: string;
  route: string;
  method: string;
  severity: AssertionSeverity;
}

export interface ViolationStats {
  total: number;
  bySeverity: Record<AssertionSeverity, number>;
  byRoute: Record<string, number>;
  byType: Record<AssertionType, number>;
}

export type ViolationCallback = (violation: ContractViolation) => void;

export interface MonitorConfig {
  enabled: boolean;
  reportEndpoint?: string;
  onViolation?: ViolationCallback;
  sampleRate: number;
  logViolations: boolean;
}

export interface IncomingRequest {
  method?: string;
  url?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  user?: unknown;
  [key: string]: unknown;
}

export interface OutgoingResponse {
  statusCode: number;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

export type NextFunction = (err?: unknown) => void;
export type RequestHandler = (req: IncomingRequest, res: OutgoingResponse, next: NextFunction) => void;
