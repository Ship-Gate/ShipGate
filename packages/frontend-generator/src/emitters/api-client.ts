// ============================================================================
// API Client + React Query Hooks Emitter
// ============================================================================

import type { EndpointDecl, ApiBlock } from '@isl-lang/parser';
import { toCamel, toKebab, toPascal } from '../utils.js';

function getPathValue(path: { value: string }): string {
  return path.value;
}

function getMethod(endpoint: EndpointDecl): string {
  return endpoint.method;
}

export function emitApiClient(
  basePath: string,
  endpoints: EndpointDecl[],
  baseUrl: string = '/api'
): string {
  const base = basePath ? `${baseUrl}${basePath}` : baseUrl;
  const fns = endpoints.map((ep) => {
    const method = getMethod(ep);
    const path = getPathValue(ep.path);
    const fnName = toCamel(ep.behavior?.name ?? path.replace(/\//g, '_').replace(/[{}]/g, ''));
    const isGet = method === 'GET';
    const hasParams = (ep.params?.length ?? 0) > 0;
    const hasBody = !isGet && (ep.body || ep.params?.some((p) => p.name.name === 'body'));

    if (isGet) {
      return `export async function ${fnName}(params?: Record<string, string>) {
  const search = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(\`${base}${path}\${search}\`, { method: "GET" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}`;
    }
    return `export async function ${fnName}(body: unknown) {
  const res = await fetch(\`${base}${path}\`, {
    method: "${method}",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}`;
  });

  return `// Auto-generated API client
const BASE = "${base}";

${fns.join('\n\n')}
`;
}

export function emitReactQueryHook(
  endpoint: EndpointDecl,
  basePath: string,
  baseUrl: string = '/api'
): string {
  const method = getMethod(endpoint);
  const path = getPathValue(endpoint.path);
  const hookName = `use${toPascal(endpoint.behavior?.name?.name ?? path.replace(/\//g, ' '))}`;
  const fnName = toCamel(endpoint.behavior?.name?.name ?? path.replace(/\//g, '_'));
  const base = basePath ? `${baseUrl}${basePath}` : baseUrl;
  const fullPath = `${base}${path}`;
  const isGet = method === 'GET';

  if (isGet) {
    return `"use client";

import { useQuery } from "@tanstack/react-query";
import { ${fnName} } from "@/lib/api-client";

export function ${hookName}(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["${fnName}", params],
    queryFn: () => ${fnName}(params),
  });
}
`;
  }

  return `"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ${fnName} } from "@/lib/api-client";

export function ${hookName}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ${fnName},
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
`;
}
