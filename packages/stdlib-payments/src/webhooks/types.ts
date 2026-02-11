/**
 * Webhook types
 * @packageDocumentation
 */

import { GatewayProvider, PaymentId } from '../types';

// ============================================================================
// WEBHOOK EVENT TYPES
// ============================================================================

export interface WebhookEvent {
  id: string;
  provider: GatewayProvider;
  type: string;
  eventType: WebhookEventType;
  data: any;
  signature?: string;
  timestamp: Date;
  processed: boolean;
  processingError?: string;
  retryCount: number;
  paymentId?: PaymentId;
  refundId?: string;
  metadata?: Record<string, any>;
}

export type WebhookEventType = 
  // Payment events
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.requires_action'
  | 'payment_intent.canceled'
  | 'payment_intent.amount_capturable_updated'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.pending'
  | 'charge.expired'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.updated'
  | 'charge.dispute.closed'
  
  // Refund events
  | 'charge.refund.updated'
  | 'charge.refund.failed'
  
  // Checkout events
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  
  // Customer events
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.source.created'
  | 'customer.source.deleted'
  
  // Subscription events
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  
  // PayPal specific events
  | 'payment.sale.completed'
  | 'payment.sale.denied'
  | 'payment.sale.pending'
  | 'payment.sale.refunded'
  | 'payment.sale.reversed'
  | 'checkout.order.approved'
  | 'checkout.order.completed'
  
  // Custom events
  | 'custom';

// ============================================================================
// WEBHOOK HANDLER TYPES
// ============================================================================

export interface WebhookHandler {
  handle(event: WebhookEvent): Promise<WebhookHandlerResult>;
}

export interface WebhookHandlerResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface WebhookHandlerRegistry {
  register(eventType: WebhookEventType, handler: WebhookHandler): void;
  unregister(eventType: WebhookEventType): void;
  handle(event: WebhookEvent): Promise<WebhookHandlerResult>;
  listHandlers(): { eventType: WebhookEventType; handler: WebhookHandler }[];
}

// ============================================================================
// WEBHOOK VERIFICATION TYPES
// ============================================================================

export interface WebhookSignature {
  signature: string;
  timestamp: string;
  payload: string;
}

export interface WebhookVerificationOptions {
  provider: GatewayProvider;
  secret: string;
  tolerance?: number; // Seconds, default: 300
  clock?: () => Date; // For testing
}

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: Date;
}

// ============================================================================
// WEBHOOK PROCESSING TYPES
// ============================================================================

export interface WebhookProcessor {
  process(event: WebhookEvent): Promise<void>;
  retry(eventId: string): Promise<void>;
  getFailedEvents(): WebhookEvent[];
  getEvent(eventId: string): WebhookEvent | null;
}

export interface WebhookProcessingOptions {
  maxRetries?: number;
  retryDelay?: number; // Milliseconds
  retryBackoff?: 'linear' | 'exponential';
  timeout?: number; // Milliseconds
}

export interface WebhookQueue {
  enqueue(event: WebhookEvent): Promise<void>;
  dequeue(): Promise<WebhookEvent | null>;
  size(): number;
  clear(): void;
}

// ============================================================================
// WEBHOOK MIDDLEWARE TYPES
// ============================================================================

export interface WebhookMiddleware {
  name: string;
  beforeHandle?(event: WebhookEvent): Promise<WebhookEvent>;
  afterHandle?(event: WebhookEvent, result: WebhookHandlerResult): Promise<WebhookHandlerResult>;
  onError?(event: WebhookEvent, error: Error): Promise<void>;
}

export interface WebhookMiddlewareStack {
  use(middleware: WebhookMiddleware): void;
  remove(name: string): void;
  execute(event: WebhookEvent, handler: WebhookHandler): Promise<WebhookHandlerResult>;
}

// ============================================================================
// WEBHOOK ENDPOINT TYPES
// ============================================================================

export interface WebhookEndpoint {
  path: string;
  provider: GatewayProvider;
  secret: string;
  enabled: boolean;
  events?: WebhookEventType[];
  middleware?: WebhookMiddleware[];
}

export interface WebhookEndpointConfig {
  path: string;
  provider: GatewayProvider;
  secret: string;
  events?: WebhookEventType[];
  middleware?: WebhookMiddleware[];
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  timeout?: number;
}

// ============================================================================
// WEBHOOK LOGGING TYPES
// ============================================================================

export interface WebhookLog {
  id: string;
  eventId: string;
  eventType: WebhookEventType;
  provider: GatewayProvider;
  status: 'received' | 'processed' | 'failed' | 'retrying';
  timestamp: Date;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface WebhookLogger {
  log(event: WebhookEvent, status: WebhookLog['status'], error?: string, duration?: number): void;
  getLogs(filter?: {
    eventId?: string;
    eventType?: WebhookEventType;
    provider?: GatewayProvider;
    status?: WebhookLog['status'];
    from?: Date;
    to?: Date;
  }): WebhookLog[];
  clearLogs(): void;
}

// ============================================================================
// WEBHOOK METRICS TYPES
// ============================================================================

export interface WebhookMetrics {
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  eventsByType: Record<WebhookEventType, number>;
  errorsByType: Record<string, number>;
  lastReceived?: Date;
  lastProcessed?: Date;
}

export interface WebhookMetricsCollector {
  recordEvent(event: WebhookEvent, processingTime: number, success: boolean): void;
  getMetrics(): WebhookMetrics;
  reset(): void;
}
