/**
 * useSubscription - Real-time subscription hook using WebSockets
 */
import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { ISLContext } from '../providers/ISLProvider';
import type { SubscriptionState, SubscriptionOptions, ISLError } from '../types';

interface SubscriptionResult<TData, TError> extends SubscriptionState<TData, TError> {
  subscribe: () => void;
  unsubscribe: () => void;
  send: <T>(payload: T) => void;
}

/**
 * Subscription hook for real-time data
 */
export function useSubscription<TData, TError = ISLError>(
  channel: string,
  options?: SubscriptionOptions<TData, TError> & { enabled?: boolean }
): SubscriptionResult<TData, TError> {
  const context = useContext(ISLContext);
  const [state, setState] = useState<SubscriptionState<TData, TError>>({
    data: null,
    error: null,
    isConnected: false,
    isConnecting: false,
    connectionId: null,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  if (!context) {
    throw new Error('useSubscription must be used within an ISLProvider');
  }

  const { wsClient } = context;

  // Handle incoming data
  const handleData = useCallback((data: TData) => {
    if (!mountedRef.current) return;
    
    setState(s => ({
      ...s,
      data,
      error: null,
    }));
    
    options?.onData?.(data);
  }, [options]);

  // Handle errors
  const handleError = useCallback((error: TError) => {
    if (!mountedRef.current) return;
    
    setState(s => ({
      ...s,
      error,
    }));
    
    options?.onError?.(error);
  }, [options]);

  // Subscribe to channel
  const subscribe = useCallback(() => {
    if (!wsClient || unsubscribeRef.current) return;

    setState(s => ({ ...s, isConnecting: true }));

    // Connect if not connected
    if (!wsClient.isConnected()) {
      wsClient.connect()
        .then(() => {
          if (mountedRef.current) {
            setState(s => ({
              ...s,
              isConnected: true,
              isConnecting: false,
              connectionId: wsClient.getConnectionId(),
            }));
            options?.onConnect?.();
          }
        })
        .catch((error) => {
          if (mountedRef.current) {
            setState(s => ({
              ...s,
              isConnected: false,
              isConnecting: false,
              error: { code: 'CONNECTION_ERROR', message: error.message } as TError,
            }));
          }
        });
    }

    // Subscribe to channel
    unsubscribeRef.current = wsClient.subscribe<TData>(
      channel,
      handleData,
      {
        onError: handleError as (error: Error) => void,
        onConnect: () => {
          if (mountedRef.current) {
            setState(s => ({
              ...s,
              isConnected: true,
              isConnecting: false,
              connectionId: wsClient.getConnectionId(),
            }));
          }
          options?.onConnect?.();
        },
        onDisconnect: () => {
          if (mountedRef.current) {
            setState(s => ({
              ...s,
              isConnected: false,
              connectionId: null,
            }));
          }
          options?.onDisconnect?.();
        },
      }
    );
  }, [wsClient, channel, handleData, handleError, options]);

  // Unsubscribe from channel
  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      
      setState(s => ({
        ...s,
        isConnected: false,
        connectionId: null,
      }));
    }
  }, []);

  // Send message to channel
  const send = useCallback(<T>(payload: T) => {
    if (wsClient && wsClient.isConnected()) {
      wsClient.send(channel, payload);
    }
  }, [wsClient, channel]);

  // Auto-subscribe on mount if enabled
  useEffect(() => {
    mountedRef.current = true;

    if (options?.enabled !== false && wsClient) {
      subscribe();
    }

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [channel, options?.enabled]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    send,
  };
}

/**
 * Hook for presence channel (who's online)
 */
export function usePresence<TUser = { id: string; name: string }>(
  channel: string,
  currentUser?: TUser
) {
  const [members, setMembers] = useState<TUser[]>([]);
  
  const { data, isConnected, send } = useSubscription<{
    type: 'join' | 'leave' | 'sync';
    user?: TUser;
    members?: TUser[];
  }>(`presence:${channel}`, {
    onConnect: () => {
      if (currentUser) {
        send({ type: 'join', user: currentUser });
      }
    },
    onDisconnect: () => {
      if (currentUser) {
        send({ type: 'leave', user: currentUser });
      }
    },
    onData: (data) => {
      switch (data.type) {
        case 'join':
          if (data.user) {
            setMembers(m => [...m.filter(u => (u as { id?: string }).id !== (data.user as { id?: string }).id), data.user]);
          }
          break;
        case 'leave':
          if (data.user) {
            setMembers(m => m.filter(u => (u as { id?: string }).id !== (data.user as { id?: string }).id));
          }
          break;
        case 'sync':
          if (data.members) {
            setMembers(data.members);
          }
          break;
      }
    },
  });

  return {
    members,
    isConnected,
    data,
  };
}
