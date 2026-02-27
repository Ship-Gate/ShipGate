# ISL TypeScript SDK

Universal TypeScript SDK for ISL-verified APIs. Works in browsers, Node.js, Deno, and edge runtimes.

## Features

- **Zero Dependencies**: Only Zod for runtime validation (optional)
- **Universal**: Works in any JavaScript runtime with fetch
- **Type-Safe**: Full TypeScript support with discriminated unions
- **Runtime Verification**: Automatic pre/postcondition checking
- **React Integration**: Hooks and components for React apps
- **Retry Logic**: Configurable exponential backoff
- **WebSocket Support**: Real-time updates via async iterators
- **Tree-Shakeable**: Only bundle what you use

## Installation

```bash
npm install @isl/sdk
# or
pnpm add @isl/sdk
# or
yarn add @isl/sdk
```

## Quick Start

### Initialize the Client

```typescript
import { ISLClient } from '@isl/sdk';

const client = new ISLClient({
  baseUrl: 'https://api.example.com',
  authToken: 'your-token',
});

// With full configuration
const client = new ISLClient({
  baseUrl: 'https://api.example.com',
  authToken: 'your-token',
  timeout: 30000,
  retry: {
    maxRetries: 3,
    exponentialBase: 2,
  },
  verification: {
    enablePreconditions: true,
    enablePostconditions: true,
  },
});
```

### Make API Calls

```typescript
import { CreateUserInput } from '@isl/sdk';

const result = await client.users.createUser({
  email: 'user@example.com',
  username: 'newuser',
});

// Type-safe discriminated union
if (result.ok) {
  console.log(`User created: ${result.data.id}`);
} else {
  switch (result.error.code) {
    case 'DUPLICATE_EMAIL':
      console.log('Email already exists');
      break;
    case 'INVALID_INPUT':
      console.log(`Invalid input: ${result.error.message}`);
      break;
    case 'RATE_LIMITED':
      console.log(`Rate limited, retry after ${result.error.retryAfter}s`);
      break;
  }
}
```

### React Integration

```tsx
import { useISLClient, useCreateUser, useUser } from '@isl/sdk/react';

function App() {
  return (
    <ISLClientProvider baseUrl="https://api.example.com">
      <UserForm />
    </ISLClientProvider>
  );
}

function UserForm() {
  const { mutate, isPending, error } = useCreateUser();
  
  const handleSubmit = async (data: CreateUserInput) => {
    const result = await mutate(data);
    if (result.ok) {
      console.log('User created!');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useUser(userId);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{data.username}</div>;
}
```

## Result Types

All operations return a discriminated union `Result<T, E>`:

```typescript
type Result<T, E> = 
  | { ok: true; data: T }
  | { ok: false; error: E };

// Usage
const result = await client.users.getUser(userId);

if (result.ok) {
  // result.data is User
  console.log(result.data.email);
} else {
  // result.error is typed error
  console.log(result.error.code);
}
```

### Helper Methods

```typescript
// Unwrap or throw
const user = result.unwrap(); // throws if error

// Unwrap with default
const user = result.unwrapOr(defaultUser);

// Map success value
const username = result.map(user => user.username);

// Chain operations
const result = await client.users.getUser(userId)
  .then(r => r.ok ? client.users.updateUser(r.data.id, update) : r);
```

## Verification

The SDK automatically verifies ISL contracts at runtime.

### Precondition Checking

```typescript
// Throws PreconditionError before making request
const result = await client.users.createUser({
  email: 'invalid', // Missing @
  username: 'ab',   // Too short
});
// Error: Precondition violated: Email must contain @
```

### Postcondition Checking

```typescript
// Verifies server response matches contract
const result = await client.users.createUser(input);
if (result.ok) {
  // Guaranteed by postcondition:
  // result.data.email === input.email
  // result.data.status === 'PENDING'
}
```

### Disable Verification

```typescript
const client = new ISLClient({
  baseUrl: 'https://api.example.com',
  verification: {
    enablePreconditions: false,
    enablePostconditions: false,
  },
});
```

## Advanced Usage

### Custom Fetch

```typescript
const client = new ISLClient({
  baseUrl: 'https://api.example.com',
  fetch: customFetch, // Your fetch implementation
});
```

### Interceptors

```typescript
const client = new ISLClient({
  baseUrl: 'https://api.example.com',
  interceptors: {
    request: async (request) => {
      request.headers.set('X-Trace-ID', crypto.randomUUID());
      return request;
    },
    response: async (response) => {
      console.log(`Response: ${response.status}`);
      return response;
    },
  },
});
```

### WebSocket Real-time Updates

```typescript
// Async iterator for real-time updates
for await (const user of client.users.observe(userId)) {
  console.log(`User updated: ${user.status}`);
}

// Or with callback
const unsubscribe = client.users.subscribe(userId, (user) => {
  console.log(`User updated: ${user.status}`);
});

// Cleanup
unsubscribe();
```

## API Reference

Full API documentation: [docs.intentlang.dev/typescript](https://docs.intentlang.dev/typescript)

## License

MIT License
