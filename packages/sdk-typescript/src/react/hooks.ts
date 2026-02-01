/**
 * ISL React Hooks - Custom hooks for ISL operations.
 */

import { useState, useCallback, useEffect } from 'react';
import { useISLClient } from './provider';
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
  ListUsersInput,
  SearchUsersInput,
} from '../models';
import type {
  CreateUserResult,
  GetUserResult,
  UpdateUserResult,
  DeleteUserResult,
  ListUsersResult,
  SearchUsersResult,
} from '../results';

// =============================================================================
// Types
// =============================================================================

export interface UseCreateUserOptions {
  onSuccess?: (user: User) => void;
  onError?: (error: CreateUserResult extends { ok: false; error: infer E } ? E : never) => void;
}

export interface UseGetUserOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseUpdateUserOptions {
  onSuccess?: (user: User) => void;
  onError?: (error: UpdateUserResult extends { ok: false; error: infer E } ? E : never) => void;
}

// =============================================================================
// Mutation State
// =============================================================================

interface MutationState<T, E> {
  data?: T;
  error?: E;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

// =============================================================================
// Query State
// =============================================================================

interface QueryState<T, E> {
  data?: T;
  error?: E;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

// =============================================================================
// useCreateUser
// =============================================================================

export function useCreateUser(options: UseCreateUserOptions = {}) {
  const client = useISLClient();
  const [state, setState] = useState<MutationState<User, any>>({
    isPending: false,
    isSuccess: false,
    isError: false,
  });

  const mutate = useCallback(
    async (input: CreateUserInput): Promise<CreateUserResult> => {
      setState({ isPending: true, isSuccess: false, isError: false });

      const result = await client.users.createUser(input);

      if (result.ok) {
        setState({
          data: result.data,
          isPending: false,
          isSuccess: true,
          isError: false,
        });
        options.onSuccess?.(result.data);
      } else {
        setState({
          error: result.error,
          isPending: false,
          isSuccess: false,
          isError: true,
        });
        options.onError?.(result.error);
      }

      return result;
    },
    [client, options.onSuccess, options.onError]
  );

  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false });
  }, []);

  return { ...state, mutate, reset };
}

// =============================================================================
// useGetUser
// =============================================================================

export function useGetUser(userId: string, options: UseGetUserOptions = {}) {
  const client = useISLClient();
  const { enabled = true, refetchInterval } = options;

  const [state, setState] = useState<QueryState<User, any>>({
    isLoading: enabled,
    isFetching: false,
    isSuccess: false,
    isError: false,
    refetch: async () => {},
  });

  const fetchUser = useCallback(async () => {
    setState((prev) => ({ ...prev, isFetching: true }));

    const result = await client.users.getUser(userId);

    if (result.ok) {
      setState({
        data: result.data,
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        refetch: fetchUser,
      });
    } else {
      setState({
        error: result.error,
        isLoading: false,
        isFetching: false,
        isSuccess: false,
        isError: true,
        refetch: fetchUser,
      });
    }
  }, [client, userId]);

  useEffect(() => {
    if (enabled) {
      fetchUser();
    }
  }, [enabled, fetchUser]);

  useEffect(() => {
    if (refetchInterval && enabled) {
      const interval = setInterval(fetchUser, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, enabled, fetchUser]);

  return state;
}

// =============================================================================
// useUpdateUser
// =============================================================================

export function useUpdateUser(userId: string, options: UseUpdateUserOptions = {}) {
  const client = useISLClient();
  const [state, setState] = useState<MutationState<User, any>>({
    isPending: false,
    isSuccess: false,
    isError: false,
  });

  const mutate = useCallback(
    async (input: UpdateUserInput): Promise<UpdateUserResult> => {
      setState({ isPending: true, isSuccess: false, isError: false });

      const result = await client.users.updateUser(userId, input);

      if (result.ok) {
        setState({
          data: result.data,
          isPending: false,
          isSuccess: true,
          isError: false,
        });
        options.onSuccess?.(result.data);
      } else {
        setState({
          error: result.error,
          isPending: false,
          isSuccess: false,
          isError: true,
        });
        options.onError?.(result.error);
      }

      return result;
    },
    [client, userId, options.onSuccess, options.onError]
  );

  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false });
  }, []);

  return { ...state, mutate, reset };
}

// =============================================================================
// useDeleteUser
// =============================================================================

export function useDeleteUser(userId: string) {
  const client = useISLClient();
  const [state, setState] = useState<MutationState<void, any>>({
    isPending: false,
    isSuccess: false,
    isError: false,
  });

  const mutate = useCallback(async (): Promise<DeleteUserResult> => {
    setState({ isPending: true, isSuccess: false, isError: false });

    const result = await client.users.deleteUser(userId);

    if (result.ok) {
      setState({
        data: undefined,
        isPending: false,
        isSuccess: true,
        isError: false,
      });
    } else {
      setState({
        error: result.error,
        isPending: false,
        isSuccess: false,
        isError: true,
      });
    }

    return result;
  }, [client, userId]);

  return { ...state, mutate };
}

// =============================================================================
// useListUsers
// =============================================================================

export function useListUsers(input: ListUsersInput = {}) {
  const client = useISLClient();

  const [state, setState] = useState<QueryState<{ users: User[]; nextPageToken?: string; totalCount?: number }, any>>({
    isLoading: true,
    isFetching: false,
    isSuccess: false,
    isError: false,
    refetch: async () => {},
  });

  const fetchUsers = useCallback(async () => {
    setState((prev) => ({ ...prev, isFetching: true }));

    const result = await client.users.listUsers(input);

    if (result.ok) {
      setState({
        data: {
          users: [...result.data.users],
          nextPageToken: result.data.nextPageToken,
          totalCount: result.data.totalCount,
        },
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        refetch: fetchUsers,
      });
    } else {
      setState({
        error: result.error,
        isLoading: false,
        isFetching: false,
        isSuccess: false,
        isError: true,
        refetch: fetchUsers,
      });
    }
  }, [client, JSON.stringify(input)]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return state;
}

// =============================================================================
// useSearchUsers
// =============================================================================

export function useSearchUsers(query: string, options: { enabled?: boolean } = {}) {
  const client = useISLClient();
  const { enabled = true } = options;

  const [state, setState] = useState<QueryState<{ users: User[]; nextPageToken?: string; totalCount?: number }, any>>({
    isLoading: false,
    isFetching: false,
    isSuccess: false,
    isError: false,
    refetch: async () => {},
  });

  const search = useCallback(async () => {
    if (!enabled || query.length < 2) return;

    setState((prev) => ({ ...prev, isLoading: true, isFetching: true }));

    const result = await client.users.searchUsers({ query });

    if (result.ok) {
      setState({
        data: {
          users: [...result.data.users],
          nextPageToken: result.data.nextPageToken,
          totalCount: result.data.totalCount,
        },
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        refetch: search,
      });
    } else {
      setState({
        error: result.error,
        isLoading: false,
        isFetching: false,
        isSuccess: false,
        isError: true,
        refetch: search,
      });
    }
  }, [client, query, enabled]);

  useEffect(() => {
    search();
  }, [search]);

  return state;
}
