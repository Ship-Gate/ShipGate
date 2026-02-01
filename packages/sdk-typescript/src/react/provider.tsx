/**
 * ISL Client Provider - React context for ISL client.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ISLClient } from '../client';
import type { ISLClientConfig } from '../config';

/**
 * ISL Client context
 */
const ISLClientContext = createContext<ISLClient | null>(null);

/**
 * Provider props
 */
export interface ISLClientProviderProps extends ISLClientConfig {
  children: ReactNode;
}

/**
 * ISL Client Provider component
 */
export function ISLClientProvider({
  children,
  ...config
}: ISLClientProviderProps): JSX.Element {
  const client = useMemo(() => new ISLClient(config), [config.baseUrl, config.authToken]);

  return (
    <ISLClientContext.Provider value={client}>
      {children}
    </ISLClientContext.Provider>
  );
}

/**
 * Hook to access ISL client
 */
export function useISLClient(): ISLClient {
  const client = useContext(ISLClientContext);
  if (!client) {
    throw new Error('useISLClient must be used within ISLClientProvider');
  }
  return client;
}
