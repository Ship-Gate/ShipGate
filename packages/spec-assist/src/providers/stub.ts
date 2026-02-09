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
    isl: `domain Auth {
  version: "1.0.0"

  behavior CreateUser {
  input {
    email: String
    password: String
    name: String?
  }
  
  output {
    success: User
    errors {
      EMAIL_EXISTS { when: "Email already registered" }
      INVALID_EMAIL { when: "Invalid email format" }
      WEAK_PASSWORD { when: "Password does not meet requirements" }
    }
  }
  
  preconditions {
    - input.email.length > 0
    - input.password.length >= 8
  }
  
  postconditions {
    success implies {
      - result.email == input.email
    }
  }
  }
}`,
  },
  // Login patterns
  {
    pattern: /login|authenticate|signin/i,
    isl: `domain Auth {
  version: "1.0.0"

  behavior Login {
  input {
    email: String
    password: String
  }
  
  output {
    success: Session
    errors {
      INVALID_CREDENTIALS { when: "Invalid email or password" }
      ACCOUNT_SUSPENDED { when: "Account is suspended" }
      ACCOUNT_NOT_VERIFIED { when: "Email not verified" }
    }
  }
  
  preconditions {
    - input.email.length > 0
    - input.password.length > 0
  }
  
  postconditions {
    success implies {
      - result.user_id != null
    }
  }
  }
}`,
  },
  // CRUD patterns
  {
    pattern: /create|insert|add/i,
    isl: `domain Crud {
  version: "1.0.0"

  behavior Create {
  input {
    data: CreateInput
  }
  
  output {
    success: Item
    errors {
      VALIDATION_ERROR { when: "Invalid input data" }
      DUPLICATE { when: "Item already exists" }
    }
  }
  
  preconditions {
    - input.data != null
  }
  
  postconditions {
    success implies {
      - result.id != null
    }
  }
  }
}`,
  },
  // Update patterns
  {
    pattern: /update|edit|modify|patch/i,
    isl: `domain Crud {
  version: "1.0.0"

  behavior Update {
  input {
    id: ID
    data: UpdateInput
  }
  
  output {
    success: Item
    errors {
      NOT_FOUND { when: "Item not found" }
      VALIDATION_ERROR { when: "Invalid input data" }
      CONFLICT { when: "Concurrent modification detected" }
    }
  }
  
  preconditions {
    - input.id != null
  }
  
  postconditions {
    success implies {
      - result.id == input.id
    }
  }
  }
}`,
  },
  // Delete patterns
  {
    pattern: /delete|remove|destroy/i,
    isl: `domain Crud {
  version: "1.0.0"

  behavior Delete {
  input {
    id: ID
  }
  
  output {
    success: Boolean
    errors {
      NOT_FOUND { when: "Item not found" }
      CANNOT_DELETE { when: "Item cannot be deleted" }
    }
  }
  
  preconditions {
    - input.id != null
  }
  
  postconditions {
    success implies {
      - result == true
    }
  }
  }
}`,
  },
  // Payment patterns
  {
    pattern: /payment|charge|pay|transaction/i,
    isl: `domain Payments {
  version: "1.0.0"

  behavior ProcessPayment {
  input {
    amount: Money
    paymentMethodId: ID
    idempotencyKey: String
  }
  
  output {
    success: Transaction
    errors {
      INSUFFICIENT_FUNDS { when: "Insufficient funds" }
      INVALID_PAYMENT_METHOD { when: "Payment method not valid" }
      DUPLICATE_TRANSACTION { when: "Duplicate transaction" }
    }
  }
  
  preconditions {
    - input.amount != null
    - input.idempotencyKey.length > 0
  }
  
  postconditions {
    success implies {
      - result.id != null
    }
  }
  }
}`,
  },
  // Default fallback
  {
    pattern: /.*/,
    isl: `domain GeneratedDomain {
  version: "1.0.0"

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
      success: Item
      errors {
        NOT_FOUND { when: "Item not found" }
      }
    }
    
    preconditions {
      - input.itemId != null
    }
    
    postconditions {
      success implies {
        - result.id == input.itemId
      }
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
