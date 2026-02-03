/**
 * Stub Provider - Offline/Testing Provider
 * 
 * A deterministic provider for testing and offline development.
 * Returns pre-defined ISL templates based on input patterns.
 * 
 * This allows:
 * 1. Testing the validation pipeline without API calls
 * 2. Development without network access
 * 3. Consistent test fixtures
 */

import type { ChatMessage, CompletionOptions, SpecAssistConfig } from '../types.js';
import { BaseProvider, type ProviderResponse } from './base.js';

/**
 * Stub responses keyed by pattern matching
 */
interface StubResponse {
  pattern: RegExp;
  isl: string;
}

/**
 * Pre-defined stub responses
 */
const STUB_RESPONSES: StubResponse[] = [
  // Auth/User patterns
  {
    pattern: /createUser|register|signup|authentication/i,
    isl: `behavior CreateUser {
  input {
    email: String
    password: String
    name: String?
  }
  
  output {
    user: User
    token: AuthToken
  }
  
  errors {
    EMAIL_EXISTS: "Email already registered"
    INVALID_EMAIL: "Invalid email format"
    WEAK_PASSWORD: "Password does not meet requirements"
  }
  
  preconditions {
    require input.email.isValidEmail()
    require input.password.length >= 8
    require !exists(User where email == input.email)
  }
  
  postconditions {
    ensure result.user.email == input.email
    ensure result.user.status == "pending"
    ensure result.token.userId == result.user.id
    ensure verificationEmailSent(result.user.email)
  }
}`,
  },
  // Login patterns
  {
    pattern: /login|authenticate|signin/i,
    isl: `behavior Login {
  input {
    email: String
    password: String
  }
  
  output {
    user: User
    accessToken: AuthToken
    refreshToken: AuthToken
  }
  
  errors {
    INVALID_CREDENTIALS: "Invalid email or password"
    ACCOUNT_SUSPENDED: "Account is suspended"
    ACCOUNT_NOT_VERIFIED: "Email not verified"
  }
  
  preconditions {
    require input.email.length > 0
    require input.password.length > 0
  }
  
  postconditions {
    ensure result.user.email == input.email
    ensure result.user.status == "active"
    ensure result.accessToken.type == "access"
    ensure result.refreshToken.type == "refresh"
    ensure result.accessToken.expiresAt > now()
  }
}`,
  },
  // CRUD patterns
  {
    pattern: /create|insert|add/i,
    isl: `behavior Create {
  input {
    data: CreateInput
  }
  
  output {
    item: Item
  }
  
  errors {
    VALIDATION_ERROR: "Invalid input data"
    DUPLICATE: "Item already exists"
  }
  
  preconditions {
    require input.data != null
    require input.data.name.length > 0
  }
  
  postconditions {
    ensure result.item.id != null
    ensure result.item.createdAt == now()
  }
}`,
  },
  // Update patterns
  {
    pattern: /update|edit|modify|patch/i,
    isl: `behavior Update {
  input {
    id: ID
    data: UpdateInput
  }
  
  output {
    item: Item
  }
  
  errors {
    NOT_FOUND: "Item not found"
    VALIDATION_ERROR: "Invalid input data"
    CONFLICT: "Concurrent modification detected"
  }
  
  preconditions {
    require input.id != null
    require exists(Item where id == input.id)
  }
  
  postconditions {
    ensure result.item.id == input.id
    ensure result.item.updatedAt >= old(result.item.updatedAt)
  }
}`,
  },
  // Delete patterns
  {
    pattern: /delete|remove|destroy/i,
    isl: `behavior Delete {
  input {
    id: ID
  }
  
  output {
    success: Boolean
  }
  
  errors {
    NOT_FOUND: "Item not found"
    CANNOT_DELETE: "Item cannot be deleted"
  }
  
  preconditions {
    require input.id != null
    require exists(Item where id == input.id)
  }
  
  postconditions {
    ensure result.success implies !exists(Item where id == input.id)
  }
}`,
  },
  // Payment patterns
  {
    pattern: /payment|charge|pay|transaction/i,
    isl: `behavior ProcessPayment {
  input {
    amount: Money
    paymentMethodId: ID
    idempotencyKey: String
  }
  
  output {
    transaction: Transaction
  }
  
  errors {
    INSUFFICIENT_FUNDS: "Insufficient funds"
    INVALID_PAYMENT_METHOD: "Payment method not valid"
    DUPLICATE_TRANSACTION: "Duplicate transaction"
  }
  
  preconditions {
    require input.amount.value > 0
    require input.idempotencyKey.length > 0
    require exists(PaymentMethod where id == input.paymentMethodId)
  }
  
  postconditions {
    ensure result.transaction.amount == input.amount
    ensure result.transaction.status in ["pending", "completed"]
    ensure result.transaction.idempotencyKey == input.idempotencyKey
  }
}`,
  },
  // Default fallback
  {
    pattern: /.*/,
    isl: `domain GeneratedDomain {
  entity Item {
    id: ID
    name: String
    status: "active" | "inactive"
    createdAt: DateTime
    updatedAt: DateTime
  }
  
  behavior ProcessItem {
    input {
      itemId: ID
      action: String
    }
    
    output {
      item: Item
      success: Boolean
    }
    
    preconditions {
      require input.itemId != null
      require input.action.length > 0
    }
    
    postconditions {
      ensure result.item.id == input.itemId
      ensure result.success == true
    }
  }
}`,
  },
];

