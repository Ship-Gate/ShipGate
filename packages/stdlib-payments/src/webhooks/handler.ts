/**
 * Webhook handler implementation
 * @packageDocumentation
 */

import { PaymentId, GatewayProvider } from '../types';
import { 
  WebhookEvent,
  WebhookEventType,
  WebhookHandler,
  WebhookHandlerResult,
  WebhookHandlerRegistry,
  WebhookMiddleware,
  WebhookMiddlewareStack,
  WebhookLog,
  WebhookLogger,
  WebhookMetrics,
  WebhookMetricsCollector
} from './types';
import { WebhookError } from '../errors';
import * as crypto from 'crypto';

// ============================================================================
// WEBHOOK HANDLER REGISTRY
// ============================================================================

export class DefaultWebhookHandlerRegistry implements WebhookHandlerRegistry {
  private handlers = new Map<WebhookEventType, WebhookHandler>();

  register(eventType: WebhookEventType, handler: WebhookHandler): void {
    this.handlers.set(eventType, handler);
  }

  unregister(eventType: WebhookEventType): void {
    this.handlers.delete(eventType);
  }

  async handle(event: WebhookEvent): Promise<WebhookHandlerResult> {
    const handler = this.handlers.get(event.eventType);
    
    if (!handler) {
      return {
        success: false,
        error: `No handler registered for event type: ${event.eventType}`,
      };
    }

    try {
      return await handler.handle(event);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Handler error',
      };
    }
  }

  listHandlers(): { eventType: WebhookEventType; handler: WebhookHandler }[] {
    return Array.from(this.handlers.entries()).map(([eventType, handler]) => ({
      eventType,
      handler,
    }));
  }
}

// ============================================================================
// WEBHOOK MIDDLEWARE STACK
// ============================================================================

export class DefaultWebhookMiddlewareStack implements WebhookMiddlewareStack {
  private middlewares: WebhookMiddleware[] = [];

  use(middleware: WebhookMiddleware): void {
    this.middlewares.push(middleware);
  }

  remove(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
  }

