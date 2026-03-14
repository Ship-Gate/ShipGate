/**
 * @isl-lang/traffic-verifier
 *
 * Production traffic verification against ISL specifications.
 * Samples live requests/responses, validates them against specs,
 * detects statistical anomalies, and generates compliance reports.
 *
 * @module @isl-lang/traffic-verifier
 *
 * @example
 * ```typescript
 * import {
 *   TrafficSampler,
 *   TrafficValidator,
 *   AnomalyDetector,
 *   generateReport,
 *   formatMarkdown,
 * } from '@isl-lang/traffic-verifier';
 * import { parse } from '@isl-lang/parser';
 *
 * const config: VerifierConfig = {
 *   sampleRate: 0.1,
 *   specDir: './specs',
 *   maxBufferSize: 500,
 *   flushIntervalMs: 30_000,
 *   alertThresholds: {
 *     violationRatePercent: 5,
 *     latencyP99Ms: 2000,
 *     errorRatePercent: 1,
 *   },
 * };
 *
 * const spec = parse(islSource);
 * const sampler = new TrafficSampler(config);
 * const validator = new TrafficValidator([spec]);
 * const detector = new AnomalyDetector();
 *
 * sampler.onFlush((samples) => {
 *   for (const sample of samples) {
 *     const violations = validator.validate(sample);
 *     detector.addSample(sample);
 *   }
 * });
 *
 * sampler.start();
 * app.use(sampler.createMiddleware());
 * ```
 */

// Core classes
export { TrafficSampler } from './sampler.js';
export { TrafficValidator } from './validator.js';
export { AnomalyDetector } from './anomaly-detector.js';

// Reporting
export { generateReport, formatMarkdown } from './reporter.js';

// Types
export type {
  TrafficSample,
  SpecViolation,
  ViolationType,
  ViolationSeverity,
  VerifierConfig,
  AlertThresholds,
  TrafficStats,
  TopViolation,
  Anomaly,
  AnomalyType,
  TrafficReport,
  ParsedSpec,
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from './types.js';
