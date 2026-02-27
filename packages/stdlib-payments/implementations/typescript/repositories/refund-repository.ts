// ============================================================================
// Refund Repository - Data Access Layer
// ============================================================================

import { Refund, RefundId, PaymentId, IdempotencyKey, RefundStatus } from '../types';

// ==========================================================================
// REPOSITORY INTERFACE
// ==========================================================================

export interface RefundRepository {
  findById(id: RefundId): Promise<Refund | null>;
  findByIdempotencyKey(key: IdempotencyKey): Promise<Refund | null>;
  findByProviderId(providerRefundId: string): Promise<Refund | null>;
  findByPaymentId(paymentId: PaymentId): Promise<Refund[]>;
  save(refund: Refund): Promise<void>;
  update(id: RefundId, updates: Partial<Refund>): Promise<Refund | null>;
}

// ==========================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// ==========================================================================

export class InMemoryRefundRepository implements RefundRepository {
  private readonly refunds = new Map<string, Refund>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly byProviderId = new Map<string, string>();
  private readonly byPaymentId = new Map<string, Set<string>>();
  
  async findById(id: RefundId): Promise<Refund | null> {
    return this.refunds.get(id) ?? null;
  }
  
  async findByIdempotencyKey(key: IdempotencyKey): Promise<Refund | null> {
    const id = this.byIdempotencyKey.get(key);
    if (!id) return null;
    return this.refunds.get(id) ?? null;
  }
  
  async findByProviderId(providerRefundId: string): Promise<Refund | null> {
    const id = this.byProviderId.get(providerRefundId);
    if (!id) return null;
    return this.refunds.get(id) ?? null;
  }
  
  async findByPaymentId(paymentId: PaymentId): Promise<Refund[]> {
    const ids = this.byPaymentId.get(paymentId);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.refunds.get(id))
      .filter((r): r is Refund => r !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async save(refund: Refund): Promise<void> {
    this.refunds.set(refund.id, { ...refund });
    this.byIdempotencyKey.set(refund.idempotencyKey, refund.id);
    
    if (refund.providerRefundId) {
      this.byProviderId.set(refund.providerRefundId, refund.id);
    }
    
    if (!this.byPaymentId.has(refund.paymentId)) {
      this.byPaymentId.set(refund.paymentId, new Set());
    }
    this.byPaymentId.get(refund.paymentId)!.add(refund.id);
  }
  
  async update(
    id: RefundId,
    updates: Partial<Refund>
  ): Promise<Refund | null> {
    const existing = this.refunds.get(id);
    if (!existing) return null;
    
    const updated: Refund = {
      ...existing,
      ...updates,
      id: existing.id,
      paymentId: existing.paymentId,
      idempotencyKey: existing.idempotencyKey,
      updatedAt: new Date(),
    };
    
    this.refunds.set(id, updated);
    
    if (updated.providerRefundId && !existing.providerRefundId) {
      this.byProviderId.set(updated.providerRefundId, id);
    }
    
    return updated;
  }
  
  // Test helpers
  clear(): void {
    this.refunds.clear();
    this.byIdempotencyKey.clear();
    this.byProviderId.clear();
    this.byPaymentId.clear();
  }
  
  count(): number {
    return this.refunds.size;
  }
  
  countByStatus(status: RefundStatus): number {
    return Array.from(this.refunds.values()).filter(r => r.status === status).length;
  }
}
