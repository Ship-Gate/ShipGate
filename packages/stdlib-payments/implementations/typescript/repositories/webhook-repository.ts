// ============================================================================
// Webhook Event Repository - Data Access Layer
// ============================================================================

import { WebhookEvent, WebhookProvider, WebhookEventType } from '../types';

// ==========================================================================
// REPOSITORY INTERFACE
// ==========================================================================

export interface WebhookEventRepository {
  findById(id: string): Promise<WebhookEvent | null>;
  findByEventId(provider: WebhookProvider, eventId: string): Promise<WebhookEvent | null>;
  findByPaymentId(paymentId: string): Promise<WebhookEvent[]>;
  findUnprocessed(limit?: number): Promise<WebhookEvent[]>;
  save(event: WebhookEvent): Promise<void>;
  update(id: string, updates: Partial<WebhookEvent>): Promise<WebhookEvent | null>;
}

// ==========================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// ==========================================================================

export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private readonly events = new Map<string, WebhookEvent>();
  private readonly byEventId = new Map<string, string>();
  private readonly byPaymentId = new Map<string, Set<string>>();
  
  async findById(id: string): Promise<WebhookEvent | null> {
    return this.events.get(id) ?? null;
  }
  
  async findByEventId(
    provider: WebhookProvider,
    eventId: string
  ): Promise<WebhookEvent | null> {
    const key = `${provider}:${eventId}`;
    const id = this.byEventId.get(key);
    if (!id) return null;
    return this.events.get(id) ?? null;
  }
  
  async findByPaymentId(paymentId: string): Promise<WebhookEvent[]> {
    const ids = this.byPaymentId.get(paymentId);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.events.get(id))
      .filter((e): e is WebhookEvent => e !== undefined)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }
  
  async findUnprocessed(limit = 100): Promise<WebhookEvent[]> {
    return Array.from(this.events.values())
      .filter(e => !e.processed && e.retryCount < 10)
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
      .slice(0, limit);
  }
  
  async save(event: WebhookEvent): Promise<void> {
    this.events.set(event.id, { ...event });
    
    const eventKey = `${event.provider}:${event.eventId}`;
    this.byEventId.set(eventKey, event.id);
    
    if (event.paymentId) {
      if (!this.byPaymentId.has(event.paymentId)) {
        this.byPaymentId.set(event.paymentId, new Set());
      }
      this.byPaymentId.get(event.paymentId)!.add(event.id);
    }
  }
  
  async update(
    id: string,
    updates: Partial<WebhookEvent>
  ): Promise<WebhookEvent | null> {
    const existing = this.events.get(id);
    if (!existing) return null;
    
    const updated: WebhookEvent = {
      ...existing,
      ...updates,
      id: existing.id,
      eventId: existing.eventId,
      provider: existing.provider,
    };
    
    this.events.set(id, updated);
    return updated;
  }
  
  // Test helpers
  clear(): void {
    this.events.clear();
    this.byEventId.clear();
    this.byPaymentId.clear();
  }
  
  count(): number {
    return this.events.size;
  }
  
  countByType(eventType: WebhookEventType): number {
    return Array.from(this.events.values()).filter(e => e.eventType === eventType).length;
  }
}
