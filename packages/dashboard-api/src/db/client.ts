// Import PrismaClient at runtime from @prisma/client (requires prisma generate)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: PrismaClientImpl } = require('@prisma/client') as { PrismaClient: new (options?: { log?: string[] }) => import('./types').PrismaClient };

import type { PrismaClient } from './types';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClientImpl({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });
};

export const prisma: PrismaClient = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
  } catch (error) {
    throw new Error(`Failed to connect to database: ${error}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export type { PrismaClient };
