/**
 * Cart implementation with tax and discount calculations
 * @packageDocumentation
 */

import { Cart, CartItem, Currency } from '../types';
import { MoneyValue } from '../money';
import { 
  CartOptions, 
  AddCartItemOptions, 
  UpdateCartItemOptions, 
  CartCalculation,
  Discount,
  ShippingOption
} from './types';
import { ValidationError } from '../errors';

// ============================================================================
// CART CLASS
// ============================================================================

export class CartManager {
  private cart: Cart;
  private discounts: Discount[] = [];
  private shippingOption?: ShippingOption;
  private taxRate: number = 0;

  constructor(options: CartOptions) {
    this.cart = {
      id: uuidv4(),
      customerId: options.customerId,
      items: [],
      currency: options.currency,
      subtotal: 0n,
      tax: 0n,
      discount: 0n,
      total: 0n,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ============================================================================
  // CART MANAGEMENT
  // ============================================================================

  /**
   * Get the cart
   */
  getCart(): Cart {
    this.calculateTotals();
    return { ...this.cart };
  }

  /**
   * Add an item to the cart
   */
  addItem(options: AddCartItemOptions): CartItem {
    if (options.currency !== this.cart.currency) {
      throw new ValidationError(
        `Item currency ${options.currency} does not match cart currency ${this.cart.currency}`,
        'currency',
        options.currency,
        'currency_match'
      );
    }

    if (options.quantity <= 0) {
      throw new ValidationError(
        'Item quantity must be greater than 0',
        'quantity',
        options.quantity,
        'positive'
      );
    }

    if (options.unitPrice <= 0) {
      throw new ValidationError(
        'Item unit price must be greater than 0',
        'unitPrice',
        options.unitPrice,
        'positive'
      );
    }

    // Check if item already exists
    const existingItem = this.cart.items.find(item => item.productId === options.productId);
    
    if (existingItem) {
      // Update existing item
      existingItem.quantity += options.quantity;
      existingItem.amount = existingItem.unitPrice * existingItem.quantity;
      existingItem.updatedAt = new Date();
    } else {
      // Create new item
      const newItem: CartItem = {
        id: Math.random().toString(36).substr(2, 9),
        productId: options.productId,
        name: options.name,
        description: options.description,
        quantity: options.quantity,
        unitPrice: options.unitPrice,
        amount: options.unitPrice * options.quantity,
        currency: options.currency,
        taxRate: options.taxRate,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: options.metadata,
      };

      this.cart.items.push(newItem);
    }

    this.cart.updatedAt = new Date();
    this.calculateTotals();

    return this.cart.items.find(item => item.productId === options.productId)!;
  }

  /**
   * Update an item in the cart
   */
  updateItem(itemId: string, options: UpdateCartItemOptions): CartItem {
    const item = this.cart.items.find(item => item.id === itemId);
    
    if (!item) {
      throw new ValidationError(
        'Item not found in cart',
        'itemId',
        itemId,
        'exists'
      );
    }

    if (options.quantity !== undefined) {
      if (options.quantity <= 0) {
        throw new ValidationError(
          'Item quantity must be greater than 0',
          'quantity',
          options.quantity,
          'positive'
        );
      }
      item.quantity = options.quantity;
    }

    if (options.unitPrice !== undefined) {
      if (options.unitPrice <= 0) {
        throw new ValidationError(
          'Item unit price must be greater than 0',
          'unitPrice',
          options.unitPrice,
          'positive'
        );
      }
      item.unitPrice = options.unitPrice;
    }

    if (options.metadata !== undefined) {
      item.metadata = { ...item.metadata, ...options.metadata };
    }

    // Recalculate amount
    item.amount = item.unitPrice * item.quantity;
    item.updatedAt = new Date();

    this.cart.updatedAt = new Date();
    this.calculateTotals();

    return item;
  }

  /**
   * Remove an item from the cart
   */
  removeItem(itemId: string): void {
    const index = this.cart.items.findIndex(item => item.id === itemId);
    
    if (index === -1) {
      throw new ValidationError(
        'Item not found in cart',
        'itemId',
        itemId,
        'exists'
      );
    }

    this.cart.items.splice(index, 1);
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  /**
   * Clear all items from the cart
   */
  clear(): void {
    this.cart.items = [];
    this.discounts = [];
    this.shippingOption = undefined;
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  /**
   * Get an item by ID
   */
  getItem(itemId: string): CartItem | undefined {
    return this.cart.items.find(item => item.id === itemId);
  }

  /**
   * Get all items
   */
  getItems(): CartItem[] {
    return [...this.cart.items];
  }

  /**
   * Get item count
   */
  getItemCount(): number {
    return this.cart.items.reduce((count, item) => count + item.quantity, 0);
  }

  // ============================================================================
  // DISCOUNT MANAGEMENT
  // ============================================================================

  /**
   * Add a discount to the cart
   */
  addDiscount(discount: Discount): void {
    // Check if discount already exists
    const existingDiscount = this.discounts.find(d => d.id === discount.id);
    
    if (existingDiscount) {
      throw new ValidationError(
        'Discount already applied to cart',
        'discountId',
        discount.id,
        'unique'
      );
    }

    this.discounts.push(discount);
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  /**
   * Remove a discount from the cart
   */
  removeDiscount(discountId: string): void {
    const index = this.discounts.findIndex(d => d.id === discountId);
    
    if (index === -1) {
      throw new ValidationError(
        'Discount not found in cart',
        'discountId',
        discountId,
        'exists'
      );
    }

    this.discounts.splice(index, 1);
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  /**
   * Get all discounts
   */
  getDiscounts(): Discount[] {
    return [...this.discounts];
  }

  /**
   * Clear all discounts
   */
  clearDiscounts(): void {
    this.discounts = [];
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  // ============================================================================
  // SHIPPING MANAGEMENT
  // ============================================================================

  /**
   * Set shipping option
   */
  setShippingOption(option: ShippingOption): void {
    if (option.currency !== this.cart.currency) {
      throw new ValidationError(
        `Shipping currency ${option.currency} does not match cart currency ${this.cart.currency}`,
        'currency',
        option.currency,
        'currency_match'
      );
    }

    this.shippingOption = option;
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  /**
   * Get current shipping option
   */
  getShippingOption(): ShippingOption | undefined {
    return this.shippingOption;
  }

  /**
   * Clear shipping option
   */
  clearShippingOption(): void {
    this.shippingOption = undefined;
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  // ============================================================================
  // TAX MANAGEMENT
  // ============================================================================

  /**
   * Set tax rate (as percentage, e.g., 8.25 for 8.25%)
   */
  setTaxRate(rate: number): void {
    if (rate < 0 || rate > 100) {
      throw new ValidationError(
        'Tax rate must be between 0 and 100',
        'rate',
        rate,
        'range'
      );
    }

    this.taxRate = rate;
    this.cart.updatedAt = new Date();
    this.calculateTotals();
  }

  /**
   * Get current tax rate
   */
  getTaxRate(): number {
    return this.taxRate;
  }

  // ============================================================================
  // CALCULATIONS
  // ============================================================================

  /**
   * Calculate cart totals
   */
  calculateTotals(): CartCalculation {
    // Calculate subtotal
    const subtotal = this.cart.items.reduce((sum, item) => sum + item.amount, 0n);

    // Calculate tax
    let tax = 0n;
    if (this.taxRate > 0) {
      tax = this.calculateTax(subtotal);
    }

    // Calculate discount
    let discount = 0n;
    if (this.discounts.length > 0) {
      discount = this.calculateDiscount(subtotal);
    }

    // Calculate shipping
    const shipping = this.shippingOption ? this.shippingOption.amount : 0n;

    // Apply free shipping threshold if applicable
    let finalShipping = shipping;
    if (shipping > 0n && this.isFreeShippingApplicable(subtotal - discount)) {
      finalShipping = 0n;
    }

    // Calculate total
    const total = subtotal + tax - discount + finalShipping;

    // Update cart
    this.cart.subtotal = subtotal;
    this.cart.tax = tax;
    this.cart.discount = discount;
    this.cart.total = total;

    return {
      subtotal,
      tax,
      discount,
      shipping: finalShipping,
      total,
      breakdown: {
        items: subtotal,
        tax,
        discount,
        shipping: finalShipping,
      },
    };
  }

  /**
   * Calculate tax amount
   */
  private calculateTax(amount: bigint): bigint {
    // Use MoneyValue for precise calculation
    const money = new MoneyValue(amount, this.cart.currency);
    const taxAmount = money.percentage(this.taxRate);
    return taxAmount.amount;
  }

  /**
   * Calculate discount amount
   */
  private calculateDiscount(subtotal: bigint): bigint {
    let totalDiscount = 0n;

    for (const discount of this.discounts) {
      let discountAmount = 0n;

      if (discount.type === 'fixed_amount' && discount.amount) {
        discountAmount = discount.amount;
      } else if (discount.type === 'percentage' && discount.percentage) {
        const money = new MoneyValue(subtotal, this.cart.currency);
        discountAmount = money.percentage(discount.percentage).amount;
      }

      totalDiscount += discountAmount;
    }

    // Don't discount more than the subtotal
    return totalDiscount > subtotal ? subtotal : totalDiscount;
  }

  /**
   * Check if free shipping is applicable
   */
  private isFreeShippingApplicable(amount: bigint): boolean {
    // This would typically check against a configuration threshold
    // For now, we'll use a default of $100
    const freeShippingThreshold = new MoneyValue(10000, this.cart.currency); // $100.00
    return new MoneyValue(amount, this.cart.currency).greaterThanOrEqual(freeShippingThreshold);
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate cart state
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if cart has items
    if (this.cart.items.length === 0) {
      errors.push('Cart cannot be empty');
    }

    // Check item quantities
    for (const item of this.cart.items) {
      if (item.quantity <= 0) {
        errors.push(`Item ${item.name} has invalid quantity`);
      }
      if (item.unitPrice <= 0) {
        errors.push(`Item ${item.name} has invalid price`);
      }
    }

    // Check discounts
    for (const discount of this.discounts) {
      if (discount.type === 'percentage' && (!discount.percentage || discount.percentage <= 0 || discount.percentage > 100)) {
        errors.push(`Discount ${discount.id} has invalid percentage`);
      }
      if (discount.type === 'fixed_amount' && (!discount.amount || discount.amount <= 0)) {
        errors.push(`Discount ${discount.id} has invalid amount`);
      }
    }

    // Check shipping
    if (this.shippingOption && this.shippingOption.amount < 0) {
      errors.push('Shipping amount cannot be negative');
    }

    // Check totals
    if (this.cart.total < 0) {
      errors.push('Cart total cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if cart is ready for checkout
   */
  isReadyForCheckout(): boolean {
    const validation = this.validate();
    return validation.valid && this.cart.total > 0;
  }
}
