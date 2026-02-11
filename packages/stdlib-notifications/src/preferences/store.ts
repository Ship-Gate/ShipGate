/**
 * In-memory preferences store implementation
 */

import { 
  PreferencesStore, 
  RecipientPreferences, 
  CreatePreferencesInput, 
  UpdatePreferencesInput,
  Channel,
  ChannelPreference,
  RecipientId
} from './types';
import { RecipientNotFoundError } from '../errors';

export class InMemoryPreferencesStore implements PreferencesStore {
  private preferences: Map<RecipientId, RecipientPreferences> = new Map();
  
  async create(input: CreatePreferencesInput): Promise<RecipientPreferences> {
    if (this.preferences.has(input.recipientId)) {
      throw new Error(`Preferences already exist for recipient ${input.recipientId}`);
    }
    
    const now = new Date();
    
    // Convert channel preferences to Map
    const channelPreferences = new Map<Channel, ChannelPreference>();
    if (input.channelPreferences) {
      for (const [channel, pref] of Object.entries(input.channelPreferences)) {
        channelPreferences.set(channel as Channel, {
          enabled: pref.enabled !== false, // Default to true
          address: pref.address
        });
      }
    }
    
    // Set default channel preferences if not provided
    for (const channel of Object.values(Channel)) {
      if (!channelPreferences.has(channel)) {
        channelPreferences.set(channel, {
          enabled: true // Default all channels to enabled
        });
      }
    }
    
    // Convert category preferences to Map
    const categoryPreferences = new Map<string, boolean>();
    if (input.categoryPreferences) {
      for (const [category, enabled] of Object.entries(input.categoryPreferences)) {
        categoryPreferences.set(category, enabled);
      }
    }
    
    const preferences: RecipientPreferences = {
      recipientId: input.recipientId,
      enabled: input.enabled !== false, // Default to true
      quietHours: input.quietHours,
      timezone: input.timezone,
      locale: input.locale,
      channelPreferences,
      categoryPreferences,
      unsubscribedCategories: input.unsubscribedCategories || [],
      digestEnabled: input.digestEnabled !== false, // Default to true
      digestFrequency: input.digestFrequency,
      createdAt: now,
      updatedAt: now
    };
    
    this.preferences.set(input.recipientId, preferences);
    return preferences;
  }
  
  async get(recipientId: RecipientId): Promise<RecipientPreferences | null> {
    return this.preferences.get(recipientId) || null;
  }
  
  async update(recipientId: RecipientId, updates: UpdatePreferencesInput): Promise<RecipientPreferences> {
    const existing = this.preferences.get(recipientId);
    if (!existing) {
      throw new RecipientNotFoundError(recipientId);
    }
    
    // Create a copy to update
    const updated: RecipientPreferences = {
      ...existing,
      updatedAt: new Date()
    };
    
    // Update simple fields
    if (updates.enabled !== undefined) {
      updated.enabled = updates.enabled;
    }
    
    if (updates.quietHours !== undefined) {
      updated.quietHours = updates.quietHours;
    }
    
    if (updates.timezone !== undefined) {
      updated.timezone = updates.timezone;
    }
    
    if (updates.locale !== undefined) {
      updated.locale = updates.locale;
    }
    
    if (updates.digestEnabled !== undefined) {
      updated.digestEnabled = updates.digestEnabled;
    }
    
    if (updates.digestFrequency !== undefined) {
      updated.digestFrequency = updates.digestFrequency;
    }
    
    // Update unsubscribed categories
    if (updates.unsubscribedCategories !== undefined) {
      updated.unsubscribedCategories = updates.unsubscribedCategories;
    } else if (updates.addUnsubscribedCategories || updates.removeUnsubscribedCategories) {
      const current = new Set(updated.unsubscribedCategories);
      
      if (updates.addUnsubscribedCategories) {
        for (const category of updates.addUnsubscribedCategories) {
          current.add(category);
        }
      }
      
      if (updates.removeUnsubscribedCategories) {
        for (const category of updates.removeUnsubscribedCategories) {
          current.delete(category);
        }
      }
      
      updated.unsubscribedCategories = Array.from(current);
    }
    
    // Update channel preferences
    if (updates.channelPreferences) {
      for (const [channel, pref] of Object.entries(updates.channelPreferences)) {
        const existingPref = updated.channelPreferences.get(channel as Channel);
        if (existingPref) {
          updated.channelPreferences.set(channel as Channel, {
            enabled: pref.enabled !== undefined ? pref.enabled : existingPref.enabled,
            address: pref.address !== undefined ? pref.address : existingPref.address
          });
        }
      }
    }
    
    // Update category preferences
    if (updates.categoryPreferences) {
      for (const [category, enabled] of Object.entries(updates.categoryPreferences)) {
        updated.categoryPreferences.set(category, enabled);
      }
    }
    
    this.preferences.set(recipientId, updated);
    return updated;
  }
  
  async delete(recipientId: RecipientId): Promise<void> {
    if (!this.preferences.has(recipientId)) {
      throw new RecipientNotFoundError(recipientId);
    }
    
    this.preferences.delete(recipientId);
  }
  
  async list(filter?: { enabled?: boolean; locale?: string }): Promise<RecipientPreferences[]> {
    let results = Array.from(this.preferences.values());
    
    if (filter) {
      if (filter.enabled !== undefined) {
        results = results.filter(p => p.enabled === filter.enabled);
      }
      
      if (filter.locale) {
        results = results.filter(p => p.locale === filter.locale);
      }
    }
    
    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  // Helper methods for testing
  clear(): void {
    this.preferences.clear();
  }
  
  size(): number {
    return this.preferences.size;
  }
  
  has(recipientId: RecipientId): boolean {
    return this.preferences.has(recipientId);
  }
}
