# Tutorial 2: REST API

**Time:** ~45 minutes  
**Goal:** Build a REST API with IntentOS specifications, including endpoints, request/response validation, and error handling.

## Overview

In this tutorial, you'll:
1. Create a User API specification with CRUD operations
2. Implement a REST API server (Express.js)
3. Verify API endpoints match specifications
4. Test API with generated test cases

## Prerequisites

- Completed [Hello World tutorial](./01-hello-world.md)
- Node.js 18+ installed
- Basic knowledge of REST APIs

## Step 1: Create Project

```bash
mkdir rest-api-tutorial
cd rest-api-tutorial
shipgate init --template api
```

## Step 2: Install Dependencies

```bash
npm init -y
npm install express
npm install -D @types/express @types/node typescript ts-node
```

## Step 3: Create API Specification

Create `specs/users.isl`:

```isl
domain UserAPI {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
    createdAt: DateTime [immutable]
    updatedAt: DateTime
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
        }
        NAME_REQUIRED {
          when: "Name is empty"
        }
      }
    }

    pre {
      email.is_valid
      name.length > 0
      not User.exists(email)
    }

    post success {
      result.email == input.email
      result.name == input.name
      result.id != null
    }
  }

  behavior GetUser {
    input {
      id: UUID
    }

    output {
      success: User
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
      }
    }

    pre {
      id != null
    }

    post success {
      result.id == input.id
    }
  }

  behavior UpdateUser {
    input {
      id: UUID
      name: String [optional]
      email: String [optional]
    }

    output {
      success: User
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
        EMAIL_EXISTS {
          when: "Email already taken by another user"
        }
      }
    }

    pre {
      id != null
      (input.name != null or input.email != null)
    }

    post success {
      result.id == input.id
      if input.name != null then result.name == input.name
      if input.email != null then result.email == input.email
      result.updatedAt > old(result.updatedAt)
    }
  }

  behavior DeleteUser {
    input {
      id: UUID
    }

    output {
      success: Boolean
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
      }
    }

    pre {
      id != null
    }

    post success {
      not User.exists(input.id)
    }
  }
}
```

## Step 4: Validate Specification

```bash
shipgate check specs/users.isl
```

**Expected output:**
```
✓ Parsed specs/users.isl
✓ Type check passed
✓ No errors found
```

## Step 5: Generate TypeScript Types

```bash
shipgate gen specs/users.isl --target typescript --output src/generated
```

This generates types you can use in your implementation.

## Step 6: Implement API Server

Create `src/server.ts`:

```typescript
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const app = express();
app.use(express.json());

const users: Map<string, User> = new Map();

// Helper functions
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function userExists(email: string): boolean {
  return Array.from(users.values()).some(u => u.email === email);
}

// POST /users - CreateUser
app.post('/users', (req, res) => {
  const { email, name } = req.body;

  // Preconditions
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'INVALID_EMAIL' });
  }
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'NAME_REQUIRED' });
  }
  if (userExists(email)) {
    return res.status(409).json({ error: 'EMAIL_EXISTS' });
  }

  // Create user
  const now = new Date();
  const user: User = {
    id: uuidv4(),
    email,
    name,
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.id, user);

  // Postconditions satisfied
  res.status(201).json(user);
});

// GET /users/:id - GetUser
app.get('/users/:id', (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'NOT_FOUND' });
  }

  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  res.json(user);
});

// PUT /users/:id - UpdateUser
app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'NOT_FOUND' });
  }

  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  // Check if at least one field is provided
  if (!name && !email) {
    return res.status(400).json({ error: 'At least one field required' });
  }

  // Check email uniqueness if updating email
  if (email && email !== user.email && userExists(email)) {
    return res.status(409).json({ error: 'EMAIL_EXISTS' });
  }

  // Update user
  if (name) user.name = name;
  if (email) user.email = email;
  user.updatedAt = new Date();

  users.set(id, user);

  res.json(user);
});

// DELETE /users/:id - DeleteUser
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'NOT_FOUND' });
  }

  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }

  users.delete(id);
  res.status(200).json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

## Step 7: Verify Implementation

```bash
shipgate verify specs/users.isl --impl src/server.ts
```

**Expected output:**
```
Running verification...

CreateUser:
  Preconditions:
    ✓ email.is_valid
    ✓ name.length > 0
    ✓ not User.exists(email)
  Postconditions:
    ✓ result.email == input.email
    ✓ result.name == input.name
    ✓ result.id != null

GetUser:
  Preconditions:
    ✓ id != null
  Postconditions:
    ✓ result.id == input.id

UpdateUser:
  Preconditions:
    ✓ id != null
    ✓ (input.name != null or input.email != null)
  Postconditions:
    ✓ result.id == input.id
    ✓ result.updatedAt > old(result.updatedAt)

DeleteUser:
  Preconditions:
    ✓ id != null
  Postconditions:
    ✓ not User.exists(input.id)

Verdict: SHIP ✓  Trust Score: 95/100
```

## Step 8: Run the Gate

```bash
shipgate gate specs/users.isl --impl src/server.ts --threshold 80
```

**Expected output:**
```
Decision: SHIP ✓
Trust Score: 95/100
```

## Step 9: Test the API

Start the server:
```bash
npx ts-node src/server.ts
```

In another terminal, test the endpoints:

```bash
# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice"}'

# Get user
curl http://localhost:3000/users/<user-id>

# Update user
curl -X PUT http://localhost:3000/users/<user-id> \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}'

# Delete user
curl -X DELETE http://localhost:3000/users/<user-id>
```

## Step 10: Generate API Documentation

Generate OpenAPI spec from your ISL:

```bash
shipgate gen specs/users.isl --target openapi --output docs/api.yaml
```

This creates an OpenAPI specification you can use with Swagger UI.

## Complete Project Structure

```
rest-api-tutorial/
├── .shipgate.yml
├── specs/
│   └── users.isl
├── src/
│   ├── server.ts
│   └── generated/
│       └── types.ts
├── docs/
│   └── api.yaml
└── package.json
```

## Troubleshooting

### Error: "Cannot find module 'express'"

**Solution:** Install dependencies:
```bash
npm install express
npm install -D @types/express
```

### Verification fails on preconditions

**Solution:** Check that your implementation validates all preconditions before executing the behavior. Add explicit checks for:
- Email format validation
- Required fields
- Uniqueness constraints

### Postconditions fail

**Solution:** Ensure your implementation:
- Returns the correct data structure
- Updates timestamps correctly
- Handles optional fields properly

### Gate fails with low trust score

**Solution:** 
- Review verification output for specific failures
- Add missing error handling
- Ensure all preconditions/postconditions are satisfied

## Next Steps

- ✅ You've built a REST API with IntentOS
- ✅ You've verified API endpoints match specifications
- ✅ You've generated API documentation

**Continue to:** [Tutorial 3: Authentication](./03-authentication.md) to add secure authentication flows.

## Summary

In this tutorial, you learned:
- How to specify REST API behaviors in ISL
- How to implement API endpoints that match specs
- How to verify API implementations
- How to generate API documentation from specs

Key concepts:
- **Entities** represent data models
- **Behaviors** map to API endpoints
- **Preconditions** validate requests
- **Postconditions** ensure correct responses
