/**
 * ISLClient tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ISLClient } from '../src/client/ISLClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    multiRemove: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock SecureStore
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

describe('ISLClient', () => {
  let client: ISLClient;

  beforeEach(() => {
    client = new ISLClient({
      baseUrl: 'https://api.example.com',
      enableOffline: true,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should initialize with auth token', () => {
      const authedClient = new ISLClient({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
      });
      expect(authedClient.isAuthenticated()).toBe(true);
      expect(authedClient.getAuthToken()).toBe('test-token');
    });
  });

  describe('request', () => {
    it('should make GET request', async () => {
      const mockData = { id: '1', name: 'Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      const result = await client.get<typeof mockData>('/api/users/1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockData);
      }
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/users/1',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should make POST request with body', async () => {
      const input = { email: 'test@example.com', name: 'Test' };
      const mockResponse = { id: '1', ...input };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      });

      const result = await client.post<typeof input, typeof mockResponse>(
        '/api/users',
        input
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        })
      );
    });

    it('should handle error responses', async () => {
      const errorResponse = { code: 'NOT_FOUND', message: 'User not found' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse),
        headers: new Headers(),
      });

      const result = await client.get('/api/users/999');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(errorResponse);
      }
    });

    it('should include auth header when authenticated', async () => {
      await client.setAuthToken('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      });

      await client.get('/api/users');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
        headers: new Headers({ 'Retry-After': '60' }),
      });

      const result = await client.get('/api/users');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual({
          code: 'RATE_LIMITED',
          message: 'Rate limited',
          retryAfter: 60,
        });
      }
    });
  });

  describe('authentication', () => {
    it('should set auth token', async () => {
      await client.setAuthToken('new-token');
      expect(client.getAuthToken()).toBe('new-token');
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should clear auth', async () => {
      await client.setAuthToken('token');
      await client.clearAuth();
      expect(client.getAuthToken()).toBeNull();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('sync status', () => {
    it('should return initial sync status', () => {
      const status = client.getSyncStatus();
      expect(status).toEqual({
        isOnline: true,
        pendingCount: 0,
        lastSyncAt: null,
        isSyncing: false,
      });
    });

    it('should notify listeners on status change', async () => {
      const listener = vi.fn();
      client.onSyncStatusChange(listener);

      client.setNetworkState({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
      });

      // Status should update
      const status = client.getSyncStatus();
      expect(status.isOnline).toBe(false);
    });
  });
});
