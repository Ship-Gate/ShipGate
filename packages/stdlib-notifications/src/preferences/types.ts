/**
 * Preferences system types
 */

import { 
  Channel, 
  RecipientId, 
  DayOfWeek, 
  QuietHours, 
  ChannelPreference, 
  DigestFrequency,
  Timestamp
} from '../types';

// Re-export types
export { Channel, DigestFrequency };

export interface RecipientPreferences {
  recipientId: RecipientId;
  
  // Global preferences
  enabled: boolean;
  quietHours?: QuietHours;
  timezone?: string;
  locale?: string;
  
  // Channel preferences
  channelPreferences: Map<Channel, ChannelPreference>;
  
  // Category preferences (opt-in/out per category)
  categoryPreferences: Map<string, boolean>;
  
  // Unsubscribed categories
  unsubscribedCategories: string[];
  
  // Frequency limits
  digestEnabled: boolean;
  digestFrequency?: DigestFrequency;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePreferencesInput {
  recipientId: RecipientId;
  enabled?: boolean;
  quietHours?: QuietHours;
  timezone?: string;
  locale?: string;
  channelPreferences?: Record<string, Omit<ChannelPreference, 'enabled'> & { enabled?: boolean }>;
  categoryPreferences?: Record<string, boolean>;
  unsubscribedCategories?: string[];
  digestEnabled?: boolean;
  digestFrequency?: DigestFrequency;
}

export interface UpdatePreferencesInput {
  enabled?: boolean;
  quietHours?: QuietHours;
  timezone?: string;
  locale?: string;
  channelPreferences?: Record<string, Partial<ChannelPreference>>;
  categoryPreferences?: Record<string, boolean>;
  unsubscribedCategories?: string[]; // Replace entire list
  addUnsubscribedCategories?: string[]; // Add to list
  removeUnsubscribedCategories?: string[]; // Remove from list
  digestEnabled?: boolean;
  digestFrequency?: DigestFrequency;
}

export interface PreferencesStore {
  create(input: CreatePreferencesInput): Promise<RecipientPreferences>;
  get(recipientId: RecipientId): Promise<RecipientPreferences | null>;
  update(recipientId: RecipientId, updates: UpdatePreferencesInput): Promise<RecipientPreferences>;
  delete(recipientId: RecipientId): Promise<void>;
  list(filter?: { enabled?: boolean; locale?: string }): Promise<RecipientPreferences[]>;
}

export interface PreferencesManager {
  getPreferences(recipientId: RecipientId): Promise<RecipientPreferences>;
  updatePreferences(recipientId: RecipientId, updates: UpdatePreferencesInput): Promise<RecipientPreferences>;
  enableChannel(recipientId: RecipientId, channel: Channel, address?: string): Promise<void>;
  disableChannel(recipientId: RecipientId, channel: Channel): Promise<void>;
  subscribeToCategory(recipientId: RecipientId, category: string): Promise<void>;
  unsubscribeFromCategory(recipientId: RecipientId, category: string): Promise<void>;
  setQuietHours(recipientId: RecipientId, quietHours: QuietHours): Promise<void>;
  disableQuietHours(recipientId: RecipientId): Promise<void>;
  setTimezone(recipientId: RecipientId, timezone: string): Promise<void>;
  setLocale(recipientId: RecipientId, locale: string): Promise<void>;
  enableDigest(recipientId: RecipientId, frequency?: DigestFrequency): Promise<void>;
  disableDigest(recipientId: RecipientId): Promise<void>;
  getSubscribedCategories(recipientId: RecipientId): Promise<string[]>;
  isChannelEnabled(recipientId: RecipientId, channel: Channel): Promise<boolean>;
  isCategoryEnabled(recipientId: RecipientId, category: string): Promise<boolean>;
}
