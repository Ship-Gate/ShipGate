'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  type Post,
  type CreatePostInput,
  type UpdatePostInput,
  type ListPostParams,
  type ListPostResult,
} from '@/lib/api/post';

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (params?: ListPostParams) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: string) => [...postKeys.details(), id] as const,
};

export function usePostList(params?: ListPostParams, options?: Omit<UseQueryOptions<ListPostResult>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: postKeys.list(params),
    queryFn: () => listPosts(params),
    ...options,
  });
}

export function usePost(id: string | null, options?: Omit<UseQueryOptions<Post | null>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: postKeys.detail(id ?? ''),
    queryFn: () => (id ? getPost(id) : Promise.resolve(null)),
    enabled: !!id,
    ...options,
  });
}

export function useCreatePost(options?: UseMutationOptions<Post, Error, CreatePostInput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
    ...options,
  });
}

export function useUpdatePost(options?: UseMutationOptions<Post, Error, { id: string; data: UpdatePostInput }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updatePost(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
    ...options,
  });
}

export function useDeletePost(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
    ...options,
  });
}
