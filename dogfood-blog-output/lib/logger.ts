/**
 * Safe logger - PII-safe logging (@intent no-pii-logging)
 * Auto-redacts sensitive fields before logging
 */
const PII_FIELDS = ['email', 'password', 'token', 'secret', 'credential', 'ssn', 'phone'];

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PII_FIELDS.some(f => k.toLowerCase().includes(f)) ? '[REDACTED]' : v;
  }
  return out;
}

export const safeLogger = {
  info: (msg: string, data?: Record<string, unknown>) => {
    const entry = { level: 'info', message: msg, timestamp: new Date().toISOString(), ...(data && { data: redactObject(data) }) };
    if (process.env['NODE_ENV'] !== 'test') process.stdout.write(JSON.stringify(entry) + '\n');
  },
  error: (msg: string, data?: Record<string, unknown>) => {
    const entry = { level: 'error', message: msg, timestamp: new Date().toISOString(), ...(data && { data: redactObject(data) }) };
    process.stderr.write(JSON.stringify(entry) + '\n');
  },
  warn: (msg: string, data?: Record<string, unknown>) => {
    const entry = { level: 'warn', message: msg, timestamp: new Date().toISOString(), ...(data && { data: redactObject(data) }) };
    process.stderr.write(JSON.stringify(entry) + '\n');
  },
};

export function redactPII<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  return redactObject(obj as Record<string, unknown>) as T;
}
