// ============================================================================
// Fixture Tests - Must pass all shared fixtures
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

// Import fixtures from master contracts
const MINIMAL_DOMAIN = `
domain Minimal {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable, unique]
    name: String
  }
}
`;

const TYPES_DOMAIN = `
domain Types {
  version: "1.0.0"
  
  type Email = String {
    max_length: 254
  }
  
  type Money = Decimal {
    precision: 2
    min: 0
  }
  
  type Percentage = Decimal {
    min: 0
    max: 100
  }
  
  type UserId = UUID {
    immutable: true
  }
  
  enum Status {
    ACTIVE
    INACTIVE
    SUSPENDED
  }
  
  enum Currency {
    USD
    EUR
    GBP
  }
  
  type Address = {
    line1: String
    city: String
    country: String
  }
}
`;

const BEHAVIOR_DOMAIN = `
domain Auth {
  version: "1.0.0"
  
  type Email = String {
    max_length: 254
  }
  
  type Password = String {
    min_length: 8
    max_length: 128
  }
  
  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String [secret]
    status: String
    failed_attempts: Int
    locked_until: Timestamp?
    created_at: Timestamp [immutable]
    last_login: Timestamp?
    
    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
    }
    
    lifecycle {
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> DELETED
    }
  }
  
  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
    DELETED
  }
  
  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [immutable]
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    revoked: Boolean
    ip_address: String [pii]
    user_agent: String
  }
  
  behavior Login {
    description: "Authenticate user and create session"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String
      password: String [sensitive]
    }
    
    output {
      success: Session
      
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Too many failed attempts"
          retriable: true
          retry_after: 15.minutes
        }
        ACCOUNT_SUSPENDED {
          when: "Account has been suspended"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.email.is_valid
      input.password.length >= 8
    }
    
    postconditions {
      success implies {
        Session.exists(result.id)
      }
      
      INVALID_CREDENTIALS implies {
        User.lookup(input.email).failed_attempts == old(User.lookup(input.email).failed_attempts) + 1
      }
      
      any_error implies {
        Session.count == old(Session.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
    }
    
    temporal {
      response within 200ms
      response within 1.seconds
      eventually within 5.seconds: audit_log_created
    }
    
    security {
      rate_limit 10 per input.email
      rate_limit 100 per ip_address
    }
  }
  
  behavior Logout {
    description: "Revoke user session"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      session_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
      }
    }
    
    preconditions {
      Session.exists(input.session_id)
      Session.lookup(input.session_id).revoked == false
    }
    
    postconditions {
      success implies {
        Session.lookup(input.session_id).revoked == true
      }
    }
    
    temporal {
      immediately: session_invalid_for_new_requests
      eventually within 1.minutes: session_removed_from_cache
    }
  }
}
`;

const SCENARIOS_DOMAIN = `
domain Payment {
  version: "1.0.0"
  
  type Money = Decimal { min: 0 }
  
  entity Payment {
    id: UUID [immutable, unique]
    amount: Decimal
    status: String
    created_at: Timestamp [immutable]
  }
  
  enum PaymentStatus {
    PENDING
    COMPLETED
    FAILED
  }
  
  behavior CreatePayment {
    input {
      amount: Decimal
      idempotency_key: String
    }
    
    output {
      success: Payment
      errors {
        DUPLICATE { when: "Idempotency key reused" }
      }
    }
    
    postconditions {
      success implies {
        Payment.exists(result.id)
        Payment.lookup(result.id).amount == input.amount
      }
    }
  }
  
  scenarios CreatePayment {
    scenario "successful payment" {
      given {
        initial_count = Payment.count
      }
      
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "test-1")
      }
      
      then {
        result is success
        Payment.count == initial_count + 1
      }
    }
    
    scenario "duplicate idempotency key" {
      given {
        existing = CreatePayment(amount: 50.00, idempotency_key: "dupe-key")
      }
      
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "dupe-key")
      }
      
      then {
        result is DUPLICATE
        Payment.count == old(Payment.count)
      }
    }
  }
  
  chaos CreatePayment {
    chaos "database failure" {
      inject {
        database_failure(target: PaymentRepository, mode: UNAVAILABLE)
      }
      
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "chaos-1")
      }
      
      then {
        result is error
        Payment.count == old(Payment.count)
      }
    }
  }
}
`;

