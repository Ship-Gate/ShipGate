/**
 * Chaos Checkout Demo Implementation
 * 
 * Demonstrates idempotent checkout session creation with chaos resilience.
 */

import * as crypto from 'crypto';

// Types from spec
interface LineItem {
  name: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface CheckoutSession {
  id: string;
  idempotency_key?: string;
  status: 'OPEN' | 'PROCESSING' | 'COMPLETE' | 'EXPIRED' | 'FAILED';
  line_items: LineItem[];
  currency: string;
  amount_total: number;
  success_url: string;
  cancel_url: string;
  request_hash?: string;
  created_at: Date;
  completed_at?: Date;
  retry_count: number;
}

interface CreateCheckoutInput {
  idempotency_key?: string;
  line_items: LineItem[];
  currency?: string;
  success_url: string;
  cancel_url: string;
}

interface CreateCheckoutResult {
  session: CheckoutSession;
  url: string;
  is_cached: boolean;
}

// In-memory storage (would be a database in production)
const sessions: Map<string, CheckoutSession> = new Map();
const idempotencyIndex: Map<string, string> = new Map(); // key -> session_id
const idempotencyHashes: Map<string, string> = new Map(); // key -> request_hash

/**
 * Generate a deterministic hash of the request parameters
 */
function hashRequest(input: CreateCheckoutInput): string {
  const normalized = {
    line_items: input.line_items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })).sort((a, b) => a.name.localeCompare(b.name)),
    currency: input.currency || 'USD',
    success_url: input.success_url,
    cancel_url: input.cancel_url,
  };
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

/**
 * Generate a UUID
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Create checkout session with idempotency support
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  // Validate input
  if (!input.line_items || input.line_items.length === 0) {
    throw new CheckoutError('EMPTY_LINE_ITEMS', 'No line items provided');
  }
  
  for (const item of input.line_items) {
    if (item.quantity <= 0 || item.unit_price < 0) {
      throw new CheckoutError('INVALID_LINE_ITEM', `Invalid line item: ${item.name}`);
    }
  }

  // Calculate request hash for idempotency verification
  const requestHash = hashRequest(input);

  // Check idempotency
  if (input.idempotency_key) {
    const existingSessionId = idempotencyIndex.get(input.idempotency_key);
    
    if (existingSessionId) {
      const existingSession = sessions.get(existingSessionId);
      
      if (existingSession) {
        // Check if parameters match
        const existingHash = idempotencyHashes.get(input.idempotency_key);
        
        if (existingHash && existingHash !== requestHash) {
          throw new CheckoutError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key already used with different parameters'
          );
        }
        
        // Return cached response
        return {
          session: existingSession,
          url: `https://checkout.example.com/pay/${existingSession.id}`,
          is_cached: true,
        };
      }
    }
  }

  // Calculate total
  const amount_total = input.line_items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  // Create new session
  const session: CheckoutSession = {
    id: generateUUID(),
    idempotency_key: input.idempotency_key,
    status: 'OPEN',
    line_items: input.line_items.map(item => ({
      ...item,
      amount: item.quantity * item.unit_price,
    })),
    currency: input.currency || 'USD',
    amount_total,
    success_url: input.success_url,
    cancel_url: input.cancel_url,
    request_hash: requestHash,
    created_at: new Date(),
    retry_count: 0,
  };

  // Store session
  sessions.set(session.id, session);
  
  // Store idempotency mapping
  if (input.idempotency_key) {
    idempotencyIndex.set(input.idempotency_key, session.id);
    idempotencyHashes.set(input.idempotency_key, requestHash);
  }

  return {
    session,
    url: `https://checkout.example.com/pay/${session.id}`,
    is_cached: false,
  };
}

/**
 * Complete a checkout session
 */
export async function completeCheckout(
  sessionId: string,
  paymentIntentId: string
): Promise<CheckoutSession> {
  const session = sessions.get(sessionId);
  
  if (!session) {
    throw new CheckoutError('NOT_FOUND', 'Session not found');
  }
  
  if (session.status !== 'PROCESSING') {
    throw new CheckoutError('INVALID_STATE', 'Session is not in PROCESSING state');
  }

  session.status = 'COMPLETE';
  session.completed_at = new Date();
  
  return session;
}

/**
 * Get a checkout session by ID
 */
export function getSession(sessionId: string): CheckoutSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get a checkout session by idempotency key
 */
export function getSessionByIdempotencyKey(key: string): CheckoutSession | undefined {
  const sessionId = idempotencyIndex.get(key);
  if (sessionId) {
    return sessions.get(sessionId);
  }
  return undefined;
}

/**
 * Count sessions with a specific idempotency key
 */
export function countSessionsByIdempotencyKey(key: string): number {
  let count = 0;
  for (const session of sessions.values()) {
    if (session.idempotency_key === key) {
      count++;
    }
  }
  return count;
}

/**
 * Reset all sessions (for testing)
 */
export function resetSessions(): void {
  sessions.clear();
  idempotencyIndex.clear();
  idempotencyHashes.clear();
}

/**
 * Custom error class for checkout errors
 */
export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

/**
 * Implementation wrapper for chaos verification
 */
export const checkoutImplementation = {
  async execute(input: Record<string, unknown>): Promise<unknown> {
    return createCheckoutSession(input as CreateCheckoutInput);
  },
};
