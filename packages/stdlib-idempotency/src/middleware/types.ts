/**
 * Types for middleware integration
 */

export interface RequestContext {
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Request body */
  body?: string;
  /** Client identifier */
  clientId?: string;
}

export interface ResponseContext {
  /** HTTP status code */
  statusCode: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body?: string;
}

export interface IdempotencyContext {
  /** The idempotency key */
  key: string;
  /** Whether this is a replay */
  isReplay: boolean;
  /** The stored record if replay */
  record?: any;
  /** Lock token if acquired */
  lockToken?: string;
}

export interface GuardOptions {
  /** Header name for idempotency key */
  headerName?: string;
  /** Query parameter name for idempotency key */
  queryParam?: string;
  /** Sources to check for key */
  keySource?: 'header' | 'query' | 'both';
  /** Whether key is required */
  required?: boolean;
  /** Custom key generator */
  generateKey?: () => string;
  /** List of safe methods that don't need idempotency */
  safeMethods?: string[];
}

export interface MiddlewareResult {
  /** Should continue processing */
  continue: boolean;
  /** Response to send (if not continuing) */
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: string;
  };
  /** Idempotency context */
  idempotency: IdempotencyContext;
}
