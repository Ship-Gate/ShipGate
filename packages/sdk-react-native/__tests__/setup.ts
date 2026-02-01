/**
 * Test setup file
 */
import { vi } from 'vitest';

// Mock React Native modules that aren't available in Node
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
    currentState: 'active',
  },
  Platform: {
    OS: 'ios',
    select: vi.fn((obj) => obj.ios),
  },
  Dimensions: {
    get: vi.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      getAllKeys: vi.fn(() => Promise.resolve(Object.keys(store))),
      multiRemove: vi.fn((keys: string[]) => {
        keys.forEach(key => delete store[key]);
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
        return Promise.resolve();
      }),
    },
  };
});

// Mock Expo SecureStore
vi.mock('expo-secure-store', () => {
  const secureStore: Record<string, string> = {};
  return {
    getItemAsync: vi.fn((key: string) => Promise.resolve(secureStore[key] ?? null)),
    setItemAsync: vi.fn((key: string, value: string) => {
      secureStore[key] = value;
      return Promise.resolve();
    }),
    deleteItemAsync: vi.fn((key: string) => {
      delete secureStore[key];
      return Promise.resolve();
    }),
  };
});

// Mock global fetch
global.fetch = vi.fn();

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
