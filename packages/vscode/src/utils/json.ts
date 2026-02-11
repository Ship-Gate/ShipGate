/**
 * Safe JSON parsing utilities
 */

export function safeParseJSON<T>(input: string): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const data = JSON.parse(input) as T;
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