describe('Fixture Tests', () => {
  describe('MINIMAL_DOMAIN', () => {
    it('should parse without errors', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      expect(result.success).toBe(true);
      expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    it('should have correct domain name', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      expect(result.domain?.name.name).toBe('Minimal');
    });

    it('should have correct version', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      expect(result.domain?.version.value).toBe('1.0.0');
    });

    it('should have one entity', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      expect(result.domain?.entities).toHaveLength(1);
    });

    it('should have User entity with correct fields', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      const user = result.domain?.entities[0];
      expect(user?.name.name).toBe('User');
      expect(user?.fields).toHaveLength(2);
      
      const idField = user?.fields.find(f => f.name.name === 'id');
      expect(idField?.type.kind).toBe('PrimitiveType');
      if (idField?.type.kind === 'PrimitiveType') {
        expect(idField.type.name).toBe('UUID');
      }
      expect(idField?.annotations).toHaveLength(2);
      
      const nameField = user?.fields.find(f => f.name.name === 'name');
      expect(nameField?.type.kind).toBe('PrimitiveType');
    });
  });

  describe('TYPES_DOMAIN', () => {
    it('should parse without errors', () => {
      const result = parse(TYPES_DOMAIN);
      
      expect(result.success).toBe(true);
    });

    it('should parse constrained types', () => {
      const result = parse(TYPES_DOMAIN);
      
      expect(result.domain?.types.length).toBeGreaterThanOrEqual(4);
      
      const email = result.domain?.types.find(t => t.name.name === 'Email');
      expect(email?.definition.kind).toBe('ConstrainedType');
    });

    it('should parse enum types', () => {
      const result = parse(TYPES_DOMAIN);
      
      const status = result.domain?.types.find(t => t.name.name === 'Status');
      expect(status?.definition.kind).toBe('EnumType');
      
      if (status?.definition.kind === 'EnumType') {
        expect(status.definition.variants).toHaveLength(3);
        expect(status.definition.variants.map(v => v.name.name)).toEqual([
          'ACTIVE', 'INACTIVE', 'SUSPENDED'
        ]);
      }
    });

    it('should parse struct types', () => {
      const result = parse(TYPES_DOMAIN);
      
      const address = result.domain?.types.find(t => t.name.name === 'Address');
      expect(address?.definition.kind).toBe('StructType');
      
      if (address?.definition.kind === 'StructType') {
        expect(address.definition.fields).toHaveLength(3);
      }
    });
  });

  describe('BEHAVIOR_DOMAIN', () => {
    it('should parse without errors', () => {
      const result = parse(BEHAVIOR_DOMAIN);
      
      expect(result.success).toBe(true);
    });

    it('should parse behaviors', () => {
      const result = parse(BEHAVIOR_DOMAIN);
      
      expect(result.domain?.behaviors).toHaveLength(2);
    });

    it('should parse Login behavior correctly', () => {
      const result = parse(BEHAVIOR_DOMAIN);
      
      const login = result.domain?.behaviors.find(b => b.name.name === 'Login');
      expect(login).toBeDefined();
      expect(login?.description?.value).toBe('Authenticate user and create session');
      expect(login?.input.fields).toHaveLength(2);
      expect(login?.output.errors).toHaveLength(3);
      expect(login?.preconditions.length).toBeGreaterThanOrEqual(1);
      expect(login?.postconditions.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse entities with invariants and lifecycle', () => {
      const result = parse(BEHAVIOR_DOMAIN);
      
      const user = result.domain?.entities.find(e => e.name.name === 'User');
      expect(user?.invariants.length).toBeGreaterThanOrEqual(1);
      expect(user?.lifecycle).toBeDefined();
    });

    it('should parse error specs with retry_after', () => {
      const result = parse(BEHAVIOR_DOMAIN);
      
      const login = result.domain?.behaviors.find(b => b.name.name === 'Login');
      const lockedError = login?.output.errors.find(e => e.name.name === 'ACCOUNT_LOCKED');
      
      expect(lockedError?.retriable).toBe(true);
      expect(lockedError?.retryAfter).toBeDefined();
    });
  });

  describe('SCENARIOS_DOMAIN', () => {
    it('should parse without errors', () => {
      const result = parse(SCENARIOS_DOMAIN);
      
      expect(result.success).toBe(true);
    });

    it('should parse scenario blocks', () => {
      const result = parse(SCENARIOS_DOMAIN);
      
      expect(result.domain?.scenarios).toHaveLength(1);
      
      const scenarioBlock = result.domain?.scenarios[0];
      expect(scenarioBlock?.behaviorName.name).toBe('CreatePayment');
      expect(scenarioBlock?.scenarios).toHaveLength(2);
    });

    it('should parse scenario given/when/then', () => {
      const result = parse(SCENARIOS_DOMAIN);
      
      const scenario = result.domain?.scenarios[0]?.scenarios[0];
      expect(scenario?.name.value).toBe('successful payment');
      expect(scenario?.given.length).toBeGreaterThanOrEqual(1);
      expect(scenario?.when.length).toBeGreaterThanOrEqual(1);
      expect(scenario?.then.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse chaos blocks', () => {
      const result = parse(SCENARIOS_DOMAIN);
      
      expect(result.domain?.chaos).toHaveLength(1);
      
      const chaosBlock = result.domain?.chaos[0];
      expect(chaosBlock?.behaviorName.name).toBe('CreatePayment');
      expect(chaosBlock?.scenarios).toHaveLength(1);
    });

    it('should parse chaos inject/when/then', () => {
      const result = parse(SCENARIOS_DOMAIN);
      
      const chaos = result.domain?.chaos[0]?.scenarios[0];
      expect(chaos?.name.value).toBe('database failure');
      expect(chaos?.inject.length).toBeGreaterThanOrEqual(1);
      expect(chaos?.when.length).toBeGreaterThanOrEqual(1);
      expect(chaos?.then.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AST Structure Validation', () => {
    it('should produce AST matching expected structure for MINIMAL_DOMAIN', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      // Match expected structure from fixtures
      expect(result.domain?.kind).toBe('Domain');
      expect(result.domain?.name.kind).toBe('Identifier');
      expect(result.domain?.version.kind).toBe('StringLiteral');
      
      const user = result.domain?.entities[0];
      expect(user?.kind).toBe('Entity');
      expect(user?.name.kind).toBe('Identifier');
      
      const fields = user?.fields ?? [];
      for (const field of fields) {
        expect(field.kind).toBe('Field');
        expect(field.name.kind).toBe('Identifier');
        expect(field.type.kind).toBeDefined();
        expect(Array.isArray(field.annotations)).toBe(true);
      }
    });

    it('should track source locations', () => {
      const result = parse(MINIMAL_DOMAIN);
      
      expect(result.domain?.location).toBeDefined();
      expect(result.domain?.location.line).toBeGreaterThanOrEqual(1);
      expect(result.domain?.location.column).toBeGreaterThanOrEqual(1);
      
      const user = result.domain?.entities[0];
      expect(user?.location).toBeDefined();
      expect(user?.location.file).toBe('<input>');
    });
  });
});
