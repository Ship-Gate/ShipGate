/**
 * @packageDocumentation
 * @isl-lang/stdlib-realtime
 * 
 * Real-time communication library for ISL
 * Provides WebSocket, SSE, channels, presence, and protocol support
 */

// ============================================================================
// Core Types and Errors
// ============================================================================

export * from './types.js';
export * from './errors.js';

// ============================================================================
// WebSocket Module
// ============================================================================

export * from './websocket/types.js';
export * from './websocket/connection.js';
export * from './websocket/server.js';
export * from './websocket/client.js';

// ============================================================================
// SSE Module
// ============================================================================

export * from './sse/types.js';
export * from './sse/server.js';
export * from './sse/client.js';

// ============================================================================
// Channels Module
// ============================================================================

export * from './channels/types.js';
export * from './channels/channel.js';
export * from './channels/manager.js';
export * from './channels/authorization.js';

// ============================================================================
// Presence Module
// ============================================================================

export * from './presence/types.js';
export * from './presence/tracker.js';
export * from './presence/state.js';

// ============================================================================
// Protocol Module
// ============================================================================

export * from './protocol/types.js';
export * from './protocol/codec.js';
export * from './protocol/heartbeat.js';

// ============================================================================
// Default Exports
// ============================================================================

import { RealtimeServer as StdLibRealtimeServer } from '../implementations/typescript/index.js';

// Re-export the combined server from implementations
export { StdLibRealtimeServer as RealtimeServer };

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
