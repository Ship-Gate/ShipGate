/**
 * Frontend API client for dashboard components.
 * All requests go to same-origin Next.js API routes (cookie auth).
 */

interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: { nextCursor?: string; hasMore?: boolean };
}

class FetchError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok) {
    throw new FetchError(res.status, json.error ?? `HTTP ${res.status}`);
  }

  return json;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
