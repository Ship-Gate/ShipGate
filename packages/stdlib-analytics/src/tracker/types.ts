/**
 * Tracker types
 */

export interface TrackerConfig {
  /** Max events before auto-flush */
  flushAt: number;
  /** Flush interval in ms */
  flushIntervalMs: number;
  /** Max queue size (backpressure bound) */
  maxQueueSize: number;
  /** Retry count on flush failure */
  retryCount: number;
  /** Sampling rate 0.0–1.0 (1.0 = keep all) */
  sampleRate: number;
  /** Deterministic sampling seed */
  sampleSeed: number;
  /** Enable debug logging */
  debug: boolean;
  /** Clock function (injectable for testing) */
  now: () => number;
}

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  name: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: EventContext;
  timestamp: number;
  receivedAt: number;
  messageId?: string;
}

export type EventType = 'track' | 'page' | 'screen' | 'identify' | 'group' | 'alias';

export interface EventContext {
  ip?: string;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  page?: PageContext;
  device?: DeviceContext;
  campaign?: CampaignContext;
  library?: { name: string; version: string };
  custom?: Record<string, unknown>;
}

export interface PageContext {
  path?: string;
  url?: string;
  title?: string;
  referrer?: string;
  search?: string;
}

export interface DeviceContext {
  type?: string;
  manufacturer?: string;
  model?: string;
  osName?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  userAgent?: string;
}

export interface CampaignContext {
  name?: string;
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
}

export interface TrackInput {
  event: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: EventContext;
  timestamp?: number;
  messageId?: string;
}

export interface TrackResult {
  id: string;
  sampled: boolean;
  queued: boolean;
}

export type FlushCallback = (events: AnalyticsEvent[]) => Promise<void>;
