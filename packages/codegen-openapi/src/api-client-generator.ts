// ============================================================================
// API Client Generator
// Generates typed fetch wrapper from OpenAPI spec
// ============================================================================

import type { OpenAPISpec, OpenAPIPathItem, OpenAPIOperation } from './types.js';

/**
 * Generate a typed fetch-based API client from OpenAPI spec
 */
export function generateApiClient(spec: OpenAPISpec, options?: { baseUrl?: string }): string {
  const baseUrl = options?.baseUrl ?? '/api';
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * Auto-generated API client from OpenAPI spec');
  lines.push(` * Title: ${spec.info?.title ?? 'API'}`);
  lines.push(` * Version: ${spec.info?.version ?? '1.0.0'}`);
  lines.push(' */');
  lines.push('');
  lines.push(`const BASE_URL = "${baseUrl}";`);
  lines.push('');
  lines.push('export interface ApiError {');
  lines.push('  code: string;');
  lines.push('  message: string;');
  lines.push('  details?: Record<string, unknown>;');
  lines.push('}');
  lines.push('');
  lines.push('async function request<T>(');
  lines.push('  method: string,');
  lines.push('  path: string,');
  lines.push('  options?: { body?: unknown; query?: Record<string, string> }');
  lines.push('): Promise<T> {');
  lines.push('  let url = path.startsWith("http") ? path : BASE_URL + path;');
  lines.push('  if (options?.query && Object.keys(options.query).length > 0) {');
  lines.push('    const search = new URLSearchParams();');
  lines.push('    Object.entries(options.query).forEach(([k, v]) => {');
  lines.push('      if (v != null && v !== "") search.set(k, String(v));');
  lines.push('    });');
  lines.push('    url += (url.includes("?") ? "&" : "?") + search.toString();');
  lines.push('  }');
  lines.push('  const res = await fetch(url, {');
  lines.push('    method,');
  lines.push('    headers: { "Content-Type": "application/json" },');
  lines.push('    body: options?.body ? JSON.stringify(options.body) : undefined,');
  lines.push('  });');
  lines.push('  if (!res.ok) {');
  lines.push('    const err: ApiError = await res.json().catch(() => ({');
  lines.push('      code: "UNKNOWN",');
  lines.push(`      message: res.statusText || "Request failed"`);
  lines.push('    }));');
  lines.push('    throw new Error(err.message || JSON.stringify(err));');
  lines.push('  }');
  lines.push('  return res.json() as Promise<T>;');
  lines.push('}');
  lines.push('');

  const paths = spec.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    const item = pathItem as OpenAPIPathItem;
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method] as OpenAPIOperation | undefined;
      if (!op) continue;

      const opId = op.operationId ?? toCamelCase(path + method);
      const hasBody = ['post', 'put', 'patch'].includes(method);
      const pathParams = (path.match(/\{([^}]+)\}/g) ?? []).map((p) => p.slice(1, -1));

      let fnName = opId;
      if (fnName.startsWith(opId[0].toUpperCase())) {
        fnName = opId[0].toLowerCase() + opId.slice(1);
      }

      const pathWithParams = path.replace(/\{([^}]+)\}/g, (_, name) => `\${params.${name}}`);
      const args: string[] = [];
      if (pathParams.length > 0) {
        args.push(`params: { ${pathParams.map((p) => `${p}: string`).join('; ')} }`);
      }
      if (hasBody && op.requestBody) {
        args.push('body: unknown');
      }
      const queryParams = op.parameters?.filter((p: { in?: string }) => p.in === 'query');
      if (queryParams?.length) {
        args.push(`query?: { ${queryParams.map((p: { name: string }) => `${p.name}?: string`).join('; ')} }`);
      }

      const pathExpr = pathParams.length > 0
        ? '`' + path.replace(/\{([^}]+)\}/g, '${params.$1}') + '`'
        : `"${path}"`;
      const optsParts: string[] = [];
      if (hasBody) optsParts.push('body');
      if (queryParams?.length) optsParts.push('query');
      const reqOpts =
        optsParts.length === 2
          ? '{ body, query }'
          : optsParts.length === 1
            ? optsParts[0] === 'body'
              ? 'body ? { body } : undefined'
              : 'query ? { query } : undefined'
            : 'undefined';

      lines.push(`/** ${op.summary ?? opId} */`);
      lines.push(`export async function ${fnName}(`);
      lines.push(`  ${args.join(',\n  ')}`);
      lines.push(`): Promise<unknown> {`);
      lines.push(`  return request<unknown>("${method.toUpperCase()}", ${pathExpr}, ${reqOpts});`);
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toLowerCase());
}
