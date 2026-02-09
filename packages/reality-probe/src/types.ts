/**
 * Types for Reality Prober
 */

export interface RouteProbeResult {
  /** Route path (e.g., "/api/foo") */
  path: string;
  /** HTTP method */
  method: string;
  /** Whether the route exists and responds */
  exists: boolean;
  /** HTTP status code (if route exists) */
  statusCode?: number;
  /** Response latency in milliseconds */
  latencyMs?: number;
  /** Error message if probe failed */
  error?: string;
  /** Whether this is a ghost route (claimed but doesn't exist) */
  isGhost: boolean;
}

export interface EnvVarProbeResult {
  /** Environment variable name */
  name: string;
  /** Whether the variable exists */
  exists: boolean;
  /** Whether it has a non-empty value */
  hasValue: boolean;
  /** Whether the value looks like a placeholder */
  isPlaceholder: boolean;
  /** Whether this is a ghost env var (required but missing) */
  isGhost: boolean;
  /** Error message if check failed */
  error?: string;
}

export interface RealityProbeConfig {
  /** Base URL for route probing (e.g., "http://localhost:3000") */
  baseUrl?: string;
  /** Path to OpenAPI spec file (optional, alternative to route map) */
  openApiPath?: string;
  /** Path to route map JSON (from truthpack) */
  routeMapPath?: string;
  /** Path to env vars JSON (from truthpack) */
  envVarsPath?: string;
  /** Timeout per route probe in milliseconds */
  timeoutMs?: number;
  /** Concurrency for route probes */
  concurrency?: number;
  /** Custom headers for route probes */
  headers?: Record<string, string>;
  /** Auth token for authenticated routes */
  authToken?: string;
  /** Skip routes requiring authentication */
  skipAuth?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface RealityProbeResult {
  /** Route probe results */
  routes: RouteProbeResult[];
  /** Environment variable probe results */
  envVars: EnvVarProbeResult[];
  /** Summary statistics */
  summary: {
    totalRoutes: number;
    existingRoutes: number;
    ghostRoutes: number;
    totalEnvVars: number;
    existingEnvVars: number;
    ghostEnvVars: number;
  };
  /** Overall success (no ghost features detected) */
  success: boolean;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface RouteMapEntry {
  path: string;
  method: string;
  auth?: {
    required: boolean;
  };
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required?: boolean;
  }>;
}

export interface EnvVarEntry {
  name: string;
  required: boolean;
  sensitive?: boolean;
  description?: string;
}
