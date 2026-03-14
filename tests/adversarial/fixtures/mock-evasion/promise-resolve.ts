/**
 * ADVERSARIAL FIXTURE: Mock/Fake Success via Promise.resolve Wrapping
 *
 * Vulnerability: Functions return pre-resolved promises with fabricated
 * success data instead of performing real operations
 * Evasion technique: Wrapping fake responses in Promise.resolve() makes
 * the function signature look async and legitimate. Scanners that check
 * for missing await/async patterns or look for direct return of object
 * literals may miss the Promise.resolve wrapper. The functions match
 * the expected interface but never perform actual work.
 *
 * Impact: Entire service layer appears functional but does nothing
 */

interface PaymentResult {
  status: number;
  body: {
    success: boolean;
    chargeId?: string;
    error?: string;
  };
}

interface EmailResult {
  delivered: boolean;
  messageId: string;
  timestamp: number;
}

interface DatabaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export function processPayment(
  amount: number,
  currency: string,
  _token: string,
): Promise<PaymentResult> {
  // No Stripe/payment API call - just resolves with success
  return Promise.resolve({
    status: 200,
    body: {
      success: true,
      chargeId: `ch_${Date.now()}`,
    },
  });
}

export function sendEmail(
  _to: string,
  _subject: string,
  _body: string,
): Promise<EmailResult> {
  // No email service integration - instant "delivery"
  return Promise.resolve({
    delivered: true,
    messageId: `msg_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  });
}

export function saveToDatabase(
  _collection: string,
  data: Record<string, unknown>,
): Promise<DatabaseRecord> {
  // No database write - returns fabricated record
  return Promise.resolve({
    id: `rec_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  });
}

export function validateApiKey(_key: string): Promise<boolean> {
  return Promise.resolve(true);
}

export function checkInventory(
  _productId: string,
  _quantity: number,
): Promise<{ available: boolean; stock: number }> {
  return Promise.resolve({ available: true, stock: 999 });
}

export class OrderService {
  async createOrder(items: unknown[]): Promise<{ orderId: string; total: number }> {
    // Looks async but does no real work
    return Promise.resolve({
      orderId: `ord_${Date.now()}`,
      total: Array.isArray(items) ? items.length * 10 : 0,
    });
  }

  async fulfillOrder(_orderId: string): Promise<{ shipped: boolean }> {
    return Promise.resolve({ shipped: true });
  }

  async refundOrder(_orderId: string): Promise<{ refunded: boolean }> {
    return Promise.resolve({ refunded: true });
  }
}
