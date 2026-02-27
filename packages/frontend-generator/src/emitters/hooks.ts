// ============================================================================
// React Query Hooks Emitter
// ============================================================================

import { toKebab, toPascal } from '../utils.js';

export function emitUseEntityList(
  entityName: string,
  baseUrl: string = '/api'
): string {
  const kebab = toKebab(entityName);
  const path = `/${kebab}`;

  return `"use client";

import { useQuery } from "@tanstack/react-query";
import type { ${entityName} } from "@/lib/types";

async function fetch${entityName}List(): Promise<${entityName}[]> {
  const res = await fetch(\`${baseUrl}${path}\`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function use${entityName}List() {
  return useQuery({
    queryKey: ["${entityName}", "list"],
    queryFn: fetch${entityName}List,
  });
}
`;
}
