/**
 * Hooks tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ISLProvider } from '../src/providers/ISLProvider';
import { useQuery, useISLClient } from '../src/hooks';
import { ISLClient } from '../src/client/ISLClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock React Native modules
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ISLProvider config={{ baseUrl: 'https://api.example.com' }}>
    {children}
  </ISLProvider>
);

describe('useISLClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return client from context', () => {
    const { result } = renderHook(() => useISLClient(), { wrapper });
    expect(result.current).toBeInstanceOf(ISLClient);
  });

  it('should throw when used outside provider', () => {
    expect(() => {
      renderHook(() => useISLClient());
    }).toThrow('useISLClient must be used within an ISLProvider');
  });
});

describe('useQuery', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should fetch data on mount', async () => {
    const mockData = { id: '1', name: 'Test User' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
      headers: new Headers(),
    });

    const { result } = renderHook(
      () => useQuery<typeof mockData>('/api/users/1'),
      { wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(result.current.isFetched).toBe(true);
  });

  it('should handle errors', async () => {
    const errorData = { code: 'NOT_FOUND', message: 'Not found' };
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve(errorData),
      headers: new Headers(),
    });

    const { result } = renderHook(
      () => useQuery('/api/users/999'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(errorData);
    expect(result.current.data).toBeNull();
  });

  it('should not fetch when disabled', () => {
    const { result } = renderHook(
      () => useQuery('/api/users', { enabled: false }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should refetch on demand', async () => {
    const mockData = { count: 1 };
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 2 }),
        headers: new Headers(),
      });

    const { result } = renderHook(
      () => useQuery<typeof mockData>('/api/count'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data?.count).toBe(1);
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data?.count).toBe(2);
    });
  });
});

describe('useMutation', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // Note: useMutation tests would be similar, testing:
  // - Successful mutations
  // - Error handling
  // - Validation
  // - Loading states
  // - Callbacks (onSuccess, onError)
});
