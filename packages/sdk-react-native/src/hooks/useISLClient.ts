/**
 * Hook to access ISL client from context
 */
import { useContext } from 'react';
import { ISLContext } from '../providers/ISLProvider';
import type { ISLClient } from '../client/ISLClient';

/**
 * Hook to get the ISL client instance
 */
export function useISLClient(): ISLClient {
  const context = useContext(ISLContext);
  
  if (!context) {
    throw new Error('useISLClient must be used within an ISLProvider');
  }
  
  return context.client;
}

/**
 * Hook to check authentication status
 */
export function useAuth() {
  const client = useISLClient();
  
  return {
    isAuthenticated: client.isAuthenticated(),
    token: client.getAuthToken(),
    setToken: (token: string) => client.setAuthToken(token),
    clearAuth: () => client.clearAuth(),
  };
}

/**
 * Hook to access sync status
 */
export function useSyncStatus() {
  const context = useContext(ISLContext);
  
  if (!context) {
    throw new Error('useSyncStatus must be used within an ISLProvider');
  }
  
  return context.syncStatus;
}

/**
 * Hook to access network state
 */
export function useNetworkState() {
  const context = useContext(ISLContext);
  
  if (!context) {
    throw new Error('useNetworkState must be used within an ISLProvider');
  }
  
  return context.networkState;
}
