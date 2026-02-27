/**
 * Error types for realtime communication
 * @packageDocumentation
 */

// ============================================================================
// Base Error Class
// ============================================================================

export class RealtimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'RealtimeError';
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RealtimeError);
    }
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

// ============================================================================
// Connection Errors
// ============================================================================

export class ConnectionError extends RealtimeError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'ConnectionError';
  }
}

export class ConnectionRefusedError extends ConnectionError {
  constructor(reason: string) {
    super('CONNECTION_REFUSED', `Connection refused: ${reason}`, { reason });
  }
}

export class ConnectionNotFoundError extends ConnectionError {
  constructor(connectionId: string) {
    super('CONNECTION_NOT_FOUND', `Connection not found: ${connectionId}`, { connectionId });
  }
}

export class ConnectionTimeoutError extends ConnectionError {
  constructor(connectionId: string) {
    super('CONNECTION_TIMEOUT', `Connection timeout: ${connectionId}`, { connectionId });
  }
}

export class ConnectionLimitExceededError extends ConnectionError {
  constructor(limit: number) {
    super('CONNECTION_LIMIT_EXCEEDED', `Connection limit exceeded: ${limit}`, { limit });
  }
}

// ============================================================================
// Authentication Errors
// ============================================================================

export class AuthenticationError extends RealtimeError {
  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super('AUTH_REQUIRED', message, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends RealtimeError {
  constructor(resource: string, action: string) {
    super('NOT_AUTHORIZED', `Not authorized to ${action} on ${resource}`, { resource, action });
    this.name = 'AuthorizationError';
  }
}

// ============================================================================
// Channel Errors
// ============================================================================

export class ChannelError extends RealtimeError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'ChannelError';
  }
}

export class ChannelNotFoundError extends ChannelError {
  constructor(channelId: string) {
    super('CHANNEL_NOT_FOUND', `Channel not found: ${channelId}`, { channelId });
  }
}

export class ChannelExistsError extends ChannelError {
  constructor(channelId: string) {
    super('CHANNEL_EXISTS', `Channel already exists: ${channelId}`, { channelId });
  }
}

export class SubscriptionLimitError extends ChannelError {
  constructor(limit: number) {
    super('MAX_SUBSCRIPTIONS', `Subscription limit exceeded: ${limit}`, { limit });
  }
}

export class NotSubscribedError extends ChannelError {
  constructor(connectionId: string, channelId: string) {
    super('NOT_SUBSCRIBED', `Connection ${connectionId} is not subscribed to channel ${channelId}`, {
      connectionId,
      channelId,
    });
  }
}

// ============================================================================
// Message Errors
// ============================================================================

export class MessageError extends RealtimeError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'MessageError';
  }
}

export class MessageTooLargeError extends MessageError {
  constructor(actualSize: number, maxSize: number) {
    super(
      'MESSAGE_TOO_LARGE',
      `Message size ${actualSize} exceeds maximum ${maxSize}`,
      { actualSize, maxSize }
    );
  }
}

export class RateLimitError extends MessageError {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', `Rate limit exceeded, retry after ${retryAfter}ms`, { retryAfter });
  }
}

export class MessageDeliveryError extends MessageError {
  constructor(messageId: string, reason: string) {
    super('MESSAGE_DELIVERY_FAILED', `Failed to deliver message ${messageId}: ${reason}`, {
      messageId,
      reason,
    });
  }
}

// ============================================================================
// Presence Errors
// ============================================================================

export class PresenceError extends RealtimeError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'PresenceError';
  }
}

export class PresenceNotFoundError extends PresenceError {
  constructor(userId: string, channelId: string) {
    super('PRESENCE_NOT_FOUND', `Presence not found for user ${userId} in channel ${channelId}`, {
      userId,
      channelId,
    });
  }
}

// ============================================================================
// Room Errors
// ============================================================================

export class RoomError extends RealtimeError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'RoomError';
  }
}

export class RoomNotFoundError extends RoomError {
  constructor(roomId: string) {
    super('ROOM_NOT_FOUND', `Room not found: ${roomId}`, { roomId });
  }
}

export class RoomExistsError extends RoomError {
  constructor(roomName: string) {
    super('ROOM_EXISTS', `Room already exists: ${roomName}`, { roomName });
  }
}

export class RoomFullError extends RoomError {
  constructor(roomId: string, capacity: number) {
    super('ROOM_FULL', `Room ${roomId} is full (capacity: ${capacity})`, { roomId, capacity });
  }
}

export class BannedError extends RoomError {
  constructor(roomId: string, userId: string) {
    super('BANNED', `User ${userId} is banned from room ${roomId}`, { roomId, userId });
  }
}

// ============================================================================
// Protocol Errors
// ============================================================================

