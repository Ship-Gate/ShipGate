// ============================================================================
// ISL Error to gRPC Status Code Mapping
//
// Maps ISL error declarations to appropriate gRPC status codes based on
// error name patterns and semantic analysis.
// ============================================================================

import type { ErrorSpec } from './types';
import { toScreamingSnakeCase } from './utils';

// ==========================================================================
// gRPC STATUS CODES
// ==========================================================================

/**
 * gRPC status codes as defined in the gRPC specification.
 * @see https://grpc.io/docs/guides/status-codes/
 */
export enum GrpcStatusCode {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16,
}

/**
 * Human-readable gRPC status code names
 */
export const GRPC_STATUS_NAMES: Record<GrpcStatusCode, string> = {
  [GrpcStatusCode.OK]: 'OK',
  [GrpcStatusCode.CANCELLED]: 'CANCELLED',
  [GrpcStatusCode.UNKNOWN]: 'UNKNOWN',
  [GrpcStatusCode.INVALID_ARGUMENT]: 'INVALID_ARGUMENT',
  [GrpcStatusCode.DEADLINE_EXCEEDED]: 'DEADLINE_EXCEEDED',
  [GrpcStatusCode.NOT_FOUND]: 'NOT_FOUND',
  [GrpcStatusCode.ALREADY_EXISTS]: 'ALREADY_EXISTS',
  [GrpcStatusCode.PERMISSION_DENIED]: 'PERMISSION_DENIED',
  [GrpcStatusCode.RESOURCE_EXHAUSTED]: 'RESOURCE_EXHAUSTED',
  [GrpcStatusCode.FAILED_PRECONDITION]: 'FAILED_PRECONDITION',
  [GrpcStatusCode.ABORTED]: 'ABORTED',
  [GrpcStatusCode.OUT_OF_RANGE]: 'OUT_OF_RANGE',
  [GrpcStatusCode.UNIMPLEMENTED]: 'UNIMPLEMENTED',
  [GrpcStatusCode.INTERNAL]: 'INTERNAL',
  [GrpcStatusCode.UNAVAILABLE]: 'UNAVAILABLE',
  [GrpcStatusCode.DATA_LOSS]: 'DATA_LOSS',
  [GrpcStatusCode.UNAUTHENTICATED]: 'UNAUTHENTICATED',
};

// ==========================================================================
// ERROR MAPPING
// ==========================================================================

/**
 * Mapped error with gRPC status code and metadata
 */
export interface MappedError {
  /** Original ISL error name */
  islErrorName: string;
  /** Mapped gRPC status code */
  grpcCode: GrpcStatusCode;
  /** gRPC status code name */
  grpcCodeName: string;
  /** Description from ISL 'when' clause */
  description: string;
  /** Whether the error is retriable */
  retriable: boolean;
  /** Mapping rationale */
  rationale: string;
}

