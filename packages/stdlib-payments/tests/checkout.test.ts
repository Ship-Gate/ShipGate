/**
 * Checkout flow tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CartManager } from '../src/checkout/cart';
import { CheckoutFlowManager } from '../src/checkout/flow';
import { CheckoutConfig, CheckoutStep } from '../src/checkout/types';
import { MockGatewayAdapter } from '../src/gateway/mock';

describe('CartManager', () => {
  let cart: CartManager;

  beforeEach(() => {
    cart = new CartManager({ currency: 'USD' });
  });

  describe('item management', () => {
    it('should add items to cart', () => {
      const item = cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 2,
        unitPrice: 1000n, // $10.00
        currency: 'USD',
      });

      expect(item.quantity).toBe(2);
      expect(item.amount).toBe(2000n);
      expect(cart.getItemCount()).toBe(2);
    });

    it('should update item quantity', () => {
      const item = cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 1,
        unitPrice: 1000n,
        currency: 'USD',
      });

      const updated = cart.updateItem(item.id, { quantity: 3 });
      expect(updated.quantity).toBe(3);
      expect(updated.amount).toBe(3000n);
    });

    it('should remove items from cart', () => {
      const item = cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 1,
        unitPrice: 1000n,
        currency: 'USD',
      });

      cart.removeItem(item.id);
      expect(cart.getItems()).toHaveLength(0);
      expect(cart.getItemCount()).toBe(0);
    });

    it('should merge duplicate items', () => {
      cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 1,
        unitPrice: 1000n,
        currency: 'USD',
      });

      cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 2,
        unitPrice: 1000n,
        currency: 'USD',
      });

      expect(cart.getItems()).toHaveLength(1);
      expect(cart.getItems()[0].quantity).toBe(3);
    });
  });

  describe('calculations', () => {
    beforeEach(() => {
      cart.addItem({
        productId: 'prod_1',
        name: 'Product 1',
        quantity: 2,
        unitPrice: 1000n,
        currency: 'USD',
      });

      cart.addItem({
        productId: 'prod_2',
        name: 'Product 2',
        quantity: 1,
        unitPrice: 2000n,
        currency: 'USD',
      });
    });

    it('should calculate subtotal', () => {
      const calc = cart.calculateTotals();
      expect(calc.subtotal).toBe(4000n); // $40.00
    });

    it('should calculate tax', () => {
      cart.setTaxRate(10); // 10%
      const calc = cart.calculateTotals();
      expect(calc.tax).toBe(400n); // $4.00
    });

    it('should apply discount', () => {
      cart.addDiscount({
        id: 'disc_1',
        type: 'percentage',
        percentage: 10,
      });

      const calc = cart.calculateTotals();
      expect(calc.discount).toBe(400n); // 10% of $40
    });

    it('should apply shipping', () => {
      cart.setShippingOption({
        id: 'ship_1',
        name: 'Standard Shipping',
        amount: 500n,
        currency: 'USD',
      });

      const calc = cart.calculateTotals();
      expect(calc.shipping).toBe(500n);
    });

    it('should calculate total with all components', () => {
      cart.setTaxRate(10);
      cart.addDiscount({
        id: 'disc_1',
        type: 'percentage',
        percentage: 10,
      });
      cart.setShippingOption({
        id: 'ship_1',
        name: 'Standard Shipping',
        amount: 500n,
        currency: 'USD',
      });

      const calc = cart.calculateTotals();
      expect(calc.total).toBe(4500n); // $40 - $4 + $4 + $5
    });
  });

  describe('validation', () => {
    it('should validate empty cart', () => {
      const validation = cart.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Cart cannot be empty');
    });

    it('should validate cart with items', () => {
      cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 1,
        unitPrice: 1000n,
        currency: 'USD',
      });

      const validation = cart.validate();
      expect(validation.valid).toBe(true);
    });

    it('should check readiness for checkout', () => {
      expect(cart.isReadyForCheckout()).toBe(false);

      cart.addItem({
        productId: 'prod_1',
        name: 'Test Product',
        quantity: 1,
        unitPrice: 1000n,
        currency: 'USD',
      });

      expect(cart.isReadyForCheckout()).toBe(true);
    });
  });
});

describe('CheckoutFlowManager', () => {
  let flow: CheckoutFlowManager;
  let config: CheckoutConfig;

  beforeEach(() => {
    config = {
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD'],
      allowedPaymentMethods: ['card'],
      sessionTimeout: 30,
      maxCartItems: 100,
      requireCustomerEmail: true,
      requireBillingAddress: false,
      requireShippingAddress: false,
      collectShippingMethod: false,
      enableGuestCheckout: true,
      enablePromoCodes: false,
      enableSavedPaymentMethods: true,
      steps: [
        { step: 'cart', required: true, title: 'Cart' },
        { step: 'customer_info', required: true, title: 'Customer Information' },
        { step: 'payment_method', required: true, title: 'Payment Method' },
        { step: 'review', required: false, title: 'Review Order' },
        { step: 'payment', required: true, title: 'Payment' },
      ],
      taxes: { enabled: false },
      shipping: { enabled: false },
      discounts: { enabled: false },
    };

    flow = new CheckoutFlowManager('session_123', config);
  });

  describe('step navigation', () => {
    it('should start at first step', () => {
      expect(flow.getCurrentStep()).toBe('cart');
    });

    it('should move to next step', async () => {
      flow.completeStep();
      const next = await flow.nextStep();
      expect(next).toBe('customer_info');
    });

    it('should skip optional steps', async () => {
      // Complete required steps
      flow.completeStep(); // cart
      await flow.nextStep();
      flow.completeStep(); // customer_info
      await flow.nextStep();
      flow.completeStep(); // payment_method
      
      // Next should skip review and go to payment
      const next = await flow.nextStep();
      expect(next).toBe('payment');
    });

    it('should go back to previous step', () => {
      flow.jumpToStep('payment_method');
      const prev = flow.previousStep();
      expect(prev).toBe('customer_info');
    });

    it('should jump to accessible step', () => {
      flow.jumpToStep('payment_method');
      expect(flow.getCurrentStep()).toBe('payment_method');
    });

    it('should prevent jumping to inaccessible step', () => {
      expect(() => flow.jumpToStep('payment')).toThrow();
    });

    describe('step completion', () => {
      it('should complete current step', () => {
        flow.completeStep({ email: 'test@example.com' });
        expect(flow.isStepCompleted('cart')).toBe(true);
        expect(flow.getStepData()).toEqual({ email: 'test@example.com' });
      });

      it('should validate required steps', () => {
        // Try to move to next step without completing
        expect(() => flow.nextStep()).toThrow();
      });
    });

    describe('progress tracking', () => {
      it('should calculate progress', () => {
        expect(flow.getProgress()).toBe(0);
      });

      it('should update progress as steps complete', async () => {
        flow.completeStep();
        await flow.nextStep();
        flow.completeStep();
        
        // 2 of 4 required steps complete
        expect(flow.getProgress()).toBe(0.5);
      });

      it('should detect completion', async () => {
        // Complete all steps
        flow.completeStep(); // cart
        await flow.nextStep();
        flow.completeStep(); // customer_info
        await flow.nextStep();
        flow.completeStep(); // payment_method
        await flow.nextStep();
        flow.completeStep(); // payment
        
        expect(flow.isComplete()).toBe(true);
      });
    });
  });

  describe('convenience methods', () => {
    it('should store and retrieve customer info', () => {
      const customerInfo = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      flow.setCustomerInfo(customerInfo);
      expect(flow.getCustomerInfo()).toEqual(customerInfo);
    });

    it('should store and retrieve payment method', () => {
      const paymentMethod = {
        type: 'card' as const,
        paymentMethodId: 'pm_123',
      };

      flow.setPaymentMethod(paymentMethod);
      expect(flow.getPaymentMethod()).toEqual(paymentMethod);
    });
  });
});