  async execute(
    event: WebhookEvent, 
    handler: WebhookHandler
  ): Promise<WebhookHandlerResult> {
    let currentEvent = event;
    let result: WebhookHandlerResult;

    try {
      // Execute before middleware
      for (const middleware of this.middlewares) {
        if (middleware.beforeHandle) {
          currentEvent = await middleware.beforeHandle(currentEvent);
        }
      }

      // Execute handler
      result = await handler.handle(currentEvent);

      // Execute after middleware
      for (const middleware of this.middlewares) {
        if (middleware.afterHandle) {
          result = await middleware.afterHandle(currentEvent, result);
        }
      }

      return result;

    } catch (error) {
      // Execute error middleware
      for (const middleware of this.middlewares) {
        if (middleware.onError) {
          await middleware.onError(currentEvent, error as Error);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================================================
// WEBHOOK LOGGER
// ============================================================================

export class DefaultWebhookLogger implements WebhookLogger {
  private logs: WebhookLog[] = [];
  private maxLogs = 1000;

  log(
    event: WebhookEvent,
    status: WebhookLog['status'],
    error?: string,
    duration?: number
  ): void {
    const log: WebhookLog = {
      id: crypto.randomBytes(16).toString('hex'),
      eventId: event.id,
      eventType: event.eventType,
      provider: event.provider,
      status,
      timestamp: new Date(),
      duration,
      error,
      metadata: event.metadata,
    };

    this.logs.push(log);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getLogs(filter?: {
    eventId?: string;
    eventType?: WebhookEventType;
    provider?: GatewayProvider;
    status?: WebhookLog['status'];
    from?: Date;
    to?: Date;
  }): WebhookLog[] {
    let logs = [...this.logs];

    if (filter) {
      if (filter.eventId) {
        logs = logs.filter(l => l.eventId === filter.eventId);
      }
      if (filter.eventType) {
        logs = logs.filter(l => l.eventType === filter.eventType);
      }
      if (filter.provider) {
        logs = logs.filter(l => l.provider === filter.provider);
      }
      if (filter.status) {
        logs = logs.filter(l => l.status === filter.status);
      }
      if (filter.from) {
        logs = logs.filter(l => l.timestamp >= filter.from!);
      }
      if (filter.to) {
        logs = logs.filter(l => l.timestamp <= filter.to!);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// ============================================================================
// WEBHOOK METRICS COLLECTOR
// ============================================================================

export class DefaultWebhookMetricsCollector implements WebhookMetricsCollector {
  private metrics: WebhookMetrics = {
    totalReceived: 0,
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    eventsByType: {} as Record<WebhookEventType, number>,
    errorsByType: {},
  };

  private processingTimes: number[] = [];
  private maxProcessingTimes = 100;

  recordEvent(
    event: WebhookEvent,
    processingTime: number,
    success: boolean
  ): void {
    // Update counters
    this.metrics.totalReceived++;
    
    if (success) {
      this.metrics.totalProcessed++;
    } else {
      this.metrics.totalFailed++;
    }

    // Update processing time
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > this.maxProcessingTimes) {
      this.processingTimes.shift();
    }
    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

    // Update events by type
    this.metrics.eventsByType[event.eventType] = 
      (this.metrics.eventsByType[event.eventType] || 0) + 1;

    // Update errors by type
    if (!success && event.data?.error?.type) {
      const errorType = event.data.error.type;
      this.metrics.errorsByType[errorType] = 
        (this.metrics.errorsByType[errorType] || 0) + 1;
    }
  }

  getMetrics(): WebhookMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalReceived: 0,
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      eventsByType: {} as Record<WebhookEventType, number>,
      errorsByType: {},
    };
    this.processingTimes = [];
  }
}

// ============================================================================
// DEFAULT WEBHOOK HANDLERS
// ============================================================================

export class PaymentIntentHandler implements WebhookHandler {
  async handle(event: WebhookEvent): Promise<WebhookHandlerResult> {
    const paymentIntent = event.data.object;

    switch (event.eventType) {
      case 'payment_intent.succeeded':
        return this.handlePaymentSucceeded(paymentIntent);
      
      case 'payment_intent.payment_failed':
        return this.handlePaymentFailed(paymentIntent);
      
      case 'payment_intent.requires_action':
        return this.handleRequiresAction(paymentIntent);
      
      default:
        return {
          success: true,
          data: `Unhandled payment intent event: ${event.eventType}`,
        };
    }
  }

  private async handlePaymentSucceeded(paymentIntent: any): Promise<WebhookHandlerResult> {
    // Update payment status in database
    // Send confirmation email
    // Update inventory
    // Trigger fulfillment
    
    return {
      success: true,
      data: {
        paymentId: paymentIntent.id,
        status: 'succeeded',
        amount: paymentIntent.amount,
      },
    };
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<WebhookHandlerResult> {
    // Update payment status
    // Notify customer
    // Log failure for analysis
    
    return {
      success: true,
      data: {
        paymentId: paymentIntent.id,
        status: 'failed',
        reason: paymentIntent.last_payment_error?.message,
      },
    };
  }

  private async handleRequiresAction(paymentIntent: any): Promise<WebhookHandlerResult> {
    // Notify customer to complete authentication
    // Update payment status
    
    return {
      success: true,
      data: {
        paymentId: paymentIntent.id,
        status: 'requires_action',
        nextAction: paymentIntent.next_action,
      },
    };
  }
}

export class ChargeHandler implements WebhookHandler {
  async handle(event: WebhookEvent): Promise<WebhookHandlerResult> {
    const charge = event.data.object;

    switch (event.eventType) {
      case 'charge.succeeded':
        return this.handleChargeSucceeded(charge);
      
      case 'charge.failed':
        return this.handleChargeFailed(charge);
      
      case 'charge.refunded':
        return this.handleChargeRefunded(charge);
      
      case 'charge.dispute.created':
        return this.handleDisputeCreated(charge);
      
      default:
        return {
          success: true,
          data: `Unhandled charge event: ${event.eventType}`,
        };
    }
  }

  private async handleChargeSucceeded(charge: any): Promise<WebhookHandlerResult> {
    // Process successful charge
    // Update order status
    // Send receipt
    
    return {
      success: true,
      data: {
        chargeId: charge.id,
        paymentIntentId: charge.payment_intent,
        amount: charge.amount,
        status: 'succeeded',
      },
    };
  }

  private async handleChargeFailed(charge: any): Promise<WebhookHandlerResult> {
    // Handle failed charge
    // Update order status
    // Notify customer
    
    return {
      success: true,
      data: {
        chargeId: charge.id,
        status: 'failed',
        failureCode: charge.failure_code,
        failureMessage: charge.failure_message,
      },
    };
  }

  private async handleChargeRefunded(charge: any): Promise<WebhookHandlerResult> {
    // Process refund
    // Update order status
    // Send refund confirmation
    
    return {
      success: true,
      data: {
        chargeId: charge.id,
        amountRefunded: charge.amount_refunded,
        refunds: charge.refunds?.data || [],
      },
    };
  }

  private async handleDisputeCreated(charge: any): Promise<WebhookHandlerResult> {
    // Handle dispute
    // Notify risk team
    // Gather evidence
    
    return {
      success: true,
      data: {
        chargeId: charge.id,
        dispute: charge.dispute,
      },
    };
  }
}

export class CheckoutSessionHandler implements WebhookHandler {
  async handle(event: WebhookEvent): Promise<WebhookHandlerResult> {
    const session = event.data.object;

    switch (event.eventType) {
      case 'checkout.session.completed':
        return this.handleSessionCompleted(session);
      
      case 'checkout.session.expired':
        return this.handleSessionExpired(session);
      
      default:
        return {
          success: true,
          data: `Unhandled checkout session event: ${event.eventType}`,
        };
    }
  }

  private async handleSessionCompleted(session: any): Promise<WebhookHandlerResult> {
    // Complete checkout
    // Create order
    // Send confirmation
    
    return {
      success: true,
      data: {
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        customer: session.customer,
        metadata: session.metadata,
      },
    };
  }

  private async handleSessionExpired(session: any): Promise<WebhookHandlerResult> {
    // Handle expired session
    // Clean up resources
    // Optionally notify customer
    
    return {
      success: true,
      data: {
        sessionId: session.id,
        expiredAt: new Date(session.expires_at * 1000),
      },
    };
  }
}

// ============================================================================
// BUILT-IN MIDDLEWARE
// ============================================================================

export class LoggingMiddleware implements WebhookMiddleware {
  name = 'logging';

  constructor(private logger: WebhookLogger) {}

  async beforeHandle(event: WebhookEvent): Promise<WebhookEvent> {
    this.logger.log(event, 'received');
    return event;
  }

  async afterHandle(
    event: WebhookEvent,
    result: WebhookHandlerResult
  ): Promise<WebhookHandlerResult> {
    this.logger.log(
      event,
      result.success ? 'processed' : 'failed',
      result.error
    );
    return result;
  }

  async onError(event: WebhookEvent, error: Error): Promise<void> {
    this.logger.log(event, 'failed', error.message);
  }
}

export class MetricsMiddleware implements WebhookMiddleware {
  name = 'metrics';

  constructor(
    private metrics: WebhookMetricsCollector,
    private startTime: number = Date.now()
  ) {}

  async afterHandle(
    event: WebhookEvent,
    result: WebhookHandlerResult
  ): Promise<WebhookHandlerResult> {
    const processingTime = Date.now() - this.startTime;
    this.metrics.recordEvent(event, processingTime, result.success);
    return result;
  }
}

export class DeduplicationMiddleware implements WebhookMiddleware {
  name = 'deduplication';
  private processedEvents = new Set<string>();
  private maxEvents = 10000;

  async beforeHandle(event: WebhookEvent): Promise<WebhookEvent> {
    if (this.processedEvents.has(event.id)) {
      throw new WebhookError(
        'Duplicate event',
        'duplicate_event',
        { eventId: event.id }
      );
    }

    this.processedEvents.add(event.id);

    // Clean up old events
    if (this.processedEvents.size > this.maxEvents) {
      const events = Array.from(this.processedEvents);
      this.processedEvents = new Set(events.slice(-this.maxEvents / 2));
    }

    return event;
  }
}
