// ============================================================================
// ISL Standard Library Integration Example - TypeScript Implementation
// 
// This file demonstrates how to implement the ISL behaviors using
// the stdlib TypeScript packages.
// ============================================================================

import {
  AuthService,
  type Session,
  type User,
} from '@isl-lang/stdlib-auth';

import {
  createRateLimiter,
  createMemoryStorage,
  createRedisStorage,
  rateLimitMiddleware,
  IdentifierType,
  RateLimitAction,
  type CheckResult,
} from '@isl-lang/stdlib-rate-limit';

import {
  PaymentService,
  type Payment,
  PaymentStatus,
} from '@isl-lang/stdlib-payments';

import {
  createAuditLogger,
  EventCategory,
  EventOutcome,
  type AuditEvent,
} from '@isl-lang/stdlib-audit';
import { PostgresAuditStorage } from '@isl-lang/stdlib-audit/storage/postgres';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface AppConfig {
  auth: {
    hashRounds: number;
    sessionDuration: string;
    maxFailedAttempts: number;
  };
  rateLimit: {
    login: { limit: number; windowMs: number };
    api: { limit: number; windowMs: number };
  };
  payments: {
    provider: 'stripe';
    apiKey: string;
  };
  audit: {
    service: string;
    environment: string;
  };
}

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

export function createServices(config: AppConfig, dbPool: unknown) {
  // Initialize auth service
  const auth = new AuthService({
    hashRounds: config.auth.hashRounds,
    sessionDuration: config.auth.sessionDuration,
    maxFailedAttempts: config.auth.maxFailedAttempts,
  });

  // Initialize rate limiter (memory for single-server, Redis for distributed)
  const rateLimiter = createRateLimiter({
    storage: createMemoryStorage(),
    configs: [
      {
        name: 'login',
        limit: config.rateLimit.login.limit,
        windowMs: config.rateLimit.login.windowMs,
        blockDurationMs: 30 * 60 * 1000, // 30 min block on exceed
        escalationMultiplier: 2,
      },
      {
        name: 'api-free',
        limit: 100,
        windowMs: 60 * 1000,
        warnThreshold: 0.8,
      },
      {
        name: 'api-pro',
        limit: 1000,
        windowMs: 60 * 1000,
        warnThreshold: 0.8,
      },
      {
        name: 'api-enterprise',
        limit: 10000,
        windowMs: 60 * 1000,
        warnThreshold: 0.9,
      },
    ],
    enableEscalation: true,
    onViolation: async (violation) => {
      // Log violation to audit
      await auditLogger.logSecurityEvent(
        'rate_limit_violation',
        { id: violation.key, type: 'SERVICE' as const },
        EventOutcome.FAILURE,
        { configName: violation.configName, count: violation.requestCount }
      );
    },
  });

  // Initialize payment service
  const payments = new PaymentService({
    provider: config.payments.provider,
    apiKey: config.payments.apiKey,
  });

  // Initialize audit logger
  const auditLogger = createAuditLogger({
    storage: new PostgresAuditStorage(dbPool as any),
    service: config.audit.service,
    environment: config.audit.environment,
    enableHashing: true,
    enableChaining: true,
  });

  return { auth, rateLimiter, payments, auditLogger };
}

// ============================================================================
// SECURE LOGIN IMPLEMENTATION
// Implements the SecureLogin behavior from main.isl
// ============================================================================

export interface SecureLoginInput {
  email: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
}

export type SecureLoginResult = {
  success: true;
  session: Session;
  token: string;
  user: User;
} | {
  success: false;
  error: 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'ACCOUNT_LOCKED';
  retryAfter?: number;
}

