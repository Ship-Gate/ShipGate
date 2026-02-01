domain Payments "Payment processing and billing" {
  
  type Money {
    amount: number
    currency: string
  }
  
  type PaymentMethod {
    id: string
    type: string
    last4: string
    expiryMonth: number
    expiryYear: number
    isDefault: boolean
  }
  
  type Payment {
    id: string
    amount: Money
    status: string
    methodId: string
    customerId: string
    createdAt: string
    completedAt?: string
    failureReason?: string
  }
  
  type Refund {
    id: string
    paymentId: string
    amount: Money
    reason: string
    status: string
    createdAt: string
  }
  
  behavior ChargePayment "Process a payment charge" (
    customerId: string,
    amount: Money,
    methodId: string
  ) returns Payment {
    pre customer_exists: Customer with id == customerId exists
    pre method_valid: PaymentMethod with id == methodId exists and belongs_to(customerId)
    pre method_not_expired: method.expiryYear > current_year or 
                           (method.expiryYear == current_year and method.expiryMonth >= current_month)
    pre amount_positive: amount.amount > 0
    pre currency_supported: amount.currency in ["USD", "EUR", "GBP"]
    
    post payment_created: Payment with customerId == customerId exists
    post payment_processing: payment.status in ["pending", "completed", "failed"]
    post audit_logged: AuditLog for payment exists
  }
  
  behavior RefundPayment "Issue a refund for a payment" (
    paymentId: string,
    amount: Money,
    reason: string
  ) returns Refund {
    pre payment_exists: Payment with id == paymentId exists
    pre payment_completed: payment.status == "completed"
    pre amount_valid: amount.amount <= payment.amount.amount
    pre not_already_refunded: total_refunds(paymentId) + amount.amount <= payment.amount.amount
    pre reason_provided: reason.length > 0
    
    post refund_created: Refund with paymentId == paymentId exists
    post refund_processing: refund.status in ["pending", "completed"]
    post customer_notified: notification_sent_to(payment.customerId)
    post balance_updated: customer_balance decreased by amount
  }
  
  behavior AddPaymentMethod "Add a new payment method" (
    customerId: string,
    token: string
  ) returns PaymentMethod {
    pre customer_exists: Customer with id == customerId exists
    pre token_valid: token is valid payment_token
    pre method_limit: count(PaymentMethod for customerId) < 10
    
    post method_created: PaymentMethod with customerId == customerId exists
    post token_consumed: token is invalidated
    post method_verified: method passes verification_check
  }
}
