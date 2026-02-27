/**
 * ISL Provider - Context provider for the SDK
 */
import React, {
  createContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ISLClient } from '../client/ISLClient';
import { WebSocketClient } from '../client/WebSocketClient';
import type { ISLClientConfig, SyncStatus, NetworkState } from '../types';

// Context type
export interface ISLContextValue {
  client: ISLClient;
  wsClient: WebSocketClient | null;
  syncStatus: SyncStatus;
  networkState: NetworkState;
  isInitialized: boolean;
}

// Create context
export const ISLContext = createContext<ISLContextValue | null>(null);

// Provider props
export interface ISLProviderProps {
  children: ReactNode;
  config: ISLClientConfig;
  wsConfig?: {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
  };
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * ISL Provider component
 */
export function ISLProvider({
  children,
  config,
  wsConfig,
  onReady,
  onError,
}: ISLProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    lastSyncAt: null,
    isSyncing: false,
  });
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });

  // Create client instances
  const client = useMemo(() => {
    return new ISLClient({
      ...config,
      onNetworkChange: setNetworkState,
    });
  }, [config.baseUrl, config.authToken, config.enableOffline]);

  const wsClient = useMemo(() => {
    if (!wsConfig) return null;
    return new WebSocketClient({
      url: wsConfig.url,
      authToken: config.authToken,
      reconnect: wsConfig.reconnect ?? true,
      reconnectInterval: wsConfig.reconnectInterval ?? 3000,
    });
  }, [wsConfig?.url, config.authToken]);

  // Initialize client
  useEffect(() => {
    async function init() {
      try {
        await client.initialize();
        
        // Subscribe to sync status changes
        const unsubscribe = client.onSyncStatusChange(setSyncStatus);
        
        // Set initial sync status
        setSyncStatus(client.getSyncStatus());
        
        setIsInitialized(true);
        onReady?.();

        return unsubscribe;
      } catch (error) {
        onError?.(error as Error);
      }
    }

    const cleanupPromise = init();
    
    return () => {
      cleanupPromise.then(unsubscribe => unsubscribe?.());
    };
  }, [client]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - sync offline queue
        if (syncStatus.pendingCount > 0) {
          client.syncOfflineQueue();
        }
        
        // Reconnect WebSocket if needed
        if (wsClient && !wsClient.isConnected()) {
          wsClient.connect().catch(() => {
            // Reconnect failed - will retry
          });
        }
      } else if (nextAppState === 'background') {
        // App went to background - could disconnect WS to save battery
        // For now, keep connection alive for real-time updates
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [client, wsClient, syncStatus.pendingCount]);

  // Connect WebSocket on mount
  useEffect(() => {
    if (wsClient && isInitialized) {
      wsClient.connect().catch(() => {
        // Connection failed - will retry
      });
    }

    return () => {
      wsClient?.disconnect();
    };
  }, [wsClient, isInitialized]);

  // Update auth token on WS client when it changes
  const updateAuthToken = useCallback(async (token: string) => {
    await client.setAuthToken(token);
    wsClient?.setAuthToken(token);
  }, [client, wsClient]);

  // Context value
  const contextValue = useMemo<ISLContextValue>(() => ({
    client,
    wsClient,
    syncStatus,
    networkState,
    isInitialized,
  }), [client, wsClient, syncStatus, networkState, isInitialized]);

  // Don't render children until initialized (optional behavior)
  // if (!isInitialized) {
  //   return null; // Or a loading component
  // }

  return (
    <ISLContext.Provider value={contextValue}>
      {children}
    </ISLContext.Provider>
  );
}

/**
 * HOC to wrap a component with ISLProvider
 */
export function withISLProvider<P extends object>(
  Component: React.ComponentType<P>,
  config: ISLClientConfig,
  wsConfig?: ISLProviderProps['wsConfig']
) {
  return function WrappedComponent(props: P) {
    return (
      <ISLProvider config={config} wsConfig={wsConfig}>
        <Component {...props} />
      </ISLProvider>
    );
  };
}
