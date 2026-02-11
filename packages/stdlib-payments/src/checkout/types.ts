/**
 * Checkout types
 * @packageDocumentation
 */

import { CheckoutSession, CheckoutStatus, Cart, CartItem, Currency, PaymentMethodId, CustomerId } from '../types';

// ============================================================================
// CHECKOUT SESSION TYPES
// ============================================================================

export interface CheckoutSessionOptions {
  successUrl: string;
  cancelUrl: string;
  expiresIn?: number; // Minutes, default: 30
  locale?: string;
  customerEmail?: string;
  clientReferenceId?: string;
  submitType?: 'auto' | 'book' | 'donate' | 'pay';
  billingAddressCollection?: 'auto' | 'required';
  shippingAddressCollection?: 'required';
  allowPromotionCodes?: boolean;
  paymentMethodTypes?: PaymentMethodType[];
}

export type PaymentMethodType = 'card' | 'sepa_debit' | 'ideal' | 'sofort' | 'bancontact' | 'giropay' | 'eps' | 'p24' | 'alipay' | 'grabpay' | 'afterpay_clearpay' | 'klarna';

export interface CheckoutLineItem {
  name: string;
  description?: string;
  images?: string[];
  amount: bigint;
  currency: Currency;
  quantity: number;
  taxRates?: TaxRate[];
  metadata?: Record<string, string>;
}

export interface TaxRate {
  id: string;
  displayName: string;
  percentage: number;
  inclusive: boolean;
  jurisdiction?: string;
}

// ============================================================================
// CART TYPES
// ============================================================================

export interface CartOptions {
  currency: Currency;
  customerId?: CustomerId;
  metadata?: Record<string, string>;
}

export interface AddCartItemOptions {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: bigint;
  currency: Currency;
  taxRate?: number;
  metadata?: Record<string, string>;
}

export interface UpdateCartItemOptions {
  quantity?: number;
  unitPrice?: bigint;
  metadata?: Record<string, string>;
}

export interface CartCalculation {
  subtotal: bigint;
  tax: bigint;
  discount: bigint;
  shipping: bigint;
  total: bigint;
  breakdown: {
    items: bigint;
    tax: bigint;
    discount: bigint;
    shipping: bigint;
  };
}

export interface Discount {
  id: string;
  code?: string;
  type: 'percentage' | 'fixed_amount';
  amount?: bigint;
  percentage?: number;
  metadata?: Record<string, string>;
}

export interface ShippingOption {
  id: string;
  name: string;
  description?: string;
  amount: bigint;
  currency: Currency;
  deliveryEstimate?: {
    minimum: {
      unit: 'business_day' | 'day';
      value: number;
    };
    maximum: {
      unit: 'business_day' | 'day';
      value: number;
    };
  };
}

// ============================================================================
// FLOW STATE MACHINE TYPES
// ============================================================================

export interface CheckoutFlow {
  sessionId: string;
  currentStep: CheckoutStep;
  completedSteps: CheckoutStep[];
  pendingSteps: CheckoutStep[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type CheckoutStep = 
  | 'cart'
  | 'customer_info'
  | 'shipping_address'
  | 'billing_address'
  | 'shipping_method'
  | 'payment_method'
  | 'review'
  | 'payment'
  | 'confirmation'
  | 'complete';

export interface CheckoutStepConfig {
  step: CheckoutStep;
  required: boolean;
  title: string;
  description?: string;
  skipConditions?: SkipCondition[];
  validation?: StepValidation;
}

export interface SkipCondition {
  type: 'cart_total' | 'item_type' | 'customer_type' | 'digital_only';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface StepValidation {
  rules: ValidationRule[];
  errorMessage?: string;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'phone' | 'postal_code' | 'country' | 'min_length' | 'max_length';
  value?: any;
  message?: string;
}

// ============================================================================
// CHECKOUT EVENTS
// ============================================================================

export interface CheckoutEvent {
  type: CheckoutEventType;
  sessionId: string;
  timestamp: Date;
  data?: any;
  previousState?: CheckoutStatus;
  newState?: CheckoutStatus;
}

export type CheckoutEventType = 
  | 'session_created'
  | 'session_expired'
  | 'step_started'
  | 'step_completed'
  | 'step_skipped'
  | 'payment_method_added'
  | 'payment_method_failed'
  | 'payment_initiated'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'order_created'
  | 'checkout_completed'
  | 'checkout_abandoned';

// ============================================================================
// CHECKOUT CONFIGURATION
// ============================================================================

export interface CheckoutConfig {
  defaultCurrency: Currency;
  supportedCurrencies: Currency[];
  allowedPaymentMethods: PaymentMethodType[];
  sessionTimeout: number; // Minutes
  maxCartItems: number;
  requireCustomerEmail: boolean;
  requireBillingAddress: boolean;
  requireShippingAddress: boolean;
  collectShippingMethod: boolean;
  enableGuestCheckout: boolean;
  enablePromoCodes: boolean;
  enableSavedPaymentMethods: boolean;
  steps: CheckoutStepConfig[];
  taxes: {
    enabled: boolean;
    defaultRate?: number;
    taxRates?: TaxRate[];
  };
  shipping: {
    enabled: boolean;
    freeShippingThreshold?: bigint;
    defaultOptions?: ShippingOption[];
  };
  discounts: {
    enabled: boolean;
    allowCombination: boolean;
    maxDiscounts?: number;
  };
}

// ============================================================================
// ADDRESS TYPES
// ============================================================================

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface ShippingAddress extends Address {
  name: string;
  phone?: string;
  instructions?: string;
}

export interface BillingAddress extends Address {
  name: string;
}

// ============================================================================
// CUSTOMER INFO TYPES
// ============================================================================

export interface CustomerInfo {
  id?: CustomerId;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// PAYMENT INFO TYPES
// ============================================================================

export interface PaymentMethodInfo {
  type: PaymentMethodType;
  paymentMethodId?: PaymentMethodId;
  savePaymentMethod?: boolean;
  setupFutureUsage?: 'off_session' | 'on_session';
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: BillingAddress;
  };
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface Order {
  id: string;
  sessionId: string;
  customerId?: CustomerId;
  status: OrderStatus;
  currency: Currency;
  amount: bigint;
  items: OrderItem[];
  shipping?: ShippingInfo;
  billing?: BillingInfo;
  payment?: PaymentInfo;
  discounts: Discount[];
  tax: bigint;
  shippingAmount: bigint;
  total: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: bigint;
  amount: bigint;
  tax: bigint;
  total: bigint;
  metadata?: Record<string, string>;
}

export interface ShippingInfo {
  method: ShippingOption;
  address: ShippingAddress;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
}

export interface BillingInfo {
  address: BillingAddress;
  paymentMethod: PaymentMethodInfo;
}

export interface PaymentInfo {
  id: string;
  amount: bigint;
  currency: Currency;
  status: string;
  paymentMethodId: PaymentMethodId;
  gateway: string;
  gatewayTransactionId: string;
  createdAt: Date;
}
