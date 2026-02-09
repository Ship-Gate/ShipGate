---
title: Migration Guide
description: Adding ISL and ShipGate to an existing project.
---

This guide walks through adding ShipGate to a project that already has code. You don't need to write specs for everything at once — start with critical paths and expand coverage incrementally.

## Step 1: Install and initialize

```bash
# Install the CLI
npm install --save-dev @isl-lang/cli

# Initialize ShipGate (creates config and directory structure)
shipgate init --template minimal
```

## Step 2: Start with specless verification

Before writing any ISL specs, run specless verification to find existing issues:

```bash
shipgate verify src/
```

This immediately catches:
- Hardcoded secrets
- Missing error handling
- Ghost imports
- PII in logs

Fix any critical findings before proceeding.

## Step 3: Generate specs from existing code

ShipGate can analyze your source code and generate ISL specifications:

```bash
# Generate specs for your entire src directory
shipgate isl-generate src/ --output specs/

# Preview without writing files
shipgate isl-generate src/ --dry-run

# Only generate for high-confidence files
shipgate isl-generate src/ --confidence 0.7

# Interactive mode — confirm each file
shipgate isl-generate src/ --interactive
```

The generated specs are a starting point. Review and refine them:

```bash
# Check spec quality
shipgate spec-quality specs/user-service.isl --fix
```

### AI-enhanced generation

For better spec quality, use AI-assisted generation:

```bash
# Requires ANTHROPIC_API_KEY environment variable
shipgate isl-generate src/ --ai --output specs/
```

## Step 4: Identify critical paths

Focus your initial specs on the highest-risk areas:

1. **Authentication and authorization** — login, signup, token handling
2. **Payment processing** — charges, refunds, balance changes
3. **Data mutations** — create, update, delete operations
4. **External integrations** — API calls to third-party services

These are where "fake features" cause the most damage.

## Step 5: Write specs incrementally

Start with one service. Here's a pattern for migrating a user service:

```isl
domain UserService {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    name: String
    status: UserStatus

    invariants {
      email.is_valid
      name.length > 0
    }
  }

  // Start with just preconditions and postconditions
  behavior CreateUser {
    input {
      email: Email
      name: String
    }

    output {
      success: User
      errors {
        DUPLICATE_EMAIL { when: "Email already in use" }
      }
    }

    preconditions {
      email.is_valid
      name.length > 0
    }

    postconditions {
      success implies {
        User.count == old(User.count) + 1
        result.email == email
      }
      failure implies {
        User.count == old(User.count)
      }
    }
  }
}
```

## Step 6: Verify progressively

Use mixed mode to verify specs where they exist and run specless checks elsewhere:

```bash
# Mixed mode (default) — ISL where specs exist, specless elsewhere
shipgate verify .
```

Track your coverage:

```bash
# Check which files have specs
shipgate verify . --detailed
```

## Step 7: Add CI gating

Add verification to your CI pipeline with a reasonable starting threshold:

```yaml
# .github/workflows/shipgate.yml
name: ShipGate Verify
on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - name: ShipGate Verify
        uses: guardiavault-oss/isl-gate-action@v1
        with:
          mode: auto
          threshold: 70    # Start low, increase over time
```

### Increasing thresholds over time

| Week  | Threshold | Coverage Goal                  |
| ----- | --------- | ------------------------------ |
| 1     | 60        | Core auth and payment specs    |
| 2-3   | 70        | All API endpoints specified    |
| 4-6   | 80        | Services and business logic    |
| 8+    | 90        | Full coverage with chaos tests |

## Step 8: Team adoption

Once you have specs for critical paths, get the team onboard:

```bash
# Generate team config
shipgate policy team-init --team "my-team"

# Install VS Code extension for all team members
# Search "ShipGate ISL" in VS Code extensions
```

Configure which paths require specs:

```yaml
# .shipgate-team.yml
coverage:
  required:
    - src/api/**
    - src/services/**
  exempt:
    - src/utils/**
    - src/types/**
```

## Common migration patterns

### Express/Fastify APIs

For each route handler, create a behavior:

```isl
behavior GetUser {
  actors {
    User { must: authenticated }
  }

  input {
    user_id: UUID
  }

  output {
    success: User
    errors {
      NOT_FOUND { when: "User does not exist" }
      UNAUTHORIZED { when: "Caller is not authenticated" }
    }
  }

  preconditions {
    User.exists(user_id)
  }

  postconditions {
    success implies {
      result.id == user_id
    }
  }
}
```

### Database operations

For CRUD operations, focus on postconditions that verify state changes:

```isl
behavior DeleteUser {
  postconditions {
    success implies {
      not User.exists(user_id)
      User.count == old(User.count) - 1
    }
    failure implies {
      User.count == old(User.count)
    }
  }
}
```

### Background jobs

For async operations, use temporal constraints:

```isl
behavior SendWelcomeEmail {
  temporal {
    within 5m: email.delivered
    eventually: delivery_status.updated
  }
}
```
