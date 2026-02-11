/**
 * @packageDocumentation
 * @isl-lang/stdlib-billing
 */

/**
 * stdlib-billing — Billing, subscriptions, invoices, metering, and gateway adapters.
 * Money uses bigint for precise, float-free calculations.
 */

// Core types and errors
export * from './types.js';
export * from './errors.js';
export * from './money.js';

// Subscription
export * from './subscription/types.js';
export * from './subscription/plan.js';
export * from './subscription/lifecycle.js';
export * from './subscription/manager.js';

// Invoice
export * from './invoice/types.js';
export * from './invoice/numbering.js';
export * from './invoice/template.js';
export * from './invoice/generator.js';

// Gateway
export * from './gateway/types.js';
export * from './gateway/adapter.js';
export * from './gateway/stripe.js';
export * from './gateway/mock.js';

// Metering
export * from './metering/types.js';
export * from './metering/meter.js';
export * from './metering/aggregator.js';
