/**
 * Golden Auth Template (Fastify) — Production config
 * Logger: pino, trust proxy, body limit, connection timeout
 */

export interface FastifyConfig {
  port: number;
  host: string;
  logger: { level: string };
  trustProxy: boolean;
  bodyLimit: number;
  connectionTimeout: number;
}

export function loadConfig(): FastifyConfig {
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    logger: {
      level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
    },
    trustProxy: process.env['TRUST_PROXY'] === 'true',
    bodyLimit: parseInt(process.env['BODY_LIMIT'] ?? '1048576', 10), // 1MB
    connectionTimeout: parseInt(process.env['CONNECTION_TIMEOUT'] ?? '0', 10),
  };
}