export class ProtocolError extends RealtimeError {
  constructor(message: string, details?: Record<string, any>) {
    super('PROTOCOL_ERROR', message, details);
    this.name = 'ProtocolError';
  }
}

export class InvalidMessageFormatError extends ProtocolError {
  constructor(reason: string) {
    super(`Invalid message format: ${reason}`, { reason });
  }
}

export class UnsupportedProtocolError extends ProtocolError {
  constructor(protocol: string) {
    super(`Unsupported protocol: ${protocol}`, { protocol });
  }
}

// ============================================================================
// SSE Errors
// ============================================================================

export class SSEError extends RealtimeError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'SSEError';
  }
}

export class SSENotSupportedError extends SSEError {
  constructor() {
    super('NOT_SUPPORTED', 'Server-Sent Events not supported');
  }
}

// ============================================================================
// Error factory
// ============================================================================

export class ErrorFactory {
  static fromCode(code: string, message?: string, details?: Record<string, any>): RealtimeError {
    switch (code) {
      // Connection errors
      case 'CONNECTION_REFUSED':
        return new ConnectionRefusedError(details?.reason || message || 'Unknown reason');
      case 'CONNECTION_NOT_FOUND':
        return new ConnectionNotFoundError(details?.connectionId || 'unknown');
      case 'CONNECTION_TIMEOUT':
        return new ConnectionTimeoutError(details?.connectionId || 'unknown');
      case 'CONNECTION_LIMIT_EXCEEDED':
        return new ConnectionLimitExceededError(details?.limit || 0);

      // Authentication errors
      case 'AUTH_REQUIRED':
        return new AuthenticationError(message, details);
      case 'NOT_AUTHORIZED':
        return new AuthorizationError(details?.resource || 'unknown', details?.action || 'unknown');

      // Channel errors
      case 'CHANNEL_NOT_FOUND':
        return new ChannelNotFoundError(details?.channelId || 'unknown');
      case 'CHANNEL_EXISTS':
        return new ChannelExistsError(details?.channelId || 'unknown');
      case 'MAX_SUBSCRIPTIONS':
        return new SubscriptionLimitError(details?.limit || 0);
      case 'NOT_SUBSCRIBED':
        return new NotSubscribedError(details?.connectionId || 'unknown', details?.channelId || 'unknown');

      // Message errors
      case 'MESSAGE_TOO_LARGE':
        return new MessageTooLargeError(details?.actualSize || 0, details?.maxSize || 0);
      case 'RATE_LIMITED':
        return new RateLimitError(details?.retryAfter || 0);
      case 'MESSAGE_DELIVERY_FAILED':
        return new MessageDeliveryError(details?.messageId || 'unknown', details?.reason || 'unknown');

      // Presence errors
      case 'PRESENCE_NOT_FOUND':
        return new PresenceNotFoundError(details?.userId || 'unknown', details?.channelId || 'unknown');

      // Room errors
      case 'ROOM_NOT_FOUND':
        return new RoomNotFoundError(details?.roomId || 'unknown');
      case 'ROOM_EXISTS':
        return new RoomExistsError(details?.roomName || 'unknown');
      case 'ROOM_FULL':
        return new RoomFullError(details?.roomId || 'unknown', details?.capacity || 0);
      case 'BANNED':
        return new BannedError(details?.roomId || 'unknown', details?.userId || 'unknown');

      // Protocol errors
      case 'PROTOCOL_ERROR':
        return new ProtocolError(message || 'Protocol error', details);
      case 'INVALID_MESSAGE_FORMAT':
        return new InvalidMessageFormatError(details?.reason || 'unknown');
      case 'NOT_SUPPORTED':
        return new UnsupportedProtocolError(details?.protocol || 'unknown');

      // SSE errors
      case 'SSE_NOT_SUPPORTED':
        return new SSENotSupportedError();

      default:
        return new RealtimeError(code, message || 'Unknown error', details);
    }
  }
}

// ============================================================================
// Error utilities
// ============================================================================

export function isRealtimeError(error: any): error is RealtimeError {
  return error instanceof RealtimeError;
}

export function isConnectionError(error: any): error is ConnectionError {
  return error instanceof ConnectionError;
}

export function isChannelError(error: any): error is ChannelError {
  return error instanceof ChannelError;
}

export function isMessageError(error: any): error is MessageError {
  return error instanceof MessageError;
}

export function isPresenceError(error: any): error is PresenceError {
  return error instanceof PresenceError;
}

export function isRoomError(error: any): error is RoomError {
  return error instanceof RoomError;
}

export function isProtocolError(error: any): error is ProtocolError {
  return error instanceof ProtocolError;
}

export function isSSEError(error: any): error is SSEError {
  return error instanceof SSEError;
}
