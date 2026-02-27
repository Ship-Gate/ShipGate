// ============================================================================
// Payment Repository - Data Access Layer
// ============================================================================

import { Payment, PaymentId, IdempotencyKey, PaymentStatus } from '../types';

// ==========================================================================
// REPOSITORY INTERFACE
// ==========================================================================

export interface PaymentRepository {
  findById(id: PaymentId): Promise<Payment | null>;
  findByIdempotencyKey(key: IdempotencyKey): Promise<Payment | null>;
  findByProviderId(providerPaymentId: string): Promise<Payment | null>;
  findByCustomerId(customerId: string, options?: QueryOptions): Promise<Payment[]>;
  save(payment: Payment): Promise<void>;
  update(id: PaymentId, updates: Partial<Payment>): Promise<Payment | null>;
  delete(id: PaymentId): Promise<boolean>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  status?: PaymentStatus[];
  fromDate?: Date;
  toDate?: Date;
  orderBy?: 'createdAt' | 'updatedAt' | 'amount';
  orderDir?: 'asc' | 'desc';
}

// ==========================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// ==========================================================================

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, Payment>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly byProviderId = new Map<string, string>();
  private readonly byCustomerId = new Map<string, Set<string>>();
  
  async findById(id: PaymentId): Promise<Payment | null> {
    return this.payments.get(id) ?? null;
  }
  
  async findByIdempotencyKey(key: IdempotencyKey): Promise<Payment | null> {
    const id = this.byIdempotencyKey.get(key);
    if (!id) return null;
    return this.payments.get(id) ?? null;
  }
  
  async findByProviderId(providerPaymentId: string): Promise<Payment | null> {
    const id = this.byProviderId.get(providerPaymentId);
    if (!id) return null;
    return this.payments.get(id) ?? null;
  }
  
  async findByCustomerId(
    customerId: string,
    options?: QueryOptions
  ): Promise<Payment[]> {
    const ids = this.byCustomerId.get(customerId);
    if (!ids) return [];
    
    let payments = Array.from(ids)
      .map(id => this.payments.get(id))
      .filter((p): p is Payment => p !== undefined);
    
    // Apply filters
    if (options?.status) {
      payments = payments.filter(p => options.status!.includes(p.status));
    }
    
    if (options?.fromDate) {
      payments = payments.filter(p => p.createdAt >= options.fromDate!);
    }
    
    if (options?.toDate) {
      payments = payments.filter(p => p.createdAt <= options.toDate!);
    }
    
    // Sort
    const orderBy = options?.orderBy ?? 'createdAt';
    const orderDir = options?.orderDir ?? 'desc';
    payments.sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];
      
      if (aVal instanceof Date && bVal instanceof Date) {
        return orderDir === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return orderDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
    
    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    
    return payments.slice(offset, offset + limit);
  }
  
  async save(payment: Payment): Promise<void> {
    this.payments.set(payment.id, { ...payment });
    this.byIdempotencyKey.set(payment.idempotencyKey, payment.id);
    
    if (payment.providerPaymentId) {
      this.byProviderId.set(payment.providerPaymentId, payment.id);
    }
    
    if (payment.customerId) {
      if (!this.byCustomerId.has(payment.customerId)) {
        this.byCustomerId.set(payment.customerId, new Set());
      }
      this.byCustomerId.get(payment.customerId)!.add(payment.id);
    }
  }
  
  async update(
    id: PaymentId,
    updates: Partial<Payment>
  ): Promise<Payment | null> {
    const existing = this.payments.get(id);
    if (!existing) return null;
    
    const updated: Payment = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      idempotencyKey: existing.idempotencyKey, // Prevent key change
      updatedAt: new Date(),
    };
    
    this.payments.set(id, updated);
    return updated;
  }
  
  async delete(id: PaymentId): Promise<boolean> {
    const payment = this.payments.get(id);
    if (!payment) return false;
    
    this.payments.delete(id);
    this.byIdempotencyKey.delete(payment.idempotencyKey);
    
    if (payment.providerPaymentId) {
      this.byProviderId.delete(payment.providerPaymentId);
    }
    
    if (payment.customerId) {
      this.byCustomerId.get(payment.customerId)?.delete(id);
    }
    
    return true;
  }
  
  // Test helpers
  clear(): void {
    this.payments.clear();
    this.byIdempotencyKey.clear();
    this.byProviderId.clear();
    this.byCustomerId.clear();
  }
  
  count(): number {
    return this.payments.size;
  }
}
