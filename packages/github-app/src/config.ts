/**
 * Configuration
 */

import { z } from 'zod';

const configSchema = z.object({
  appId: z.string().min(1),
  privateKey: z.string().min(1),
  webhookSecret: z.string().min(1),
  port: z.number().int().positive().optional().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).optional().default('development'),
  databaseUrl: z.string().url().optional(),
  redisUrl: z.string().url().optional(),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
});
