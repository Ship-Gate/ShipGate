/**
 * Amplitude Analytics Provider
 * 
 * Sends events to Amplitude's HTTP API.
 * https://www.docs.developers.amplitude.com/analytics/apis/http-v2-api/
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

const DEFAULT_API_URL = 'https://api2.amplitude.com';

export interface AmplitudeConfig extends ProviderConfig {
  /** Amplitude API key */
  writeKey: string;
  
  /** EU data residency */
  euDataResidency?: boolean;
}

export class AmplitudeProvider implements AnalyticsProvider {
  name = 'amplitude';
  private config: AmplitudeConfig;
  private apiUrl: string;

  constructor(config: AmplitudeConfig) {
    this.config = config;
    this.apiUrl = config.dataPlaneUrl || 
      (config.euDataResidency ? 'https://api.eu.amplitude.com' : DEFAULT_API_URL);
  }

  async send(events: QueuedEvent[]): Promise<void> {
    // Transform events to Amplitude format
    const amplitudeEvents = events
      .filter((e) => e.type === 'track' || e.type === 'page')
      .map((event) => this.transformToAmplitudeEvent(event));

    // Handle identify events separately
    const identifyEvents = events
      .filter((e) => e.type === 'identify')
      .map((event) => this.transformToIdentify(event));

    // Send track events
    if (amplitudeEvents.length > 0) {
      await this.sendEvents(amplitudeEvents);
    }

    // Send identify events
    for (const identify of identifyEvents) {
      await this.sendIdentify(identify);
    }
  }

  private async sendEvents(events: AmplitudeEvent[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/2/httpapi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.config.writeKey,
        events,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Amplitude API error: ${response.status} ${error}`);
    }
  }

  private async sendIdentify(identify: AmplitudeIdentify): Promise<void> {
    const response = await fetch(`${this.apiUrl}/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        api_key: this.config.writeKey,
        identification: JSON.stringify(identify),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Amplitude Identify API error: ${response.status} ${error}`);
    }
  }

  private transformToAmplitudeEvent(event: QueuedEvent): AmplitudeEvent {
    const payload = event.payload as TrackPayload | PagePayload;
    
    let eventType: string;
    let eventProperties: Record<string, unknown> = {};

    if (event.type === 'track') {
      const trackPayload = payload as TrackPayload;
      eventType = trackPayload.event;
      eventProperties = trackPayload.properties || {};
    } else {
      const pagePayload = payload as PagePayload;
      eventType = 'Page Viewed';
      eventProperties = {
        ...pagePayload.properties,
        page_name: pagePayload.name,
        page_category: pagePayload.category,
        page_path: pagePayload.context?.page?.path,
        page_url: pagePayload.context?.page?.url,
        page_title: pagePayload.context?.page?.title,
      };
    }

    return {
      user_id: payload.userId,
      device_id: payload.anonymousId,
      event_type: eventType,
      event_properties: eventProperties,
      user_properties: {},
      time: payload.timestamp.getTime(),
      platform: payload.context?.device?.osName || 'Web',
      os_name: payload.context?.device?.osName,
      os_version: payload.context?.device?.osVersion,
      device_model: payload.context?.device?.model,
      device_manufacturer: payload.context?.device?.manufacturer,
      language: payload.context?.locale,
      ip: payload.context?.ip,
    };
  }

  private transformToIdentify(event: QueuedEvent): AmplitudeIdentify {
    const payload = event.payload as IdentifyPayload;

    return {
      user_id: payload.userId,
      device_id: payload.anonymousId,
      user_properties: {
        $set: payload.traits || {},
      },
    };
  }
}

interface AmplitudeEvent {
  user_id?: string;
  device_id?: string;
  event_type: string;
  event_properties: Record<string, unknown>;
  user_properties: Record<string, unknown>;
  time: number;
  platform?: string;
  os_name?: string;
  os_version?: string;
  device_model?: string;
  device_manufacturer?: string;
  language?: string;
  ip?: string;
}

interface AmplitudeIdentify {
  user_id?: string;
  device_id?: string;
  user_properties: {
    $set: Record<string, unknown>;
  };
}

/**
 * Create Amplitude provider
 */
export function createAmplitudeProvider(config: AmplitudeConfig): AmplitudeProvider {
  return new AmplitudeProvider(config);
}
