// Line 7: ISSUE - phantom-api, API_BASE_URL env var never defined
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export async function apiFetch(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  return response.json();
}

// Line 22: ISSUE - unused-export, refreshToken never imported or used
export async function refreshToken() {
  const response = await fetch('/api/auth/refresh', { method: 'POST' });
  return response.json();
}
