// ============================================================================
// React Hooks for SDK
// ============================================================================

/**
 * React hooks generator for ISL SDK
 * 
 * Generates hooks for data fetching with:
 * - Loading/error states
 * - Automatic refetching
 * - Optimistic updates
 * - Cache management
 */

import type { Domain, Behavior } from './types.js';

/**
 * Generate React hooks for a domain
 */
export function generateReactHooks(domain: Domain): string {
  const imports = generateHookImports();
  const hooks = domain.behaviors.map(b => generateHook(domain.name, b)).join('\n\n');
  const queryClient = generateQueryClientSetup(domain);

  return `${imports}

${queryClient}

${hooks}
`;
}

function generateHookImports(): string {
  return `/**
 * React Hooks for ISL SDK
 * 
 * Requires: @tanstack/react-query
 */
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import type { ApiResponse } from '@intentos/sdk-web';
`;
}

function generateQueryClientSetup(domain: Domain): string {
  const name = domain.name.toLowerCase();
  
  return `// Query keys
export const ${name}Keys = {
  all: ['${name}'] as const,
${domain.behaviors.map(b => `  ${camelCase(b.name)}: (params?: unknown) => [...${name}Keys.all, '${b.name}', params] as const,`).join('\n')}
};
`;
}

function generateHook(domainName: string, behavior: Behavior): string {
  const hookName = `use${pascalCase(behavior.name)}`;
  const keyName = `${domainName.toLowerCase()}Keys.${camelCase(behavior.name)}`;
  const baseName = pascalCase(behavior.name);
  
  const isQuery = isQueryBehavior(behavior.name);
  const hasInput = behavior.input && Object.keys(behavior.input).length > 0;
  const hasOutput = behavior.output && Object.keys(behavior.output).length > 0;

  const inputType = hasInput ? `${baseName}Request` : 'void';
  const outputType = hasOutput ? `${baseName}Response` : 'void';

  if (isQuery) {
    return `/**
 * ${behavior.name} query hook
 */
export function ${hookName}(${hasInput ? `params: ${inputType}` : ''}) {
  return useQuery({
    queryKey: ${keyName}(${hasInput ? 'params' : ''}),
    queryFn: async () => {
      const client = get${pascalCase(domainName)}Client();
      const response = await client.${camelCase(behavior.name)}(${hasInput ? 'params' : ''});
      return response.data;
    },
  });
}`;
  } else {
    return `/**
 * ${behavior.name} mutation hook
 */
export function ${hookName}() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (${hasInput ? `input: ${inputType}` : ''}) => {
      const client = get${pascalCase(domainName)}Client();
      const response = await client.${camelCase(behavior.name)}(${hasInput ? 'input' : ''});
      return response.data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ${domainName.toLowerCase()}Keys.all });
    },
  });
}`;
  }
}

// Utility hook generator
export function generateUtilityHooks(): string {
  return `
/**
 * Optimistic update hook
 */
export function useOptimisticUpdate<T>(
  queryKey: readonly unknown[],
  updateFn: (old: T | undefined, variables: unknown) => T
) {
  const queryClient = useQueryClient();

  const mutate = useCallback(
    async (variables: unknown, mutation: () => Promise<unknown>) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<T>(queryKey);

      // Optimistically update
      queryClient.setQueryData<T>(queryKey, (old) => updateFn(old, variables));

      try {
        await mutation();
      } catch (error) {
        // Rollback on error
        queryClient.setQueryData(queryKey, previousData);
        throw error;
      }
    },
    [queryClient, queryKey, updateFn]
  );

  return mutate;
}

/**
 * Infinite scroll hook
 */
export function useInfiniteList<T>(
  queryKey: readonly unknown[],
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>
) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const result = await fetchFn(page);
      setItems((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage((p) => p + 1);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, fetchFn]);

  const reset = useCallback(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
  }, []);

  return { items, hasMore, loading, loadMore, reset };
}

/**
 * Debounced search hook
 */
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await searchFn(q);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, delay),
    [searchFn, delay]
  );

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      search(value);
    },
    [search]
  );

  return { query, results, loading, setQuery: handleChange };
}

function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}
`;
}

// Helper functions
function isQueryBehavior(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('get') || lower.startsWith('list') || 
         lower.startsWith('find') || lower.startsWith('search');
}

function pascalCase(str: string): string {
  return str.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function camelCase(str: string): string {
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
