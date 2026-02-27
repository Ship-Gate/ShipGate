/**
 * HTTP client for the ShipGate Dashboard API.
 * Used by CLI to upload scan results, manage projects, etc.
 */

import { getToken, getApiUrl } from './config-store.js';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retries = 2
): Promise<ApiResponse<T>> {
  const token = getToken();
  if (!token) {
    throw new ApiError(401, 'Not authenticated. Run `shipgate auth login` first.');
  }

  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'shipgate-cli',
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = (await res.json()) as ApiResponse<T>;

      if (!res.ok) {
        if (res.status === 429 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new ApiError(res.status, json.error ?? `HTTP ${res.status}`);
      }

      return json;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new ApiError(0, `Network error: ${(err as Error).message}`);
    }
  }

  throw new ApiError(0, 'Max retries exceeded');
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
