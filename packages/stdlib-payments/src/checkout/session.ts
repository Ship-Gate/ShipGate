/**
 * Checkout session manager
 * @packageDocumentation
 */

import { 
  CheckoutSession, 
  CheckoutStatus, 
  Currency,
  PaymentId,
  PaymentMethodId,
  CustomerId
} from '../types';
import { GatewayAdapter, GatewayProvider } from '../types';
import { 
  CheckoutSessionOptions,
  CheckoutLineItem,
  CheckoutConfig
} from './types';
import { CartManager } from './cart';
import { CheckoutFlowManager } from './flow';
import { CheckoutError, ValidationError } from '../errors';

// ============================================================================
// CHECKOUT SESSION MANAGER
// ============================================================================

export class CheckoutSessionManager {
  private session: CheckoutSession;
  private cart: CartManager;
  private flow: CheckoutFlowManager;
  private config: CheckoutConfig;
  private gateway: GatewayAdapter;

  constructor(
    options: CheckoutSessionOptions,
    config: CheckoutConfig,
    gateway: GatewayAdapter
  ) {
    this.config = config;
    this.gateway = gateway;

    // Create cart
    this.cart = new CartManager({
      currency: config.defaultCurrency,
      customerId: options.customerId,
    });

    // Create session
    this.session = {
      id: Math.random().toString(36).substr(2, 9),
      status: CheckoutStatus.OPEN,
      currency: config.defaultCurrency,
      successUrl: options.successUrl,
      cancelUrl: options.cancelUrl,
      expiresAt: new Date(Date.now() + (options.expiresIn || 30) * 60 * 1000),
      createdAt: new Date(),
      gatewayProvider: gateway.config.provider,
      gatewaySessionId: '',
      customerId: options.customerId,
      metadata: {
        locale: options.locale,
        clientReferenceId: options.clientReferenceId,
        submitType: options.submitType,
        billingAddressCollection: options.billingAddressCollection,
        shippingAddressCollection: options.shippingAddressCollection,
        allowPromotionCodes: options.allowPromotionCodes,
      },
    };

    // Create flow
    this.flow = new CheckoutFlowManager(this.session.id, config);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get the checkout session
   */
  getSession(): CheckoutSession {
    // Update session with cart totals
    const cart = this.cart.getCart();
    this.session.amount = cart.total;
    
    return { ...this.session };
  }

  /**
   * Get session status
   */
  getStatus(): CheckoutStatus {
    // Check if session has expired
    if (this.session.status === CheckoutStatus.OPEN && new Date() > this.session.expiresAt) {
      this.session.status = CheckoutStatus.EXPIRED;
    }

    return this.session.status;
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    return new Date() > this.session.expiresAt;
  }

  /**
   * Extend session expiration
   */
  extendExpiration(minutes: number): void {
    if (this.session.status !== CheckoutStatus.OPEN) {
      throw new CheckoutError(
        'Cannot extend expired or completed session',
        'session_not_extendable',
        { sessionId: this.session.id }
      );
    }

    this.session.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  }

  /**
   * Cancel the session
   */
  cancel(): void {
    if (this.session.status !== CheckoutStatus.OPEN) {
      throw new CheckoutError(
        'Cannot cancel completed session',
        'already_completed',
        { sessionId: this.session.id }
      );
    }

    this.session.status = CheckoutStatus.EXPIRED;
  }

  // ============================================================================
  // CART MANAGEMENT
  // ============================================================================

  /**
   * Get cart manager
   */
  getCart(): CartManager {
    return this.cart;
  }

  /**
   * Add line item to checkout
   */
  addLineItem(item: CheckoutLineItem): void {
    if (item.currency !== this.session.currency) {
      throw new ValidationError(
        `Item currency ${item.currency} does not match session currency ${this.session.currency}`,
        'currency',
        item.currency,
        'currency_match'
      );
    }

    this.cart.addItem({
      productId: item.name, // Using name as productId for simplicity
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.amount,
      currency: item.currency,
      metadata: item.metadata,
    });
  }

  /**
   * Remove line item from checkout
   */
  removeLineItem(itemId: string): void {
    this.cart.removeItem(itemId);
  }

  /**
   * Update line item
   */
  updateLineItem(itemId: string, updates: Partial<CheckoutLineItem>): void {
    const updateOptions: any = {};
    
    if (updates.quantity !== undefined) {
      updateOptions.quantity = updates.quantity;
    }
    if (updates.amount !== undefined) {
      updateOptions.unitPrice = updates.amount;
    }
    if (updates.metadata !== undefined) {
      updateOptions.metadata = updates.metadata;
    }

    this.cart.updateItem(itemId, updateOptions);
  }

  // ============================================================================
  // FLOW MANAGEMENT
  // ============================================================================

  /**
   * Get flow manager
   */
  getFlow(): CheckoutFlowManager {
    return this.flow;
  }

  /**
   * Start checkout process
   */
  async start(): Promise<string> {
    if (this.session.status !== CheckoutStatus.OPEN) {
      throw new CheckoutError(
        'Session is not open',
        'session_not_open',
        { sessionId: this.session.id }
      );
    }

    // Validate cart
    if (!this.cart.isReadyForCheckout()) {
      throw new ValidationError(
        'Cart is not ready for checkout',
        'cart',
        null,
        'invalid'
      );
    }

    // Create checkout session with gateway
    const gatewaySession = await this.gateway.createCheckoutSession({
      currency: this.session.currency,
      amount: this.cart.getCart().total,
      successUrl: this.session.successUrl,
      cancelUrl: this.session.cancelUrl,
      expiresAt: this.session.expiresAt,
      customerId: this.session.customerId,
      metadata: this.session.metadata,
    });

    if (!gatewaySession.success) {
      throw new CheckoutError(
        'Failed to create gateway checkout session',
        'gateway_error',
        { sessionId: this.session.id }
      );
    }

    // Update session
    this.session.gatewaySessionId = gatewaySession.data!.gatewaySessionId;
    this.session.status = CheckoutStatus.PROCESSING;

    return gatewaySession.data!.gatewaySessionId;
  }

  /**
   * Complete checkout
   */
  async complete(paymentMethodId: PaymentMethodId): Promise<PaymentId> {
    if (this.session.status !== CheckoutStatus.PROCESSING) {
      throw new CheckoutError(
        'Session is not in processing state',
        'invalid_status',
        { sessionId: this.session.id }
      );
    }

    // Create payment
    const chargeResponse = await this.gateway.createCharge({
      amount: this.cart.getCart().total,
      currency: this.session.currency,
      paymentMethodId,
      customerId: this.session.customerId,
      description: `Checkout session ${this.session.id}`,
      metadata: {
        sessionId: this.session.id,
        clientReferenceId: this.session.metadata?.clientReferenceId,
      },
    });

    if (!chargeResponse.success) {
      this.session.status = CheckoutStatus.OPEN;
      throw new CheckoutError(
        'Payment failed',
        'payment_failed',
        { sessionId: this.session.id }
      );
    }

    // Update session
    this.session.status = CheckoutStatus.COMPLETE;
    this.session.completedAt = new Date();

    return chargeResponse.data!.payment.id;
  }

  // ============================================================================
  // SESSION RETRIEVAL
  // ============================================================================

  /**
   * Retrieve session from gateway
   */
  async retrieve(): Promise<CheckoutSession> {
    if (!this.session.gatewaySessionId) {
      return this.getSession();
    }

    // This would typically call the gateway to retrieve the session
    // For now, return the local session
    return this.getSession();
  }

  /**
   * Sync session status with gateway
   */
  async syncStatus(): Promise<CheckoutStatus> {
    if (!this.session.gatewaySessionId) {
      return this.getStatus();
    }

    // This would typically call the gateway to get the current status
    // For now, return the local status
    return this.getStatus();
  }

  // ============================================================================
  // URL GENERATION
  // ============================================================================

  /**
   * Get checkout URL
   */
  getCheckoutUrl(): string | null {
    if (!this.session.gatewaySessionId) {
      return null;
    }

    // Generate URL based on gateway
    switch (this.gateway.config.provider) {
      case GatewayProvider.STRIPE:
        return `https://checkout.stripe.com/pay/${this.session.gatewaySessionId}`;
      
      case GatewayProvider.PAYPAL:
        // PayPal URL would be returned from the gateway
        return this.session.successUrl; // Placeholder
      
      case GatewayProvider.MOCK:
        return `https://mock-checkout.example.com/${this.session.gatewaySessionId}`;
      
      default:
        return null;
    }
  }

  /**
   * Get success URL with session ID
   */
  getSuccessUrl(): string {
    const url = new URL(this.session.successUrl);
    url.searchParams.set('session_id', this.session.id);
    return url.toString();
  }

  /**
   * Get cancel URL with session ID
   */
  getCancelUrl(): string {
    const url = new URL(this.session.cancelUrl);
    url.searchParams.set('session_id', this.session.id);
    return url.toString();
  }

  // ============================================================================
  // METADATA
  // ============================================================================

  /**
   * Set metadata
   */
  setMetadata(key: string, value: any): void {
    this.session.metadata = {
      ...this.session.metadata,
      [key]: value,
    };
  }

  /**
   * Get metadata
   */
  getMetadata(key?: string): any {
    if (key) {
      return this.session.metadata?.[key];
    }
    return this.session.metadata;
  }

  /**
   * Clear metadata
   */
  clearMetadata(): void {
    this.session.metadata = {};
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate session
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check status
    if (this.session.status === CheckoutStatus.EXPIRED) {
      errors.push('Session has expired');
    }

    if (this.session.status === CheckoutStatus.COMPLETE) {
      errors.push('Session is already complete');
    }

    // Check cart
    const cartValidation = this.cart.validate();
    if (!cartValidation.valid) {
      errors.push(...cartValidation.errors);
    }

    // Check URLs
    try {
      new URL(this.session.successUrl);
    } catch {
      errors.push('Invalid success URL');
    }

    try {
      new URL(this.session.cancelUrl);
    } catch {
      errors.push('Invalid cancel URL');
    }

    // Check expiration
    if (this.isExpired()) {
      errors.push('Session has expired');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if ready for payment
   */
  isReadyForPayment(): boolean {
    const validation = this.validate();
    return validation.valid && this.session.status === CheckoutStatus.PROCESSING;
  }
}
