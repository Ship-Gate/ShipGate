/**
 * Generated User API hooks - From ISL User domain
 * 
 * This file demonstrates how codegen would create type-safe hooks
 * from ISL domain definitions.
 */
import { useMutation, useQuery, invalidateQueries } from '../hooks';
import {
  CreateUserInputSchema,
  UpdateUserInputSchema,
  UserFiltersSchema,
  validateCreateUserInput,
  validateUpdateUserInput,
} from './schemas';
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
  CreateUserError,
  UpdateUserError,
  PaginatedResponse,
  UserFilters,
  AuthTokens,
  LoginInput,
  RegisterInput,
  LoginError,
} from './types';
import { validateLoginInput, validateRegisterInput } from './schemas';

// Query keys for cache invalidation
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  me: () => [...userKeys.all, 'me'] as const,
};

/**
 * Hook to create a new user
 */
export function useCreateUser(options?: {
  onSuccess?: (user: User) => void;
  onError?: (error: CreateUserError) => void;
}) {
  return useMutation<CreateUserInput, User, CreateUserError>('/api/users', {
    ...options,
    validate: validateCreateUserInput,
    invalidateKeys: ['users'],
  });
}

/**
 * Hook to get a single user by ID
 */
export function useUser(userId: string, options?: { enabled?: boolean }) {
  return useQuery<User>(`/api/users/${userId}`, {
    enabled: options?.enabled ?? !!userId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to get current authenticated user
 */
export function useCurrentUser() {
  return useQuery<User>('/api/users/me', {
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to list users with pagination and filters
 */
export function useUsers(params?: {
  filters?: UserFilters;
  page?: number;
  limit?: number;
}) {
  return useQuery<PaginatedResponse<User>>('/api/users', {
    params: {
      ...params?.filters,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    },
    staleTime: 30000,
  });
}

/**
 * Hook to update a user
 */
export function useUpdateUser(
  userId: string,
  options?: {
    onSuccess?: (user: User) => void;
    onError?: (error: UpdateUserError) => void;
  }
) {
  return useMutation<UpdateUserInput, User, UpdateUserError>(`/api/users/${userId}`, {
    ...options,
    method: 'PATCH',
    validate: validateUpdateUserInput,
    invalidateKeys: [`/api/users/${userId}`, '/api/users'],
  });
}

/**
 * Hook to delete a user
 */
export function useDeleteUser(options?: {
  onSuccess?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  return useMutation<{ userId: string }, void, { code: string; message: string }>(
    '/api/users',
    {
      ...options,
      method: 'DELETE',
      invalidateKeys: ['users'],
    }
  );
}

/**
 * Hook for user login
 */
export function useLogin(options?: {
  onSuccess?: (tokens: AuthTokens) => void;
  onError?: (error: LoginError) => void;
}) {
  return useMutation<LoginInput, AuthTokens, LoginError>('/api/auth/login', {
    ...options,
    validate: validateLoginInput,
  });
}

/**
 * Hook for user registration
 */
export function useRegister(options?: {
  onSuccess?: (data: { user: User; tokens: AuthTokens }) => void;
  onError?: (error: CreateUserError) => void;
}) {
  return useMutation<RegisterInput, { user: User; tokens: AuthTokens }, CreateUserError>(
    '/api/auth/register',
    {
      ...options,
      validate: validateRegisterInput,
    }
  );
}

/**
 * Hook for user logout
 */
export function useLogout(options?: {
  onSuccess?: () => void;
  onError?: (error: { code: string; message: string }) => void;
}) {
  return useMutation<void, void, { code: string; message: string }>('/api/auth/logout', {
    ...options,
  });
}

/**
 * Prefetch user data
 */
export async function prefetchUser(
  client: { get: (url: string) => Promise<{ success: boolean; data: User }> },
  userId: string
) {
  const { prefetchQuery } = await import('../hooks/useQuery');
  await prefetchQuery(client, `/api/users/${userId}`);
}

/**
 * Invalidate user cache
 */
export function invalidateUserCache(userId?: string) {
  if (userId) {
    invalidateQueries(`/api/users/${userId}`);
  }
  invalidateQueries('/api/users');
}
