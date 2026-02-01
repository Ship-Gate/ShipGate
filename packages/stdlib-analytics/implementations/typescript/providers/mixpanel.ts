/**
 * Mixpanel Analytics Provider
 * 
 * Sends events to Mixpanel's Ingestion API.
 * https://developer.mixpanel.com/reference/ingestion-api
 */

import type {
  AnalyticsProvider,
  ProviderConfig,
  QueuedEvent,
  TrackPayload,
  IdentifyPayload,
  PagePayload,
  GroupPayload,
} from '../types';

const DEFAULT_API_URL = 'https://api.mixpanel.com';

export interface MixpanelConfig extends ProviderConfig {
  /** Mixpanel project token */
  writeKey: string;
  
  /** EU data residency */
  euDataResidency?: boolean;
}

export class MixpanelProvider implements AnalyticsProvider {
  name = 'mixpanel';
  private config: MixpanelConfig;
  private apiUrl: string;

  constructor(config: MixpanelConfig) {
    this.config = config;
    this.apiUrl = config.dataPlaneUrl ||
      (config.euDataResidency ? 'https://api-eu.mixpanel.com' : DEFAULT_API_URL);
  }

  async send(events: QueuedEvent[]): Promise<void> {
    // Separate track events from profile updates
    const trackEvents = events
      .filter((e) => e.type === 'track' || e.type === 'page')
      .map((e) => this.transformToTrackEvent(e));

    const profileUpdates = events
      .filter((e) => e.type === 'identify')
      .map((e) => this.transformToProfileUpdate(e));

    const groupUpdates = events
      .filter((e) => e.type === 'group')
      .map((e) => this.transformToGroupUpdate(e));

    // Send track events
    if (trackEvents.length > 0) {
      await this.sendTrack(trackEvents);
    }

    // Send profile updates
    if (profileUpdates.length > 0) {
      await this.sendEngage(profileUpdates);
    }

    // Send group updates
    if (groupUpdates.length > 0) {
      await this.sendGroups(groupUpdates);
    }
  }

  private async sendTrack(events: MixpanelEvent[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(events),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mixpanel Track API error: ${response.status} ${error}`);
    }
  }

  private async sendEngage(updates: MixpanelEngage[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/engage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mixpanel Engage API error: ${response.status} ${error}`);
    }
  }

  private async sendGroups(updates: MixpanelGroup[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mixpanel Groups API error: ${response.status} ${error}`);
    }
  }

  private transformToTrackEvent(event: QueuedEvent): MixpanelEvent {
    const payload = event.payload as TrackPayload | PagePayload;
    
    let eventName: string;
    let properties: Record<string, unknown> = {};

    if (event.type === 'track') {
      const trackPayload = payload as TrackPayload;
      eventName = trackPayload.event;
      properties = { ...trackPayload.properties };
    } else {
      const pagePayload = payload as PagePayload;
      eventName = '$mp_web_page_view';
      properties = {
        ...pagePayload.properties,
        $current_url: pagePayload.context?.page?.url,
        $referrer: pagePayload.context?.page?.referrer,
        mp_page: pagePayload.name,
        mp_page_category: pagePayload.category,
      };
    }

    return {
      event: eventName,
      properties: {
        token: this.config.writeKey,
        distinct_id: payload.userId || payload.anonymousId,
        time: Math.floor(payload.timestamp.getTime() / 1000),
        $insert_id: event.id,
        ...properties,
        // Device context
        $os: payload.context?.device?.osName,
        $browser: payload.context?.device?.browser,
        $browser_version: payload.context?.device?.browserVersion,
        $screen_width: payload.context?.device?.screenWidth,
        $screen_height: payload.context?.device?.screenHeight,
        // Campaign context
        utm_source: payload.context?.campaign?.source,
        utm_medium: payload.context?.campaign?.medium,
        utm_campaign: payload.context?.campaign?.name,
        utm_term: payload.context?.campaign?.term,
        utm_content: payload.context?.campaign?.content,
      },
    };
  }

  private transformToProfileUpdate(event: QueuedEvent): MixpanelEngage {
    const payload = event.payload as IdentifyPayload;

    return {
      $token: this.config.writeKey,
      $distinct_id: payload.userId,
      $set: payload.traits || {},
    };
  }

  private transformToGroupUpdate(event: QueuedEvent): MixpanelGroup {
    const payload = event.payload as GroupPayload;

    return {
      $token: this.config.writeKey,
      $group_key: 'company',
      $group_id: payload.groupId,
      $set: payload.traits || {},
    };
  }
}

interface MixpanelEvent {
  event: string;
  properties: Record<string, unknown>;
}

interface MixpanelEngage {
  $token: string;
  $distinct_id: string;
  $set: Record<string, unknown>;
}

interface MixpanelGroup {
  $token: string;
  $group_key: string;
  $group_id: string;
  $set: Record<string, unknown>;
}

/**
 * Create Mixpanel provider
 */
export function createMixpanelProvider(config: MixpanelConfig): MixpanelProvider {
  return new MixpanelProvider(config);
}
