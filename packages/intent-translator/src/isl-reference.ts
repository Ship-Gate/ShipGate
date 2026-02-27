/**
 * ISL Language Reference
 * 
 * This is the complete reference for the Intent Specification Language (ISL).
 * AI agents use this to understand and generate valid ISL code.
 */

export const ISL_LANGUAGE_REFERENCE = `
# Intent Specification Language (ISL) Reference

ISL is a declarative language for specifying software behavior. Instead of writing HOW to do something, you write WHAT you want - the system generates the implementation.

## Basic Structure

Every ISL file defines a domain with entities, behaviors, and constraints:

\`\`\`isl
domain DomainName {
  version: "1.0.0"
  
  # Types, Enums, Entities, Behaviors go here
}
\`\`\`

## 1. Types

Define custom types with constraints:

\`\`\`isl
type Email = String { format: "email", max_length: 254 }
type Password = String { min_length: 8, max_length: 128 }
type UserId = UUID { immutable: true, unique: true }
type Money = Decimal { precision: 2, min: 0 }
type Percentage = Int { min: 0, max: 100 }
\`\`\`

### Built-in Types:
- String, Int, Float, Boolean, UUID, Timestamp, Date, Time
- Decimal (for money), Duration, JSON, Binary

## 2. Enums

Define fixed set of values:

\`\`\`isl
enum UserStatus {
  ACTIVE
  INACTIVE
  LOCKED
  PENDING_VERIFICATION
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
\`\`\`

## 3. Entities

Define data structures with fields and constraints:

\`\`\`isl
entity User {
  id: UserId [immutable, unique]
  email: Email [unique, indexed]
  password_hash: String [secret]
  status: UserStatus [indexed]
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  failed_attempts: Int [default: 0]
  
  invariants {
    failed_attempts >= 0
    failed_attempts <= 10
  }
  
  lifecycle {
    PENDING -> ACTIVE
    ACTIVE -> LOCKED
    LOCKED -> ACTIVE
  }
}
\`\`\`

### Field Modifiers:
- [immutable] - Cannot be changed after creation
- [unique] - Must be unique across all records
- [indexed] - Database index for fast queries
- [secret] - Never exposed in logs or responses
- [default: value] - Default value if not provided
- [optional] or ? - Field can be null

## 4. Behaviors

Define what operations do (not how):

\`\`\`isl
behavior Login {
  description: "Authenticate a user with email and password"
  
  actors {
    Anonymous { for: authentication }
  }
  
  input {
    email: Email
    password: Password [sensitive]
  }
  
  output {
    success: Session
    
    errors {
      INVALID_CREDENTIALS {
        when: "Email or password is incorrect"
        retriable: true
      }
      USER_LOCKED {
        when: "Account is locked"
        retriable: true
        retry_after: 15m
      }
    }
  }
  
  preconditions {
    email.is_valid_format
    password.length >= 8
  }
  
  postconditions {
    success implies {
      - Session.exists(result.id)
      - User.last_login == now()
    }
  }
}
\`\`\`

## 5. Standard Libraries

Reuse pre-built, verified components:

\`\`\`isl
domain MyApp {
  use stdlib-auth       # Login, logout, sessions
  use stdlib-payments   # Stripe, subscriptions
  use stdlib-messaging  # Conversations, threads
  use stdlib-files      # Upload, download, storage
  use stdlib-scheduling # Appointments, reminders
  
  # Your custom behaviors
  behavior MyFeature { ... }
}
\`\`\`

## 6. Invariants

Rules that must always be true:

\`\`\`isl
invariants SecurityRules {
  scope: global
  
  always {
    - passwords never stored in plaintext
    - session tokens cryptographically secure
    - all auth events logged
  }
}
\`\`\`

## 7. Temporal Constraints

Performance and timing requirements:

\`\`\`isl
temporal {
  - within 500ms (p50): response returned
  - within 2s (p99): response returned
  - eventually within 5m: email sent
}
\`\`\`

## 8. Security

Security policies:

\`\`\`isl
security {
  - rate_limit 100 per hour per ip_address
  - brute_force_protection enabled
  - encryption at_rest and in_transit
}
\`\`\`

## Complete Example

\`\`\`isl
domain Counter {
  version: "1.0.0"

  entity CounterValue {
    id: UUID [immutable, unique]
    value: Int [default: 0]
    max_value: Int [default: 100]
    created_at: Timestamp [immutable]
  }

  behavior Increment {
    description: "Increment the counter by a specified amount"

    input {
      counter_id: UUID
      amount: Int [default: 1]
    }

    output {
      success: CounterValue
      errors {
        NOT_FOUND {
          when: "Counter does not exist"
        }
        MAX_EXCEEDED {
          when: "Would exceed maximum"
        }
      }
    }

    preconditions {
      amount > 0
    }
  }
}
\`\`\`

## Key Principles

1. **Declare WHAT, not HOW** - Describe outcomes, not implementations
2. **Constraints are requirements** - Preconditions, postconditions, invariants
3. **Errors are explicit** - Every failure mode is documented
4. **Security by default** - Sensitive fields marked, rate limits included
5. **Composable** - Use standard libraries, build on verified components
`;

export const ISL_TRANSLATION_PROMPT = `
You are an ISL (Intent Specification Language) translator. Your job is to convert natural language descriptions into valid ISL specifications.

${ISL_LANGUAGE_REFERENCE}

## Translation Rules

1. **Extract the domain name** from what the user is building
2. **Identify entities** - What data/objects are involved?
3. **Identify behaviors** - What actions/operations are needed?
4. **Add constraints** - What rules must be followed?
5. **Use standard libraries** when applicable (auth, payments, etc.)

## Example Translations

**User says:** "I want a todo app where users can create, complete, and delete tasks"

**You generate:**
\`\`\`isl
domain TodoApp {
  version: "1.0.0"
  
  use stdlib-auth  # User authentication
  
  enum TaskStatus {
    PENDING
    COMPLETED
    ARCHIVED
  }
  
  entity Task {
    id: UUID [immutable, unique]
    user_id: UUID [immutable, indexed]
    title: String { max_length: 200 }
    description: String? { max_length: 2000 }
    status: TaskStatus [default: PENDING]
    due_date: Timestamp?
    created_at: Timestamp [immutable]
    completed_at: Timestamp?
  }
  
  behavior CreateTask {
    description: "Create a new task for the current user"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      title: String
      description: String?
      due_date: Timestamp?
    }
    
    output {
      success: Task
      errors {
        INVALID_TITLE {
          when: "Title is empty or too long"
        }
      }
    }
    
    preconditions {
      title.length > 0
      title.length <= 200
    }
  }
  
  behavior CompleteTask {
    description: "Mark a task as completed"
    
    actors {
      User { must: authenticated, owns: task_id }
    }
    
    input {
      task_id: UUID
    }
    
    output {
      success: Task
      errors {
        NOT_FOUND {
          when: "Task does not exist"
        }
        NOT_OWNER {
          when: "User does not own this task"
        }
      }
    }
  }
  
  behavior DeleteTask {
    description: "Delete a task"
    
    actors {
      User { must: authenticated, owns: task_id }
    }
    
    input {
      task_id: UUID
    }
    
    output {
      success: Boolean
      errors {
        NOT_FOUND {
          when: "Task does not exist"
        }
      }
    }
  }
}
\`\`\`

When translating:
1. Always include version
2. Use stdlib libraries when appropriate
3. Add proper field modifiers
4. Include error cases
5. Add actors for behaviors
6. Keep it concise but complete
`;

export default {
  ISL_LANGUAGE_REFERENCE,
  ISL_TRANSLATION_PROMPT,
};
