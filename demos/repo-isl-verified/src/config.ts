function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  jwtSecret: requiredEnv("JWT_SECRET"),
  jwtExpiresIn: 3600,
  port: parseInt(process.env.PORT ?? "3000", 10),
  bcryptRounds: 12,
  rateLimitWindowMs: 60_000,
  rateLimitMax: 10,
} as const;
