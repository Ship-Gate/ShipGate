/**
 * Curated Signature Database
 * 
 * Verified API signatures for popular packages.
 */

import type { PackageSignature } from './types.js';

export const SIGNATURE_DATABASE: PackageSignature[] = [
  // Prisma Client
  {
    package: '@prisma/client',
    versionRange: '>=4.0.0',
    methods: [
      { name: 'findUnique', path: ['PrismaClient', '<model>'] },
      { name: 'findFirst', path: ['PrismaClient', '<model>'] },
      { name: 'findMany', path: ['PrismaClient', '<model>'] },
      { name: 'create', path: ['PrismaClient', '<model>'] },
      { name: 'update', path: ['PrismaClient', '<model>'] },
      { name: 'upsert', path: ['PrismaClient', '<model>'] },
      { name: 'delete', path: ['PrismaClient', '<model>'] },
      { name: 'deleteMany', path: ['PrismaClient', '<model>'] },
      { name: 'count', path: ['PrismaClient', '<model>'] },
      { name: 'aggregate', path: ['PrismaClient', '<model>'] },
      { name: 'groupBy', path: ['PrismaClient', '<model>'] },
      { name: '$connect', path: ['PrismaClient'] },
      { name: '$disconnect', path: ['PrismaClient'] },
      { name: '$transaction', path: ['PrismaClient'] },
      { name: '$queryRaw', path: ['PrismaClient'] },
      { name: '$executeRaw', path: ['PrismaClient'] },
    ],
    deprecated: [
      {
        name: 'findByEmail',
        path: ['PrismaClient', '<model>'],
        deprecatedSince: '4.0.0',
        replacement: 'findUnique({ where: { email } })',
        message: 'Custom methods are not part of Prisma Client API',
      },
    ],
  },

  // Stripe
  {
    package: 'stripe',
    versionRange: '>=12.0.0',
    methods: [
      { name: 'create', path: ['Stripe', 'paymentIntents'] },
      { name: 'retrieve', path: ['Stripe', 'paymentIntents'] },
      { name: 'update', path: ['Stripe', 'paymentIntents'] },
      { name: 'confirm', path: ['Stripe', 'paymentIntents'] },
      { name: 'cancel', path: ['Stripe', 'paymentIntents'] },
      { name: 'create', path: ['Stripe', 'customers'] },
      { name: 'retrieve', path: ['Stripe', 'customers'] },
      { name: 'update', path: ['Stripe', 'customers'] },
      { name: 'del', path: ['Stripe', 'customers'] },
      { name: 'list', path: ['Stripe', 'customers'] },
      { name: 'create', path: ['Stripe', 'subscriptions'] },
      { name: 'retrieve', path: ['Stripe', 'subscriptions'] },
      { name: 'update', path: ['Stripe', 'subscriptions'] },
      { name: 'cancel', path: ['Stripe', 'subscriptions'] },
    ],
    deprecated: [
      {
        name: 'create',
        path: ['Stripe', 'charges'],
        deprecatedSince: '2023-08',
        replacement: 'paymentIntents.create()',
        message: 'Use Payment Intents API instead of Charges',
      },
    ],
  },

  // Next.js App Router
  {
    package: 'next/navigation',
    versionRange: '>=13.0.0',
    methods: [
      { name: 'push', path: ['useRouter()'] },
      { name: 'replace', path: ['useRouter()'] },
      { name: 'refresh', path: ['useRouter()'] },
      { name: 'prefetch', path: ['useRouter()'] },
      { name: 'back', path: ['useRouter()'] },
      { name: 'forward', path: ['useRouter()'] },
    ],
  },

  // Next.js Pages Router
  {
    package: 'next/router',
    versionRange: '>=12.0.0',
    methods: [
      { name: 'push', path: ['useRouter()'] },
      { name: 'replace', path: ['useRouter()'] },
      { name: 'reload', path: ['useRouter()'] },
      { name: 'back', path: ['useRouter()'] },
      { name: 'prefetch', path: ['useRouter()'] },
      { name: 'beforePopState', path: ['useRouter()'] },
    ],
  },

  // Express
  {
    package: 'express',
    versionRange: '>=4.0.0',
    methods: [
      { name: 'use', path: ['express()'] },
      { name: 'get', path: ['express()'] },
      { name: 'post', path: ['express()'] },
      { name: 'put', path: ['express()'] },
      { name: 'delete', path: ['express()'] },
      { name: 'patch', path: ['express()'] },
      { name: 'listen', path: ['express()'] },
      { name: 'json', path: ['express'] },
      { name: 'urlencoded', path: ['express'] },
      { name: 'static', path: ['express'] },
      { name: 'Router', path: ['express'] },
      { name: 'send', path: ['Response'] },
      { name: 'json', path: ['Response'] },
      { name: 'status', path: ['Response'] },
      { name: 'redirect', path: ['Response'] },
      { name: 'render', path: ['Response'] },
      { name: 'sendFile', path: ['Response'] },
      { name: 'cookie', path: ['Response'] },
      { name: 'clearCookie', path: ['Response'] },
    ],
  },

  // Fastify
  {
    package: 'fastify',
    versionRange: '>=4.0.0',
    methods: [
      { name: 'register', path: ['fastify()'] },
      { name: 'get', path: ['fastify()'] },
      { name: 'post', path: ['fastify()'] },
      { name: 'put', path: ['fastify()'] },
      { name: 'delete', path: ['fastify()'] },
      { name: 'patch', path: ['fastify()'] },
      { name: 'listen', path: ['fastify()'] },
      { name: 'ready', path: ['fastify()'] },
      { name: 'close', path: ['fastify()'] },
      { name: 'addHook', path: ['fastify()'] },
      { name: 'send', path: ['Reply'] },
      { name: 'code', path: ['Reply'] },
      { name: 'header', path: ['Reply'] },
      { name: 'redirect', path: ['Reply'] },
    ],
  },

  // Supabase
  {
    package: '@supabase/supabase-js',
    versionRange: '>=2.0.0',
    methods: [
      { name: 'from', path: ['SupabaseClient'] },
      { name: 'select', path: ['SupabaseClient', 'from()'] },
      { name: 'insert', path: ['SupabaseClient', 'from()'] },
      { name: 'update', path: ['SupabaseClient', 'from()'] },
      { name: 'upsert', path: ['SupabaseClient', 'from()'] },
      { name: 'delete', path: ['SupabaseClient', 'from()'] },
      { name: 'eq', path: ['SupabaseClient', 'from()', 'select()'] },
      { name: 'neq', path: ['SupabaseClient', 'from()', 'select()'] },
      { name: 'gt', path: ['SupabaseClient', 'from()', 'select()'] },
      { name: 'lt', path: ['SupabaseClient', 'from()', 'select()'] },
      { name: 'single', path: ['SupabaseClient', 'from()', 'select()'] },
    ],
  },

  // Mongoose
  {
    package: 'mongoose',
    versionRange: '>=6.0.0',
    methods: [
      { name: 'connect', path: ['mongoose'] },
      { name: 'disconnect', path: ['mongoose'] },
      { name: 'model', path: ['mongoose'] },
      { name: 'Schema', path: ['mongoose'] },
      { name: 'find', path: ['Model'] },
      { name: 'findOne', path: ['Model'] },
      { name: 'findById', path: ['Model'] },
      { name: 'create', path: ['Model'] },
      { name: 'updateOne', path: ['Model'] },
      { name: 'updateMany', path: ['Model'] },
      { name: 'deleteOne', path: ['Model'] },
      { name: 'deleteMany', path: ['Model'] },
      { name: 'save', path: ['Document'] },
    ],
  },

  // Axios
  {
    package: 'axios',
    versionRange: '>=1.0.0',
    methods: [
      { name: 'get', path: ['axios'] },
      { name: 'post', path: ['axios'] },
      { name: 'put', path: ['axios'] },
      { name: 'delete', path: ['axios'] },
      { name: 'patch', path: ['axios'] },
      { name: 'request', path: ['axios'] },
      { name: 'create', path: ['axios'] },
      { name: 'interceptors', path: ['axios'] },
    ],
  },

  // Zod
  {
    package: 'zod',
    versionRange: '>=3.0.0',
    methods: [
      { name: 'string', path: ['z'] },
      { name: 'number', path: ['z'] },
      { name: 'boolean', path: ['z'] },
      { name: 'object', path: ['z'] },
      { name: 'array', path: ['z'] },
      { name: 'enum', path: ['z'] },
      { name: 'union', path: ['z'] },
      { name: 'literal', path: ['z'] },
      { name: 'optional', path: ['ZodType'] },
      { name: 'nullable', path: ['ZodType'] },
      { name: 'refine', path: ['ZodType'] },
      { name: 'parse', path: ['ZodType'] },
      { name: 'safeParse', path: ['ZodType'] },
    ],
  },

  // React Query
  {
    package: '@tanstack/react-query',
    versionRange: '>=4.0.0',
    methods: [
      { name: 'useQuery', path: [] },
      { name: 'useMutation', path: [] },
      { name: 'useQueryClient', path: [] },
      { name: 'invalidateQueries', path: ['QueryClient'] },
      { name: 'setQueryData', path: ['QueryClient'] },
      { name: 'getQueryData', path: ['QueryClient'] },
      { name: 'prefetchQuery', path: ['QueryClient'] },
    ],
  },

  // Drizzle ORM
  {
    package: 'drizzle-orm',
    versionRange: '>=0.28.0',
    methods: [
      { name: 'select', path: ['db'] },
      { name: 'insert', path: ['db'] },
      { name: 'update', path: ['db'] },
      { name: 'delete', path: ['db'] },
      { name: 'from', path: ['db', 'select()'] },
      { name: 'where', path: ['db', 'select()', 'from()'] },
      { name: 'orderBy', path: ['db', 'select()', 'from()'] },
      { name: 'limit', path: ['db', 'select()', 'from()'] },
      { name: 'values', path: ['db', 'insert()'] },
      { name: 'set', path: ['db', 'update()'] },
    ],
  },

  // tRPC
  {
    package: '@trpc/server',
    versionRange: '>=10.0.0',
    methods: [
      { name: 'router', path: ['initTRPC'] },
      { name: 'procedure', path: ['initTRPC'] },
      { name: 'middleware', path: ['initTRPC'] },
      { name: 'input', path: ['Procedure'] },
      { name: 'query', path: ['Procedure'] },
      { name: 'mutation', path: ['Procedure'] },
    ],
  },
];

export function getSignatureForPackage(packageName: string): PackageSignature | undefined {
  return SIGNATURE_DATABASE.find(sig => sig.package === packageName);
}
