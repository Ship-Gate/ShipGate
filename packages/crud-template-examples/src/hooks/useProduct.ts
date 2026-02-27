'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type CreateProductInput,
  type UpdateProductInput,
  type ListProductParams,
  type ListProductResult,
} from '@/lib/api/product';

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params?: ListProductParams) => [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

export function useProductList(params?: ListProductParams, options?: Omit<UseQueryOptions<ListProductResult>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => listProducts(params),
    ...options,
  });
}

export function useProduct(id: string | null, options?: Omit<UseQueryOptions<Product | null>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => (id ? getProduct(id) : Promise.resolve(null)),
    enabled: !!id,
    ...options,
  });
}

export function useCreateProduct(options?: UseMutationOptions<Product, Error, CreateProductInput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
    ...options,
  });
}

export function useUpdateProduct(options?: UseMutationOptions<Product, Error, { id: string; data: UpdateProductInput }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateProduct(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
    ...options,
  });
}

export function useDeleteProduct(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
    ...options,
  });
}
