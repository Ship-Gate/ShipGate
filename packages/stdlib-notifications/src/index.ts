/**
 * @packageDocumentation
 * @isl-lang/stdlib-notifications
 * 
 * ISL Standard Library - Notifications
 * Multi-channel notification system with templates, preferences, and delivery tracking.
 */

// Core types and errors
export * from './types';
export * from './errors';

// Channel implementations
export * from './channels';

// Template system
export * from './templates';

// Delivery system
export * from './delivery';

// Preferences system
export * from './preferences';

// Main notification service
export { NotificationService } from './service';
export type { NotificationServiceConfig } from './service';
