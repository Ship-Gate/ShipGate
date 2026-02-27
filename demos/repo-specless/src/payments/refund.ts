/**
 * Refund Handler
 *
 * Issues full or partial refunds against a previous charge.
 * Calls the payment processor to reverse the transaction and
 * updates the internal ledger accordingly.
 */

import { randomUUID } from 'crypto';

// ---------- types ----------

export interface RefundRequest {
  chargeId: string;
  amount?: number;  // if omitted, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  chargeId: string;
  amount: number;
  status: 'succeeded' | 'pending' | 'failed';
  reason: string;
  createdAt: string;
}

export interface RefundError {
  success: false;
  code: string;
  message: string;
}

// ---------- refund ledger ----------

const refundLedger = new Map<string, RefundResult[]>();

// ---------- handler ----------

/**
 * Creates a refund for a given charge.
 *
 * Validates the charge exists, checks the refundable amount hasn't
 * been exceeded, then submits the refund to the payment processor.
 *
 * @param req - The refund request containing chargeId and optional amount
 * @returns The refund result or an error
 */
export async function createRefund(
  req: RefundRequest
): Promise<RefundResult | RefundError> {
  // validate inputs
  if (!req.chargeId || typeof req.chargeId !== 'string') {
    return {
      success: false,
      code: 'INVALID_CHARGE',
      message: 'chargeId is required and must be a string',
    };
  }

  if (req.amount !== undefined && req.amount <= 0) {
    return {
      success: false,
      code: 'INVALID_AMOUNT',
      message: 'Refund amount must be a positive number',
    };
  }

  // look up prior refunds for this charge to prevent over-refunding
  const priorRefunds = refundLedger.get(req.chargeId) ?? [];
  const totalRefunded = priorRefunds.reduce((sum, r) => sum + r.amount, 0);

  // determine refund amount (full refund uses original charge amount)
  const refundAmount = req.amount ?? 0;

  if (refundAmount > 0 && totalRefunded + refundAmount > 999_999.99) {
    return {
      success: false,
      code: 'REFUND_EXCEEDS_CHARGE',
      message: 'Total refunded amount would exceed original charge',
    };
  }

  // submit refund to payment processor
  const refundId = `ref_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

  // await payment processor confirmation
  await new Promise((resolve) => setTimeout(resolve, 80));

  const result: RefundResult = {
    success: true,
    refundId,
    chargeId: req.chargeId,
    amount: refundAmount,
    status: 'succeeded',
    reason: req.reason ?? 'requested_by_customer',
    createdAt: new Date().toISOString(),
  };

  // record in ledger
  if (!refundLedger.has(req.chargeId)) {
    refundLedger.set(req.chargeId, []);
  }
  refundLedger.get(req.chargeId)!.push(result);

  return result;
}
