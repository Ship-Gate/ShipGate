---
title: Quick Start
description: Go from zero to a verified ISL spec in 5 minutes.
---

This guide takes you from installation to a verified specification in under 5 minutes.

## 1. Install ShipGate

```bash
npm install -g shipgate
```

If you're building from source, you may have the CLI as `isl`; use `isl` instead of `shipgate` in the examples below.

## 2. Create a spec file

Create a file called `user-service.isl`:

```isl
domain UserService {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    name: String
    status: UserStatus
    created_at: Timestamp [immutable]

    invariants {
      email.is_valid
      name.length > 0
    }

    lifecycle {
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
    }
  }

  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
  }

  behavior CreateUser {
    description: "Register a new user account"

    input {
      email: Email
      name: String
    }

    output {
      success: User
      errors {
        DUPLICATE_EMAIL {
          when: "A user with this email already exists"
        }
        INVALID_INPUT {
          when: "Email or name is invalid"
        }
      }
    }

    preconditions {
      email.is_valid
      name.length > 0
      not User.exists(email)
    }

    postconditions {
      success implies {
        User.count == old(User.count) + 1
        result.email == email
        result.status == PENDING
      }
      failure implies {
        User.count == old(User.count)
      }
    }
  }
}
```

## 3. Parse and type-check

```bash
shipgate check user-service.isl
```

Expected output:

```
✓ Parsed successfully
✓ Type checking passed
✓ 1 domain, 1 entity, 1 behavior found
```

## 4. Generate TypeScript types

```bash
shipgate gen typescript user-service.isl -o ./src/generated
```

This produces TypeScript interfaces, Zod validators, and contract checkers from your spec.

## 5. Verify an implementation

If you have a TypeScript implementation:

```bash
shipgate verify user-service.isl --impl ./src/user-service.ts
```

Output:

```
Running verification...

CreateUser:
  ✓ Precondition: email.is_valid (passed)
  ✓ Precondition: name.length > 0 (passed)
  ✓ Precondition: not User.exists(email) (passed)
  ✓ Postcondition: User.count == old(User.count) + 1 (passed)
  ✓ Postcondition: result.email == email (passed)
  ✓ Postcondition: result.status == PENDING (passed)

Verdict: SHIP ✓  Trust Score: 100/100
```

## 6. Run the gate

The gate provides a definitive SHIP/NO_SHIP verdict for CI:

```bash
shipgate gate user-service.isl --impl ./src/user-service.ts
```

```
┌─────────────────────────────┐
│ Verdict: SHIP               │
│ Trust Score: 100/100        │
│ Confidence: 95%             │
│ Duration: 1.2s              │
└─────────────────────────────┘
```

Exit code `0` means SHIP. Exit code `1` means NO_SHIP. Use this in your CI pipeline.

## What's next?

- [Your First Spec](/getting-started/your-first-spec/) — learn ISL syntax in depth
- [ISL Syntax Reference](/isl-language/syntax-reference/) — complete language grammar
- [CI/CD Integration](/guides/ci-integration/) — add ShipGate to your pipeline