/**
 * Pattern-based rules for mapping ISL error names to gRPC status codes.
 * Rules are evaluated in order; first match wins.
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: GrpcStatusCode;
  rationale: string;
}> = [
  { pattern: /CREDENTIALS|UNAUTHENTICATED|AUTH_FAILED|LOGIN_FAILED|TOKEN_EXPIRED|TOKEN_INVALID/i, code: GrpcStatusCode.UNAUTHENTICATED, rationale: 'Authentication failure' },
  { pattern: /NOT_FOUND|MISSING|NO_SUCH|DOES_NOT_EXIST/i, code: GrpcStatusCode.NOT_FOUND, rationale: 'Resource not found' },
  { pattern: /ALREADY_EXISTS|DUPLICATE|EXISTS|CONFLICT/i, code: GrpcStatusCode.ALREADY_EXISTS, rationale: 'Resource already exists' },
  { pattern: /DENIED|FORBIDDEN|UNAUTHORIZED|LOCKED|SUSPENDED|BLOCKED|BANNED/i, code: GrpcStatusCode.PERMISSION_DENIED, rationale: 'Permission denied' },
  { pattern: /INVALID|VALIDATION|BAD_REQUEST|MALFORMED|MISMATCH|TOO_SHORT|TOO_LONG/i, code: GrpcStatusCode.INVALID_ARGUMENT, rationale: 'Invalid input argument' },
  { pattern: /PRECONDITION|PREREQUISITE|REQUIRED_STATE|INACTIVE|EXPIRED/i, code: GrpcStatusCode.FAILED_PRECONDITION, rationale: 'Failed precondition' },
  { pattern: /RATE_LIMIT|THROTTLE|QUOTA|TOO_MANY/i, code: GrpcStatusCode.RESOURCE_EXHAUSTED, rationale: 'Rate limit or quota exceeded' },
  { pattern: /TIMEOUT|DEADLINE|TIMED_OUT/i, code: GrpcStatusCode.DEADLINE_EXCEEDED, rationale: 'Operation timed out' },
  { pattern: /ABORT|CONCURRENT|STALE/i, code: GrpcStatusCode.ABORTED, rationale: 'Operation aborted due to conflict' },
];

/**
 * Map a single ISL error to a gRPC status code
 */
export function mapErrorToGrpcStatus(error: ErrorSpec): MappedError {
  const errorName = toScreamingSnakeCase(error.name.name);
  const description = error.when?.value ?? '';
  const retriable = error.retriable ?? false;

  for (const rule of ERROR_PATTERNS) {
    if (rule.pattern.test(errorName)) {
      return {
        islErrorName: errorName,
        grpcCode: rule.code,
        grpcCodeName: GRPC_STATUS_NAMES[rule.code],
        description,
        retriable,
        rationale: rule.rationale,
      };
    }
  }

  if (retriable) {
    return {
      islErrorName: errorName,
      grpcCode: GrpcStatusCode.UNAVAILABLE,
      grpcCodeName: GRPC_STATUS_NAMES[GrpcStatusCode.UNAVAILABLE],
      description,
      retriable,
      rationale: 'Retriable error defaults to UNAVAILABLE',
    };
  }

  return {
    islErrorName: errorName,
    grpcCode: GrpcStatusCode.INTERNAL,
    grpcCodeName: GRPC_STATUS_NAMES[GrpcStatusCode.INTERNAL],
    description,
    retriable,
    rationale: 'No pattern match; defaulting to INTERNAL',
  };
}

/**
 * Map all errors from an ISL behavior to gRPC status codes
 */
export function mapBehaviorErrors(errors: ErrorSpec[]): MappedError[] {
  return errors.map(mapErrorToGrpcStatus);
}

/**
 * Generate a proto comment block documenting the error-to-status-code mapping
 */
export function generateErrorMappingComment(errors: ErrorSpec[]): string {
  if (errors.length === 0) return '';

  const mapped = mapBehaviorErrors(errors);
  const lines: string[] = [
    '// Error-to-gRPC-Status-Code Mapping:',
  ];

  for (const m of mapped) {
    lines.push(`//   ${m.islErrorName} -> ${m.grpcCodeName} (${m.grpcCode})${m.retriable ? ' [retriable]' : ''}`);
    if (m.description) {
      lines.push(`//     when: "${m.description}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate TypeScript status code mapping constant for use in server stubs
 */
export function generateStatusCodeMap(
  behaviorName: string,
  errors: ErrorSpec[]
): string {
  const mapped = mapBehaviorErrors(errors);
  const lines: string[] = [
    `export const ${behaviorName}StatusMap: Record<string, { code: number; name: string; retriable: boolean }> = {`,
  ];

  for (const m of mapped) {
    lines.push(`  '${m.islErrorName}': { code: ${m.grpcCode}, name: '${m.grpcCodeName}', retriable: ${m.retriable} },`);
  }

  lines.push('};');
  return lines.join('\n');
}
