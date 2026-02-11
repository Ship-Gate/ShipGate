/**
 * Delivery system types
 */

import { NotificationId, NotificationStatus, Timestamp } from '../types';

// Re-export types
export { NotificationStatus };

export interface DeliveryEvent {
  id: string;
  notificationId: NotificationId;
  status: NotificationStatus;
  timestamp: Timestamp;
  provider?: string;
  providerMessageId?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface DeliveryStats {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
  averageDeliveryTime?: number;
}

export interface DeliveryFilter {
  notificationId?: NotificationId;
  status?: NotificationStatus;
  provider?: string;
  from?: Timestamp;
  to?: Timestamp;
  limit?: number;
  offset?: number;
}

export interface DeliveryTracker {
  trackEvent(event: DeliveryEvent): Promise<void>;
  getEvents(notificationId: NotificationId): Promise<DeliveryEvent[]>;
  getStatus(notificationId: NotificationId): Promise<NotificationStatus>;
  getStats(filter?: DeliveryFilter): Promise<DeliveryStats>;
  updateStatus(notificationId: NotificationId, status: NotificationStatus, metadata?: any): Promise<void>;
}

export interface Scheduler {
  schedule(notificationId: NotificationId, scheduledAt: Timestamp): Promise<void>;
  unschedule(notificationId: NotificationId): Promise<void>;
  getScheduled(maxCount?: number): Promise<NotificationId[]>;
  isScheduled(notificationId: NotificationId): Promise<boolean>;
}

export interface DispatchConfig {
  maxRetries?: number;
  retryDelay?: number;
  fallbackChannels?: boolean;
  respectQuietHours?: boolean;
  rateLimitPerRecipient?: {
    count: number;
    window: number; // in seconds
  };
}

export interface DispatchResult {
  notificationId: NotificationId;
  status: NotificationStatus;
  channel: string;
  messageId?: string;
  error?: string;
  retriable?: boolean;
  fallbackUsed?: boolean;
  attempts: number;
}