export async function secureLogin(
  input: SecureLoginInput,
  services: ReturnType<typeof createServices>
): Promise<SecureLoginResult> {
  const { auth, rateLimiter, auditLogger } = services;
  
  // Step 1: Check rate limit (stdlib-rate-limit)
  const rateCheck = await rateLimiter.check({
    key: input.email,
    identifierType: IdentifierType.CUSTOM,
    configName: 'login',
  });

  // Also check IP rate limit
  const ipRateCheck = await rateLimiter.check({
    key: input.ipAddress,
    identifierType: IdentifierType.IP,
    configName: 'login',
  });

  if (rateCheck.action === RateLimitAction.DENY || ipRateCheck.action === RateLimitAction.DENY) {
    // Log rate limit violation (stdlib-audit)
    await auditLogger.logSecurityEvent(
      'login_rate_limited',
      {
        id: input.email,
        type: 'ANONYMOUS' as const,
        ip_address: input.ipAddress,
      },
      EventOutcome.FAILURE,
      { email: input.email, ip: input.ipAddress }
    );

    return {
      success: false,
      error: 'RATE_LIMITED',
      retryAfter: Math.max(rateCheck.retryAfterMs ?? 0, ipRateCheck.retryAfterMs ?? 0),
    };
  }

  // Step 2: Authenticate user (stdlib-auth)
  try {
    const authResult = await auth.login({
      email: input.email,
      password: input.password,
      ipAddress: input.ipAddress,
    });

    // Increment rate limit counter on success
    await rateLimiter.increment({
      key: input.email,
      identifierType: IdentifierType.CUSTOM,
      configName: 'login',
      success: true,
    });

    // Log successful login (stdlib-audit)
    await auditLogger.logAuthentication(
      'login',
      {
        id: authResult.user.id,
        type: 'USER' as const,
        email: input.email,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      },
      EventOutcome.SUCCESS
    );

    return {
      success: true,
      session: authResult.session,
      token: authResult.token,
      user: authResult.user,
    };
  } catch (error) {
    // Record failed attempt (stdlib-auth rate limiting)
    await rateLimiter.increment({
      key: input.email,
      identifierType: IdentifierType.CUSTOM,
      configName: 'login',
      success: false,
    });

    // Log failed login (stdlib-audit)
    await auditLogger.logAuthentication(
      'login',
      {
        id: input.email,
        type: 'ANONYMOUS' as const,
        ip_address: input.ipAddress,
      },
      EventOutcome.FAILURE,
      { reason: 'invalid_credentials' }
    );

    return {
      success: false,
      error: 'INVALID_CREDENTIALS',
    };
  }
}

// ============================================================================
// PROCESS SUBSCRIPTION PAYMENT IMPLEMENTATION
// Implements the ProcessSubscriptionPayment behavior from main.isl
// ============================================================================

export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface ProcessSubscriptionPaymentInput {
  customerId: string;
  plan: SubscriptionTier;
  paymentMethodId: string;
}

export type ProcessSubscriptionPaymentResult = {
  success: true;
  payment: Payment;
  subscriptionId: string;
} | {
  success: false;
  error: 'CUSTOMER_NOT_FOUND' | 'PAYMENT_FAILED' | 'ALREADY_SUBSCRIBED';
}

const PLAN_PRICES: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 2999, // $29.99
  ENTERPRISE: 9999, // $99.99
};

export async function processSubscriptionPayment(
  input: ProcessSubscriptionPaymentInput,
  services: ReturnType<typeof createServices>,
  customerLookup: (id: string) => Promise<{ id: string; tier: SubscriptionTier; subscriptionId?: string } | null>,
  customerUpdate: (id: string, data: { tier: SubscriptionTier; subscriptionId: string }) => Promise<void>
): Promise<ProcessSubscriptionPaymentResult> {
  const { payments, auditLogger } = services;

  // Step 1: Verify customer exists
  const customer = await customerLookup(input.customerId);
  if (!customer) {
    return { success: false, error: 'CUSTOMER_NOT_FOUND' };
  }

  // Step 2: Check for existing subscription
  if (customer.subscriptionId) {
    return { success: false, error: 'ALREADY_SUBSCRIBED' };
  }

  // Step 3: Calculate amount
  const amount = PLAN_PRICES[input.plan];

  try {
    // Step 4: Create and process payment (stdlib-payments)
    const payment = await payments.createPayment({
      customerId: input.customerId,
      amount,
      currency: 'USD',
      description: `Subscription: ${input.plan}`,
    });

    const processed = await payments.processPayment(payment.id, {
      paymentMethodId: input.paymentMethodId,
      saveCard: true,
    });

    if (processed.status === PaymentStatus.FAILED) {
      await auditLogger.logDataModification(
        'create',
        { id: input.customerId, type: 'USER' as const },
        { type: 'Payment', id: payment.id },
        EventOutcome.FAILURE,
        undefined,
        { reason: 'payment_failed' }
      );

      return { success: false, error: 'PAYMENT_FAILED' };
    }

    // Step 5: Create subscription (stdlib-payments)
    const subscription = await payments.createSubscription({
      customerId: input.customerId,
      planId: `plan_${input.plan.toLowerCase()}`,
      defaultPaymentMethod: input.paymentMethodId,
    });

    // Step 6: Update customer
    await customerUpdate(input.customerId, {
      tier: input.plan,
      subscriptionId: subscription.id,
    });

    // Step 7: Audit the subscription creation
    await auditLogger.logDataModification(
      'update',
      { id: input.customerId, type: 'USER' as const },
      { type: 'Subscription', id: subscription.id },
      EventOutcome.SUCCESS,
      [
        { field: 'tier', old_value: customer.tier, new_value: input.plan },
        { field: 'subscription_id', old_value: null, new_value: subscription.id },
      ]
    );

    return {
      success: true,
      payment: processed,
      subscriptionId: subscription.id,
    };
  } catch (error) {
    return { success: false, error: 'PAYMENT_FAILED' };
  }
}

