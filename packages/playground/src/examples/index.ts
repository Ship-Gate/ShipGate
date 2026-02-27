export const EXAMPLES = {
  auth: {
    name: 'Authentication',
    description: 'User authentication and session management',
    code: `domain Auth "User authentication and session management" {
  
  type User {
    id: string
    email: string
    passwordHash: string
    createdAt: string
    lastLogin?: string
  }
  
  type Session {
    id: string
    userId: string
    token: string
    expiresAt: string
    createdAt: string
  }
  
  type LoginCredentials {
    email: string
    password: string
  }
  
  type AuthResult {
    user: User
    session: Session
    token: string
  }
  
  behavior Login "Authenticates user with email and password" (
    credentials: LoginCredentials
  ) returns AuthResult {
    pre user_exists: User with email == credentials.email exists
    pre password_valid: hash(credentials.password) == user.passwordHash
    pre account_not_locked: user.failedAttempts < 5
    
    post session_created: Session with userId == user.id is created
    post token_generated: result.token is valid JWT
    post last_login_updated: user.lastLogin == now()
  }
  
  behavior Logout "Terminates user session" (
    sessionId: string
  ) {
    pre session_exists: Session with id == sessionId exists
    pre session_valid: session.expiresAt > now()
    
    post session_destroyed: Session with id == sessionId not exists
    post token_invalidated: session.token is revoked
  }
  
  behavior Register "Creates new user account" (
    email: string,
    password: string
  ) returns User {
    pre email_unique: User with email == email not exists
    pre email_valid: email matches email_pattern
    pre password_strong: password.length >= 8 and has_special_char(password)
    
    post user_created: User with email == email exists
    post password_hashed: user.passwordHash != password
    post welcome_email_sent: email_sent_to(email)
  }
}`,
  },
  
  payments: {
    name: 'Payments',
    description: 'Payment processing and billing',
    code: `domain Payments "Payment processing and billing" {
  
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
  }
  
  behavior ChargePayment "Process a payment charge" (
    customerId: string,
    amount: Money,
    methodId: string
  ) returns Payment {
    pre customer_exists: Customer with id == customerId exists
    pre method_valid: PaymentMethod with id == methodId exists
    pre method_not_expired: method.expiryYear > current_year
    pre amount_positive: amount.amount > 0
    pre currency_supported: amount.currency in ["USD", "EUR", "GBP"]
    
    post payment_created: Payment exists
    post payment_processing: payment.status in ["pending", "completed", "failed"]
    post audit_logged: AuditLog for payment exists
  }
  
  behavior RefundPayment "Issue a refund" (
    paymentId: string,
    amount: Money,
    reason: string
  ) returns Refund {
    pre payment_exists: Payment with id == paymentId exists
    pre payment_completed: payment.status == "completed"
    pre amount_valid: amount.amount <= payment.amount.amount
    pre reason_provided: reason.length > 0
    
    post refund_created: Refund exists
    post customer_notified: notification sent
    post balance_updated: balance decreased by amount
  }
}`,
  },
  
  messaging: {
    name: 'Messaging',
    description: 'Real-time messaging system',
    code: `domain Messaging "Real-time messaging system" {
  
  type Message {
    id: string
    channelId: string
    authorId: string
    content: string
    createdAt: string
    editedAt?: string
  }
  
  type Channel {
    id: string
    name: string
    type: string
    members: string[]
  }
  
  behavior SendMessage "Send a message to a channel" (
    channelId: string,
    authorId: string,
    content: string
  ) returns Message {
    pre channel_exists: Channel with id == channelId exists
    pre author_is_member: authorId in channel.members
    pre content_not_empty: content.trim().length > 0
    pre content_not_too_long: content.length <= 4000
    
    post message_created: Message exists
    post members_notified: all members receive notification
    post unread_updated: unread count increased
  }
  
  behavior EditMessage "Edit an existing message" (
    messageId: string,
    userId: string,
    newContent: string
  ) returns Message {
    pre message_exists: Message with id == messageId exists
    pre is_author: message.authorId == userId
    pre within_edit_window: now() - message.createdAt < 24.hours
    
    post content_updated: message.content == newContent
    post edit_timestamp: message.editedAt == now()
  }
  
  behavior DeleteMessage "Delete a message" (
    messageId: string,
    userId: string
  ) {
    pre message_exists: Message with id == messageId exists
    pre has_permission: message.authorId == userId or user_is_admin(userId)
    
    post message_deleted: Message not exists
    post reactions_deleted: related reactions removed
  }
}`,
  },
  
  minimal: {
    name: 'Minimal',
    description: 'A minimal example to get started',
    code: `domain Counter "A simple counter domain" {
  
  type Counter {
    value: number
  }
  
  behavior Increment "Increase counter by one" (
    counterId: string
  ) returns Counter {
    pre counter_exists: Counter with id == counterId exists
    
    post value_increased: counter.value == old(counter.value) + 1
  }
  
  behavior Decrement "Decrease counter by one" (
    counterId: string
  ) returns Counter {
    pre counter_exists: Counter with id == counterId exists
    pre value_positive: counter.value > 0
    
    post value_decreased: counter.value == old(counter.value) - 1
  }
}`,
  },
} as const

export type ExampleKey = keyof typeof EXAMPLES
