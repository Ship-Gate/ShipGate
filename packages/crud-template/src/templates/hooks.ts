/**
 * TanStack Query hooks template
 */

import type { EntityDefinition } from '../types.js';
import { toCamelCase } from '../utils.js';

export function generateHooks(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const plural = entity.plural ?? entityCamel + 's';

  return `'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  list${entityName}s,
  get${entityName},
  create${entityName},
  update${entityName},
  delete${entityName},
  type ${entityName},
  type Create${entityName}Input,
  type Update${entityName}Input,
  type List${entityName}Params,
  type List${entityName}Result,
} from '@/lib/api/${entityCamel}';

export const ${entityCamel}Keys = {
  all: ['${plural}'] as const,
  lists: () => [...${entityCamel}Keys.all, 'list'] as const,
  list: (params?: List${entityName}Params) => [...${entityCamel}Keys.lists(), params] as const,
  details: () => [...${entityCamel}Keys.all, 'detail'] as const,
  detail: (id: string) => [...${entityCamel}Keys.details(), id] as const,
};

export function use${entityName}List(params?: List${entityName}Params, options?: Omit<UseQueryOptions<List${entityName}Result>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: ${entityCamel}Keys.list(params),
    queryFn: () => list${entityName}s(params),
    ...options,
  });
}

export function use${entityName}(id: string | null, options?: Omit<UseQueryOptions<${entityName} | null>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: ${entityCamel}Keys.detail(id ?? ''),
    queryFn: () => (id ? get${entityName}(id) : Promise.resolve(null)),
    enabled: !!id,
    ...options,
  });
}

export function useCreate${entityName}(options?: UseMutationOptions<${entityName}, Error, Create${entityName}Input>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: create${entityName},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${entityCamel}Keys.lists() });
    },
    ...options,
  });
}

export function useUpdate${entityName}(options?: UseMutationOptions<${entityName}, Error, { id: string; data: Update${entityName}Input }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => update${entityName}(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ${entityCamel}Keys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ${entityCamel}Keys.lists() });
    },
    ...options,
  });
}

export function useDelete${entityName}(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: delete${entityName},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ${entityCamel}Keys.lists() });
    },
    ...options,
  });
}
`;
}