// ============================================================================
// RATE LIMITED API CALL IMPLEMENTATION
// Implements the RateLimitedAPICall behavior from main.isl
// ============================================================================

export interface RateLimitedAPICallInput {
  apiKey: string;
  endpoint: string;
  method: string;
  body?: Record<string, unknown>;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export type RateLimitedAPICallResult = {
  success: true;
  response: unknown;
  rateLimitInfo: RateLimitInfo;
} | {
  success: false;
  error: 'RATE_LIMITED' | 'UNAUTHORIZED';
  retryAfter?: number;
  headers?: Record<string, string>;
}

export async function rateLimitedAPICall(
  input: RateLimitedAPICallInput,
  services: ReturnType<typeof createServices>,
  getApiTier: (apiKey: string) => SubscriptionTier,
  processRequest: (endpoint: string, method: string, body?: Record<string, unknown>) => Promise<unknown>
): Promise<RateLimitedAPICallResult> {
  const { rateLimiter, auditLogger } = services;

  // Determine config based on API tier
  const tier = getApiTier(input.apiKey);
  const configName = `api-${tier.toLowerCase()}`;

  // Step 1: Check and increment rate limit (stdlib-rate-limit)
  const rateCheck = await rateLimiter.checkAndIncrement({
    key: input.apiKey,
    identifierType: IdentifierType.API_KEY,
    configName,
    weight: getEndpointWeight(input.endpoint),
  });

  if (!rateCheck.allowed) {
    // Log rate limit (stdlib-audit)
    await auditLogger.logSecurityEvent(
      'api_rate_limited',
      { id: input.apiKey, type: 'SERVICE' as const },
      EventOutcome.FAILURE,
      { endpoint: input.endpoint, method: input.method }
    );

    return {
      success: false,
      error: 'RATE_LIMITED',
      retryAfter: rateCheck.retryAfterMs,
      headers: rateCheck.headers,
    };
  }

  // Step 2: Process the API call
  const response = await processRequest(input.endpoint, input.method, input.body);

  // Step 3: Log API access (stdlib-audit)
  await auditLogger.logDataAccess(
    input.method === 'GET' ? 'read' : 'list',
    { id: input.apiKey, type: 'SERVICE' as const },
    { type: 'API', id: input.endpoint },
    EventOutcome.SUCCESS,
    { method: input.method }
  );

  return {
    success: true,
    response,
    rateLimitInfo: {
      remaining: rateCheck.remaining,
      limit: rateCheck.limit,
      resetAt: rateCheck.resetAt,
    },
  };
}

// Helper function to determine endpoint weight
function getEndpointWeight(endpoint: string): number {
  if (endpoint.includes('/search')) return 5;
  if (endpoint.includes('/export')) return 10;
  if (endpoint.includes('/batch')) return 3;
  return 1;
}

// ============================================================================
// EXPRESS MIDDLEWARE EXAMPLE
// Shows how to use stdlib-rate-limit with Express
// ============================================================================

import express from 'express';

export function createExpressApp(services: ReturnType<typeof createServices>) {
  const app = express();
  const { rateLimiter, auditLogger } = services;

  // Apply rate limiting to all API routes
  app.use('/api', rateLimitMiddleware({
    limiter: rateLimiter,
    configName: 'api-free', // Default to free tier
    getConfigName: (req) => {
      // Get tier from API key
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return 'api-free';
      // In real app, look up tier from API key
      return 'api-pro';
    },
    onRateLimited: async (req, result) => {
      await auditLogger.logSecurityEvent(
        'api_rate_limited',
        { 
          id: (req.headers['x-api-key'] as string) ?? 'anonymous',
          type: 'SERVICE' as const,
          ip_address: req.ip,
        },
        EventOutcome.FAILURE,
        { path: req.path, remaining: result.remaining }
      );
    },
  }));

  return app;
}
