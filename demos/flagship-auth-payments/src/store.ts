/**
 * In-memory store for the demo
 * This mocks a database for demonstration purposes
 */

import type {
  User,
  Session,
  Customer,
  Payment,
  Refund,
  Subscription,
  FileRecord,
  UploadSession,
  UserId,
  SessionId,
  PaymentId,
  CustomerId,
  SubscriptionId,
  FileId,
} from './types.js';

class Store<T extends { id: string }> {
  private items: Map<string, T> = new Map();

  create(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const item = this.items.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  findBy(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.items.values()) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  findAll(predicate?: (item: T) => boolean): T[] {
    const all = Array.from(this.items.values());
    return predicate ? all.filter(predicate) : all;
  }

  count(predicate?: (item: T) => boolean): number {
    return this.findAll(predicate).length;
  }

  exists(id: string): boolean {
    return this.items.has(id);
  }

  clear(): void {
    this.items.clear();
  }
}

// Auth stores
export const users = new Store<User>();
export const sessions = new Store<Session>();

// Payment stores
export const customers = new Store<Customer>();
export const payments = new Store<Payment>();
export const refunds = new Store<Refund>();
export const subscriptions = new Store<Subscription>();

// Upload stores
export const files = new Store<FileRecord>();
export const uploadSessions = new Store<UploadSession>();

// Audit log for tracking events
export interface AuditEvent {
  id: string;
  type: string;
  actor_id?: string;
  resource_type: string;
  resource_id: string;
  action: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  timestamp: Date;
}

export const auditLog: AuditEvent[] = [];

export function logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
  auditLog.push({
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  });
}

// Reset all stores (useful for testing)
export function resetAllStores(): void {
  users.clear();
  sessions.clear();
  customers.clear();
  payments.clear();
  refunds.clear();
  subscriptions.clear();
  files.clear();
  uploadSessions.clear();
  auditLog.length = 0;
}
