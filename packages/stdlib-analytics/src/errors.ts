/**
 * Analytics error types
 */

export class AnalyticsError extends Error {
  readonly code: string;
  readonly retriable: boolean;

  constructor(code: string, message: string, retriable = false) {
    super(message);
    this.name = 'AnalyticsError';
    this.code = code;
    this.retriable = retriable;
  }
}

export class InvalidEventNameError extends AnalyticsError {
  constructor(name: string) {
    super('INVALID_EVENT_NAME', `Invalid event name: "${name}". Must match /^[A-Za-z][A-Za-z0-9_.]*$/ and be ≤128 chars.`);
  }
}

export class MissingIdentityError extends AnalyticsError {
  constructor() {
    super('MISSING_IDENTITY', 'Either userId or anonymousId must be provided.');
  }
}

export class QueueFullError extends AnalyticsError {
  constructor(maxSize: number) {
    super('QUEUE_FULL', `Event queue is full (max ${maxSize}). Apply backpressure or flush.`, true);
  }
}

export class DuplicateEventError extends AnalyticsError {
  constructor(messageId: string) {
    super('DUPLICATE_EVENT', `Duplicate event with messageId "${messageId}".`);
  }
}

export class PipelineBackpressureError extends AnalyticsError {
  constructor(bufferSize: number) {
    super('PIPELINE_BACKPRESSURE', `Pipeline buffer full (${bufferSize}). Oldest events dropped.`, true);
  }
}

export class SinkError extends AnalyticsError {
  constructor(sinkName: string, cause?: string) {
    super('SINK_ERROR', `Sink "${sinkName}" failed${cause ? ': ' + cause : ''}.`, true);
  }
}

export class MetricError extends AnalyticsError {
  constructor(message: string) {
    super('METRIC_ERROR', message);
  }
}

export class FunnelError extends AnalyticsError {
  constructor(message: string) {
    super('FUNNEL_ERROR', message);
  }
}
