import { z } from 'zod';

/**
 * Environment variable validation schema
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DASHBOARD_PORT: z.coerce.number().int().positive().default(3700),
  DASHBOARD_CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  ENABLE_TRACING: z.coerce.boolean().default(false),
  ENABLE_CIRCUIT_BREAKER: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

/**
 * Get validated environment configuration
 * Validates env vars at startup and caches the result
 */
export function getEnvConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    cachedConfig = envSchema.parse({
      NODE_ENV: process.env['NODE_ENV'],
      DASHBOARD_PORT: process.env['DASHBOARD_PORT'],
      DASHBOARD_CORS_ORIGIN: process.env['DASHBOARD_CORS_ORIGIN'],
      DATABASE_URL: process.env['DATABASE_URL'],
      JWT_SECRET: process.env['JWT_SECRET'],
      API_KEY: process.env['API_KEY'],
      LOG_LEVEL: process.env['LOG_LEVEL'],
      ENABLE_METRICS: process.env['ENABLE_METRICS'],
      ENABLE_TRACING: process.env['ENABLE_TRACING'],
      ENABLE_CIRCUIT_BREAKER: process.env['ENABLE_CIRCUIT_BREAKER'],
    });
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${issues}`);
    }
    throw error;
  }
}
