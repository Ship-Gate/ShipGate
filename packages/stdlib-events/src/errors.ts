// ============================================================================
// Error types for stdlib-events
// ============================================================================

export enum EventErrorCode {
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  STREAM_DELETED = 'STREAM_DELETED',
  INVALID_EVENT = 'INVALID_EVENT',
  HANDLER_ERROR = 'HANDLER_ERROR',
  MIDDLEWARE_ERROR = 'MIDDLEWARE_ERROR',
  SNAPSHOT_NOT_FOUND = 'SNAPSHOT_NOT_FOUND',
  AGGREGATE_ERROR = 'AGGREGATE_ERROR',
  PROJECTION_ERROR = 'PROJECTION_ERROR',
}

export class EventError extends Error {
  constructor(
    public readonly code: EventErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EventError';
  }
}

export function concurrencyConflict(
  streamId: string,
  expected: number,
  actual: number,
): EventError {
  return new EventError(
    EventErrorCode.CONCURRENCY_CONFLICT,
    `Concurrency conflict on stream "${streamId}": expected version ${expected}, actual ${actual}`,
    { streamId, expected, actual },
  );
}

export function streamNotFound(streamId: string): EventError {
  return new EventError(
    EventErrorCode.STREAM_NOT_FOUND,
    `Stream "${streamId}" not found`,
    { streamId },
  );
}
