/**
 * Preferences manager implementation
 */

import { 
  PreferencesManager, 
  PreferencesStore, 
  RecipientPreferences, 
  UpdatePreferencesInput,
  CreatePreferencesInput,
  Channel,
  QuietHours,
  DigestFrequency,
  RecipientId
} from './types';
import { RecipientNotFoundError } from '../errors';

export class DefaultPreferencesManager implements PreferencesManager {
  private store: PreferencesStore;
  private defaultPreferences: Partial<RecipientPreferences>;
  
  constructor(store: PreferencesStore, defaultPreferences?: Partial<RecipientPreferences>) {
    this.store = store;
    this.defaultPreferences = {
      enabled: true,
      locale: 'en',
      timezone: 'UTC',
      digestEnabled: true,
      digestFrequency: DigestFrequency.DAILY,
      channelPreferences: new Map([
        [Channel.EMAIL, { enabled: true }],
        [Channel.SMS, { enabled: true }],
        [Channel.PUSH, { enabled: true }],
        [Channel.IN_APP, { enabled: true }],
        [Channel.WEBHOOK, { enabled: false }],
        [Channel.SLACK, { enabled: false }],
        [Channel.TEAMS, { enabled: false }],
        [Channel.DISCORD, { enabled: false }]
      ]),
      ...defaultPreferences
    };
  }
  
  async getPreferences(recipientId: RecipientId): Promise<RecipientPreferences> {
    let preferences = await this.store.get(recipientId);
    
    if (!preferences) {
      // Create default preferences
      preferences = await this.store.create({
        recipientId,
        ...this.defaultPreferences,
        channelPreferences: this.mapToObject(this.defaultPreferences.channelPreferences!),
        categoryPreferences: {}
      } as CreatePreferencesInput);
    }
    
    return preferences;
  }
  
  async updatePreferences(recipientId: RecipientId, updates: UpdatePreferencesInput): Promise<RecipientPreferences> {
    return await this.store.update(recipientId, updates);
  }
  
  async enableChannel(recipientId: RecipientId, channel: Channel, address?: string): Promise<void> {
    await this.store.update(recipientId, {
      channelPreferences: {
        [channel]: {
          enabled: true,
          address
        }
      }
    });
  }
  
  async disableChannel(recipientId: RecipientId, channel: Channel): Promise<void> {
    await this.store.update(recipientId, {
      channelPreferences: {
        [channel]: {
          enabled: false
        }
      }
    });
  }
  
  async subscribeToCategory(recipientId: RecipientId, category: string): Promise<void> {
    const prefs = await this.getPreferences(recipientId);
    
    await this.store.update(recipientId, {
      categoryPreferences: {
        [category]: true
      },
      removeUnsubscribedCategories: [category]
    });
  }
  
  async unsubscribeFromCategory(recipientId: RecipientId, category: string): Promise<void> {
    await this.store.update(recipientId, {
      addUnsubscribedCategories: [category],
      categoryPreferences: {
        [category]: false
      }
    });
  }
  
  async setQuietHours(recipientId: RecipientId, quietHours: QuietHours): Promise<void> {
    await this.store.update(recipientId, {
      quietHours
    });
  }
  
  async disableQuietHours(recipientId: RecipientId): Promise<void> {
    await this.store.update(recipientId, {
      quietHours: {
        enabled: false,
        start: '00:00',
        end: '00:00'
      }
    });
  }
  
  async setTimezone(recipientId: RecipientId, timezone: string): Promise<void> {
    await this.store.update(recipientId, {
      timezone
    });
  }
  
  async setLocale(recipientId: RecipientId, locale: string): Promise<void> {
    await this.store.update(recipientId, {
      locale
    });
  }
  
  async enableDigest(recipientId: RecipientId, frequency?: DigestFrequency): Promise<void> {
    await this.store.update(recipientId, {
      digestEnabled: true,
      digestFrequency: frequency
    });
  }
  
  async disableDigest(recipientId: RecipientId): Promise<void> {
    await this.store.update(recipientId, {
      digestEnabled: false
    });
  }
  
  async getSubscribedCategories(recipientId: RecipientId): Promise<string[]> {
    const prefs = await this.getPreferences(recipientId);
    const subscribed: string[] = [];
    
    // Check category preferences
    for (const [category, enabled] of prefs.categoryPreferences) {
      if (enabled) {
        subscribed.push(category);
      }
    }
    
    // Filter out unsubscribed categories
    return subscribed.filter(cat => !prefs.unsubscribedCategories.includes(cat));
  }
  
  async isChannelEnabled(recipientId: RecipientId, channel: Channel): Promise<boolean> {
    const prefs = await this.getPreferences(recipientId);
    
    // Check if globally disabled
    if (!prefs.enabled) {
      return false;
    }
    
    // Check channel preference
    const channelPref = prefs.channelPreferences.get(channel);
    return channelPref?.enabled ?? false;
  }
  
  async isCategoryEnabled(recipientId: RecipientId, category: string): Promise<boolean> {
    const prefs = await this.getPreferences(recipientId);
    
    // Check if globally disabled
    if (!prefs.enabled) {
      return false;
    }
    
    // Check if category is unsubscribed
    if (prefs.unsubscribedCategories.includes(category)) {
      return false;
    }
    
    // Check category preference
    const categoryPref = prefs.categoryPreferences.get(category);
    if (categoryPref !== undefined) {
      return categoryPref;
    }
    
    // Default to enabled
    return true;
  }
  
  async getChannelAddress(recipientId: RecipientId, channel: Channel): Promise<string | undefined> {
    const prefs = await this.getPreferences(recipientId);
    const channelPref = prefs.channelPreferences.get(channel);
    return channelPref?.address;
  }
  
  async bulkUpdateCategories(recipientId: RecipientId, categories: Record<string, boolean>): Promise<void> {
    const updates: UpdatePreferencesInput = {
      categoryPreferences: categories,
      addUnsubscribedCategories: [],
      removeUnsubscribedCategories: []
    };
    
    for (const [category, enabled] of Object.entries(categories)) {
      if (!enabled) {
        updates.addUnsubscribedCategories!.push(category);
      } else {
        updates.removeUnsubscribedCategories!.push(category);
      }
    }
    
    await this.store.update(recipientId, updates);
  }
  
  async resetToDefaults(recipientId: RecipientId): Promise<void> {
    // First get existing to preserve recipient ID
    const existing = await this.store.get(recipientId);
    if (!existing) {
      throw new RecipientNotFoundError(recipientId);
    }
    
    // Create new preferences with defaults
    await this.store.update(recipientId, {
      enabled: this.defaultPreferences.enabled,
      quietHours: this.defaultPreferences.quietHours,
      timezone: this.defaultPreferences.timezone,
      locale: this.defaultPreferences.locale,
      channelPreferences: this.mapToObject(this.defaultPreferences.channelPreferences!),
      unsubscribedCategories: [],
      digestEnabled: this.defaultPreferences.digestEnabled,
      digestFrequency: this.defaultPreferences.digestFrequency
    } as UpdatePreferencesInput);
  }
  
  private mapToObject(map: Map<any, any>): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }
}
