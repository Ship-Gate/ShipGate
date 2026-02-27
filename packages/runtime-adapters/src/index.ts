/**
 * Runtime Adapters for Verification
 * 
 * Provides adapters for Fastify, Express, and Fetch to capture traces
 * for temporal/coverage analysis with `shipgate verify`.
 * 
 * @module @isl-lang/runtime-adapters
 */

export { fastifyVerificationAdapter } from './fastify.js';
export type { FastifyVerificationOptions } from './fastify.js';

export { expressVerificationMiddleware } from './express.js';
export type { ExpressVerificationOptions } from './express.js';

export { createVerificationFetch } from './fetch.js';
export type { FetchVerificationOptions } from './fetch.js';

export { TraceCollector, globalCollector, getCollector } from './collector.js';
