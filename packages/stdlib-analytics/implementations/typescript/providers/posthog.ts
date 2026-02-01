/**
 * PostHog Analytics Provider
 * 
 * Sends events to PostHog's Capture API.
 * https://posthog.com/docs/api/capture
 */

import type {
  AnalyticsProvider,
  ProviderConfig,
  QueuedEvent,
  TrackPayload,
  IdentifyPayload,
  PagePayload,
  GroupPayload,
  AliasPayload,
} from '../types';

const DEFAULT_API_URL = 'https://app.posthog.com';

export interface PostHogConfig extends ProviderConfig {
  /** PostHog API key */
  writeKey: string;
  
  /** Self-hosted PostHog URL */
  host?: string;
}

export class PostHogProvider implements AnalyticsProvider {
  name = 'posthog';
  private config: PostHogConfig;
  private apiUrl: string;

  constructor(config: PostHogConfig) {
    this.config = config;
    this.apiUrl = config.dataPlaneUrl || config.host || DEFAULT_API_URL;
  }

  async send(events: QueuedEvent[]): Promise<void> {
    // Transform events to PostHog format
    const posthogEvents = events.map((event) => this.transformEvent(event));

    const response = await fetch(`${this.apiUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.config.writeKey,
        batch: posthogEvents,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PostHog API error: ${response.status} ${error}`);
    }
  }

  private transformEvent(event: QueuedEvent): PostHogEvent {
    switch (event.type) {
      case 'track':
        return this.transformTrack(event);
      case 'identify':
        return this.transformIdentify(event);
      case 'page':
        return this.transformPage(event);
      case 'group':
        return this.transformGroup(event);
      case 'alias':
        return this.transformAlias(event);
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }
  }

  private transformTrack(event: QueuedEvent): PostHogEvent {
    const payload = event.payload as TrackPayload;

    return {
      event: payload.event,
      distinct_id: payload.userId || payload.anonymousId || '',
      properties: {
        ...payload.properties,
        ...this.getDeviceProperties(payload),
        $lib: '@isl-lang/stdlib-analytics',
        $lib_version: '1.0.0',
      },
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformIdentify(event: QueuedEvent): PostHogEvent {
    const payload = event.payload as IdentifyPayload;

    return {
      event: '$identify',
      distinct_id: payload.userId,
      properties: {
        $anon_distinct_id: payload.anonymousId,
      },
      $set: payload.traits || {},
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformPage(event: QueuedEvent): PostHogEvent {
    const payload = event.payload as PagePayload;

    return {
      event: '$pageview',
      distinct_id: payload.userId || payload.anonymousId || '',
      properties: {
        ...payload.properties,
        $current_url: payload.context?.page?.url,
        $pathname: payload.context?.page?.path,
        $title: payload.context?.page?.title,
        $referrer: payload.context?.page?.referrer,
        ...this.getDeviceProperties(payload),
      },
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformGroup(event: QueuedEvent): PostHogEvent {
    const payload = event.payload as GroupPayload;

    return {
      event: '$groupidentify',
      distinct_id: payload.userId,
      properties: {
        $group_type: 'company',
        $group_key: payload.groupId,
        $group_set: payload.traits || {},
      },
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private transformAlias(event: QueuedEvent): PostHogEvent {
    const payload = event.payload as AliasPayload;

    return {
      event: '$create_alias',
      distinct_id: payload.userId,
      properties: {
        alias: payload.previousId,
      },
      timestamp: payload.timestamp.toISOString(),
    };
  }

  private getDeviceProperties(payload: {
    context?: {
      device?: {
        osName?: string;
        osVersion?: string;
        browser?: string;
        browserVersion?: string;
        screenWidth?: number;
        screenHeight?: number;
        type?: string;
      };
      ip?: string;
      userAgent?: string;
    };
  }): Record<string, unknown> {
    const device = payload.context?.device;
    return {
      $os: device?.osName,
      $os_version: device?.osVersion,
      $browser: device?.browser,
      $browser_version: device?.browserVersion,
      $screen_width: device?.screenWidth,
      $screen_height: device?.screenHeight,
      $device_type: device?.type,
      $ip: payload.context?.ip,
      $user_agent: payload.context?.userAgent,
    };
  }
}

interface PostHogEvent {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Create PostHog provider
 */
export function createPostHogProvider(config: PostHogConfig): PostHogProvider {
  return new PostHogProvider(config);
}