/**
 * Stub Provider Implementation
 */
export class StubProvider extends BaseProvider {
  readonly name = 'stub';
  private initialized = false;
  
  async initialize(_config: SpecAssistConfig): Promise<void> {
    this.config = _config;
    this.initialized = true;
  }
  
  isReady(): boolean {
    return this.initialized;
  }
  
  async complete(messages: ChatMessage[], _options?: CompletionOptions): Promise<ProviderResponse> {
    // Extract user message content to match against patterns
    const userMessage = messages.find(m => m.role === 'user')?.content ?? '';
    
    // Find matching stub response
    const match = STUB_RESPONSES.find(r => r.pattern.test(userMessage));
    const isl = match?.isl ?? STUB_RESPONSES[STUB_RESPONSES.length - 1]!.isl;
    
    // Simulate some latency
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      content: isl,
      tokens: {
        input: userMessage.length,
        output: isl.length,
      },
      model: 'stub-v1',
      metadata: {
        matchedPattern: match?.pattern.source ?? 'default',
      },
    };
  }
}

/**
 * Create stub provider for testing
 */
export function createStubProvider(): StubProvider {
  return new StubProvider();
}

// ============================================================================
// TEST FIXTURES - Invalid outputs for "reject slop" testing
// ============================================================================

/**
 * Invalid outputs that should be rejected by validation
 */
export const INVALID_OUTPUTS = {
  /** Prose with no ISL */
  proseOnly: `Here is my analysis of the code. The function appears to handle user authentication.
    
I would suggest adding proper error handling and validation.`,
  
  /** Markdown with explanations */
  markdownWithProse: `# ISL Specification

Here's the generated spec:

\`\`\`isl
domain Test {}
\`\`\`

This specification captures the key behaviors.`,
  
  /** Invalid JSON envelope (missing isl field) */
  invalidEnvelope: `{"reasoning": "The code handles auth", "confidence": 0.9}`,
  
  /** Empty response */
  empty: '',
  
  /** Just whitespace */
  whitespace: '   \n\n   ',
  
  /** Code in wrong language */
  wrongLanguage: `function createUser(email, password) {
  return { id: generateId(), email };
}`,
  
  /** Incomplete ISL */
  incompleteISL: `domain Test {
  entity User {
    id: ID`,
};
