/**
 * useMutation - Mutation hook for creating/updating/deleting data
 */
import { useState, useCallback, useRef } from 'react';
import { useISLClient } from './useISLClient';
import type {
  MutationState,
  MutationOptions,
  ValidationResult,
  ISLError,
} from '../types';
import { invalidateQueries, setQueryData } from './useQuery';

interface MutationResult<TInput, TData, TError> extends MutationState<TData, TError> {
  mutate: (input: TInput) => Promise<void>;
  mutateAsync: (input: TInput) => Promise<TData>;
  reset: () => void;
}

type HttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface UseMutationConfig<TInput, TData, TError> extends MutationOptions<TInput, TData, TError> {
  method?: HttpMethod;
  invalidateKeys?: string[];
  updateCache?: {
    key: string;
    updater: (input: TInput, oldData: unknown) => unknown;
  };
}

/**
 * Mutation hook for data modifications
 */
export function useMutation<TInput, TData, TError = ISLError>(
  endpoint: string,
  options?: UseMutationConfig<TInput, TData, TError>
): MutationResult<TInput, TData, TError> {
  const client = useISLClient();
  const [state, setState] = useState<MutationState<TData, TError>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mutation function
  const mutateAsync = useCallback(async (input: TInput): Promise<TData> => {
    // Client-side validation (ISL preconditions)
    if (options?.validate) {
      const validation = options.validate(input);
      if (!validation.valid) {
        const error = {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validation.errors,
        } as TError;
        
        setState({
          data: null,
          error,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });
        
        options?.onError?.(error, input);
        throw error;
      }
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(s => ({
      ...s,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    }));

    // Optimistic update
    let rollbackData: unknown = null;
    if (options?.optimisticUpdate && options.updateCache) {
      const optimisticData = options.optimisticUpdate(input);
      rollbackData = setQueryData(options.updateCache.key, optimisticData);
    }

    const method = options?.method ?? 'POST';
    let result: { success: boolean; data?: TData; error?: TError };

    try {
      switch (method) {
        case 'POST':
          result = await client.post<TInput, TData, TError>(endpoint, input, {
            signal: abortControllerRef.current.signal,
          });
          break;
        case 'PUT':
          result = await client.put<TInput, TData, TError>(endpoint, input, {
            signal: abortControllerRef.current.signal,
          });
          break;
        case 'PATCH':
          result = await client.patch<TInput, TData, TError>(endpoint, input, {
            signal: abortControllerRef.current.signal,
          });
          break;
        case 'DELETE':
          result = await client.delete<TData, TError>(endpoint, {
            signal: abortControllerRef.current.signal,
          });
          break;
        default:
          result = await client.post<TInput, TData, TError>(endpoint, input, {
            signal: abortControllerRef.current.signal,
          });
      }
    } catch (error) {
      // Rollback optimistic update
      if (rollbackData !== null && options?.updateCache) {
        setQueryData(options.updateCache.key, rollbackData);
      }
      options?.rollback?.(input);
      throw error;
    }

    if (!mountedRef.current) {
      throw new Error('Component unmounted');
    }

    if (result.success && result.data) {
      setState({
        data: result.data,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });

      // Update cache with real data
      if (options?.updateCache) {
        setQueryData(options.updateCache.key, result.data);
      }

      // Invalidate related queries
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(key => invalidateQueries(key));
      }

      options?.onSuccess?.(result.data, input);
      options?.onSettled?.(result.data, null, input);
      
      return result.data;
    } else {
      // Rollback optimistic update
      if (rollbackData !== null && options?.updateCache) {
        setQueryData(options.updateCache.key, rollbackData);
      }
      options?.rollback?.(input);

      const error = result.error ?? ({ code: 'UNKNOWN', message: 'Unknown error' } as TError);
      
      setState({
        data: null,
        error,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });

      options?.onError?.(error, input);
      options?.onSettled?.(null, error, input);
      
      throw error;
    }
  }, [client, endpoint, options]);

  // Non-throwing mutation
  const mutate = useCallback(async (input: TInput): Promise<void> => {
    try {
      await mutateAsync(input);
    } catch {
      // Error already handled in state
    }
  }, [mutateAsync]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  };
}

/**
 * Create a validated mutation from an ISL schema
 */
export function createValidatedMutation<TInput, TData, TError = ISLError>(
  endpoint: string,
  validate: (input: TInput) => ValidationResult
) {
  return (options?: Omit<UseMutationConfig<TInput, TData, TError>, 'validate'>) => 
    useMutation<TInput, TData, TError>(endpoint, { ...options, validate });
}
