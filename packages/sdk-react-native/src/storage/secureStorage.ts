/**
 * Secure Storage - Wrapper around Expo SecureStore and AsyncStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface StorageOptions {
  secure?: boolean;
  expiresIn?: number; // milliseconds
}

interface StoredValue<T> {
  value: T;
  expiresAt?: number;
  createdAt: number;
}

const STORAGE_PREFIX = 'isl_';

/**
 * Secure storage wrapper with encryption for sensitive data
 */
export const SecureStorage = {
  /**
   * Store a value securely
   */
  async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const storedValue: StoredValue<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: options.expiresIn ? Date.now() + options.expiresIn : undefined,
    };
    
    const serialized = JSON.stringify(storedValue);
    
    if (options.secure) {
      await SecureStore.setItemAsync(prefixedKey, serialized);
    } else {
      await AsyncStorage.setItem(prefixedKey, serialized);
    }
  },

  /**
   * Retrieve a value
   */
  async get<T>(key: string, options: { secure?: boolean } = {}): Promise<T | null> {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    try {
      const serialized = options.secure
        ? await SecureStore.getItemAsync(prefixedKey)
        : await AsyncStorage.getItem(prefixedKey);
      
      if (!serialized) return null;
      
      const stored: StoredValue<T> = JSON.parse(serialized);
      
      // Check expiration
      if (stored.expiresAt && Date.now() > stored.expiresAt) {
        await this.remove(key, options);
        return null;
      }
      
      return stored.value;
    } catch {
      return null;
    }
  },

  /**
   * Remove a value
   */
  async remove(key: string, options: { secure?: boolean } = {}): Promise<void> {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    
    if (options.secure) {
      await SecureStore.deleteItemAsync(prefixedKey);
    } else {
      await AsyncStorage.removeItem(prefixedKey);
    }
  },

  /**
   * Check if a key exists
   */
  async has(key: string, options: { secure?: boolean } = {}): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  },

  /**
   * Clear all stored values
   */
  async clear(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const islKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));
    await AsyncStorage.multiRemove(islKeys);
  },

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .map(key => key.slice(STORAGE_PREFIX.length));
  },
};

/**
 * Token storage specifically for auth tokens
 */
export const TokenStorage = {
  KEYS: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRY: 'token_expiry',
  },

  async setTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number
  ): Promise<void> {
    await Promise.all([
      SecureStorage.set(this.KEYS.ACCESS_TOKEN, accessToken, { secure: true }),
      SecureStorage.set(this.KEYS.REFRESH_TOKEN, refreshToken, { secure: true }),
      expiresIn
        ? SecureStorage.set(this.KEYS.TOKEN_EXPIRY, Date.now() + expiresIn * 1000)
        : Promise.resolve(),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStorage.get<string>(this.KEYS.ACCESS_TOKEN, { secure: true });
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStorage.get<string>(this.KEYS.REFRESH_TOKEN, { secure: true });
  },

  async isTokenExpired(): Promise<boolean> {
    const expiry = await SecureStorage.get<number>(this.KEYS.TOKEN_EXPIRY);
    if (!expiry) return true;
    return Date.now() > expiry;
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStorage.remove(this.KEYS.ACCESS_TOKEN, { secure: true }),
      SecureStorage.remove(this.KEYS.REFRESH_TOKEN, { secure: true }),
      SecureStorage.remove(this.KEYS.TOKEN_EXPIRY),
    ]);
  },
};

/**
 * Cache storage for API responses
 */
export const CacheStorage = {
  PREFIX: 'cache_',

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await SecureStorage.set(`${this.PREFIX}${key}`, value, { expiresIn: ttlMs });
  },

  async get<T>(key: string): Promise<T | null> {
    return SecureStorage.get<T>(`${this.PREFIX}${key}`);
  },

  async invalidate(key: string): Promise<void> {
    await SecureStorage.remove(`${this.PREFIX}${key}`);
  },

  async invalidateAll(): Promise<void> {
    const keys = await SecureStorage.keys();
    const cacheKeys = keys.filter(key => key.startsWith(this.PREFIX));
    await Promise.all(cacheKeys.map(key => SecureStorage.remove(key)));
  },
};

/**
 * User preferences storage
 */
export const PreferencesStorage = {
  PREFIX: 'prefs_',

  async set<T>(key: string, value: T): Promise<void> {
    await SecureStorage.set(`${this.PREFIX}${key}`, value);
  },

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const value = await SecureStorage.get<T>(`${this.PREFIX}${key}`);
    return value ?? defaultValue;
  },

  async remove(key: string): Promise<void> {
    await SecureStorage.remove(`${this.PREFIX}${key}`);
  },
};
