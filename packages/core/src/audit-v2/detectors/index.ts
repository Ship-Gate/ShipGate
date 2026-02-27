/**
 * Detectors Index
 *
 * Exports all detection functions for the audit engine.
 */

export { detectRoutes, isRouteFile } from './routeDetector.js';
export { detectAuth, isAuthFile } from './authDetector.js';
export { detectDatabase, isDatabaseFile } from './dbDetector.js';
export { detectWebhooks, isWebhookFile } from './webhookDetector.js';
