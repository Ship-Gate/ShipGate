'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  type Invoice,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type ListInvoiceParams,
  type ListInvoiceResult,
} from '@/lib/api/invoice';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (params?: ListInvoiceParams) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

export function useInvoiceList(params?: ListInvoiceParams, options?: Omit<UseQueryOptions<ListInvoiceResult>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => listInvoices(params),
    ...options,
  });
}

export function useInvoice(id: string | null, options?: Omit<UseQueryOptions<Invoice | null>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    queryFn: () => (id ? getInvoice(id) : Promise.resolve(null)),
    enabled: !!id,
    ...options,
  });
}

export function useCreateInvoice(options?: UseMutationOptions<Invoice, Error, CreateInvoiceInput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}

export function useUpdateInvoice(options?: UseMutationOptions<Invoice, Error, { id: string; data: UpdateInvoiceInput }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateInvoice(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}

export function useDeleteInvoice(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}
