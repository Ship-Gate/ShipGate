/**
 * Logger Utility
 * 
 * 🛑 ISSUES:
 * - console.log in production code
 * - No log level filtering
 * - No PII redaction
 */

// 🛑 Using console.log in production - should use proper logger
export function log(message: string, data?: unknown) {
  console.log(`[${new Date().toISOString()}] ${message}`, data ?? '');
}

export function logError(message: string, error?: Error) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error?.message ?? '');
}

export function logUser(action: string, email: string) {
  // 🛑 LOGS PII - should not log email directly
  console.log(`[USER] ${action}: ${email}`);
}

// 🛑 No redaction of sensitive fields
export function logRequest(req: { path: string; body?: unknown }) {
  console.log(`[REQUEST] ${req.path}`, JSON.stringify(req.body));
}
