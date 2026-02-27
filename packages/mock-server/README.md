# @intentos/mock-server

Generate mock servers from ISL specifications for testing.

## Installation

```bash
npm install @intentos/mock-server
```

## Quick Start

```typescript
import { createMockServer } from '@intentos/mock-server';

const server = await createMockServer({
  domain: './auth.isl',
  port: 3001,
});

await server.start();
// Mock server running at http://localhost:3001
```

## Features

### Basic Mock Server

```typescript
const server = await createMockServer({
  // ISL file path or parsed domain object
  domain: './auth.isl',
  
  // Server configuration
  port: 3001,
  basePath: '/api',
  
  // Enable logging
  logging: true,
});
```

### Behavior Overrides

```typescript
const server = await createMockServer({
  domain: './auth.isl',
  
  overrides: {
    // Return specific response
    'Login': {
      response: { user: { id: 'test-user' }, token: 'mock-token' },
    },
    
    // Simulate delay
    'CreateUser': {
      delay: 500,
      response: { id: 'new-user' },
    },
    
    // Conditional responses
    'GetUser': [
      {
        when: (input) => input.id === 'admin',
        response: { id: 'admin', role: 'admin' },
      },
      {
        when: (input) => input.id === 'not-found',
        error: 'NOT_FOUND',
        status: 404,
      },
    ],
    
    // Custom handler
    'DeleteUser': {
      handler: async (req, res) => {
        // Custom logic
        res.json({ deleted: true });
      },
    },
  },
});
```

### Initial State

```typescript
const server = await createMockServer({
  domain: './auth.isl',
  
  initialState: {
    User: [
      { id: '1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      { id: '2', email: 'user@example.com', name: 'User', role: 'user' },
    ],
    Session: [],
  },
});
```

### Scenarios

```typescript
const server = await createMockServer({
  domain: './auth.isl',
  
  scenarios: [
    {
      name: 'user-locked',
      description: 'Simulate locked user account',
      behaviors: {
        'Login': {
          when: (input) => input.email === 'locked@example.com',
          response: { error: 'USER_LOCKED' },
        },
      },
    },
    {
      name: 'slow-network',
      description: 'Simulate slow network',
      behaviors: {
        '*': {
          response: { delay: 2000 },
        },
      },
    },
  ],
});

// Activate a scenario
const scenarioManager = server.getScenarioManager();
await scenarioManager.activateScenario('user-locked');
```

### Recording Mode

```typescript
const server = await createMockServer({
  domain: './auth.isl',
  
  recording: {
    enabled: true,
    outputDir: './recordings',
    maxRecordings: 1000,
  },
});

// Get recordings
const recordingManager = server.getRecordingManager();
const recordings = recordingManager.getRecordings();

// Save recordings
await recordingManager.save('my-recording.json');

// Generate test cases from recordings
const testCases = recordingManager.generateTestCases();

// Export as HAR format
const har = recordingManager.exportAsHAR();
```

### Replay Mode

```typescript
const server = await createMockServer({
  domain: './auth.isl',
  
  recording: {
    enabled: true,
    replayMode: true,
    replaySource: './recordings/session.json',
  },
});
```

### State Management

```typescript
const state = server.getState();

// Get all items
const users = state.get('User');

// Add item
state.add('User', { email: 'new@example.com', name: 'New User' });

// Find by ID
const user = state.findById('User', 'user-id');

// Find with predicate
const admins = state.find('User', (u) => u.role === 'admin');

// Update
state.update('User', 'user-id', { name: 'Updated Name' });

// Delete
state.delete('User', 'user-id');

// Reset to initial state
state.reset();

// Pagination
const page = state.paginate('User', 1, 10);
// { items: [...], total: 100, page: 1, pageSize: 10, totalPages: 10 }
```

### Data Generation

```typescript
import { DataGenerator } from '@intentos/mock-server';

const generator = new DataGenerator({ seed: 12345 });

// Identifiers
generator.uuid();        // "550e8400-e29b-41d4-a716-446655440000"

// Personal
generator.firstName();   // "John"
generator.lastName();    // "Doe"
generator.fullName();    // "John Doe"
generator.email();       // "john.doe@example.com"
generator.phone();       // "+1-555-123-4567"

// Primitives
generator.integer(0, 100);  // 42
generator.decimal(0, 100);  // 42.37
generator.boolean();        // true

// Dates
generator.timestamp();   // "2024-01-15T10:30:00.000Z"
generator.date();        // "2024-01-15"
generator.future();      // Future timestamp
generator.past();        // Past timestamp

// Collections
generator.enumValue(['ACTIVE', 'INACTIVE', 'PENDING']);
generator.array(() => generator.uuid(), 5);

// Commerce
generator.company();     // "Acme Corp"
generator.price();       // "99.99"
generator.currency();    // "USD"

// Internet
generator.url();         // "https://example.com"
generator.ip();          // "192.168.1.1"
generator.userAgent();   // "Mozilla/5.0..."
```

### Error Generation

```typescript
import { ErrorGenerator } from '@intentos/mock-server';

const generator = new ErrorGenerator();

// Predefined errors
const error = generator.generateError('NOT_FOUND');
// { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Resource not found', ... } } }

// Validation errors
const validationError = generator.generateValidationError([
  { field: 'email', message: 'Invalid email format' },
  { field: 'password', message: 'Password too short' },
]);

// Resource not found
const notFound = generator.generateNotFoundError('User', '12345');

// Rate limit
const rateLimited = generator.generateRateLimitError(60000);

// Register custom error
generator.registerError({
  name: 'PAYMENT_REQUIRED',
  message: 'Payment is required',
  status: 402,
  retriable: true,
  retryAfter: 5000,
});
```

## API Endpoints

The mock server automatically creates these endpoints:

### Behavior Endpoints

For each behavior in the ISL spec:
```
POST /api/{domain}/{behavior-name}
```

Example:
```
POST /api/auth/login
POST /api/auth/create-user
POST /api/auth/reset-password
```

### Entity CRUD Endpoints

For each entity in the ISL spec:
```
GET    /api/{entity}s         # List all
GET    /api/{entity}s/:id     # Get by ID
POST   /api/{entity}s         # Create
PUT    /api/{entity}s/:id     # Update
DELETE /api/{entity}s/:id     # Delete
```

### Management Endpoints

```
GET  /api/health              # Health check
GET  /api/behaviors           # List available behaviors
GET  /api/_state              # Get current state
POST /api/_state/reset        # Reset state
POST /api/_state/:entity      # Update entity state
GET  /api/_scenarios          # List scenarios
POST /api/_scenarios/:name    # Activate scenario
GET  /api/_recordings         # Get recordings
POST /api/_recordings/clear   # Clear recordings
POST /api/_recordings/save    # Save recordings
```

## Built-in Scenarios

| Scenario | Description |
|----------|-------------|
| `happy-path` | All operations succeed |
| `all-errors` | All operations return errors |
| `slow-responses` | All responses delayed by 2s |
| `intermittent-failures` | 30% random failures |
| `rate-limited` | All requests rate limited |
| `unauthorized` | All requests return 401 |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | `string \| object` | required | ISL file path or parsed domain |
| `port` | `number` | `3001` | Server port |
| `basePath` | `string` | `'/api'` | Base path for all routes |
| `overrides` | `object` | `{}` | Behavior overrides |
| `initialState` | `object` | `{}` | Initial state data |
| `recording` | `object` | `{ enabled: false }` | Recording configuration |
| `scenarios` | `array` | `[]` | Available scenarios |
| `cors` | `boolean \| object` | `true` | CORS configuration |
| `logging` | `boolean` | `true` | Enable request logging |
| `middleware` | `array` | `[]` | Custom Express middleware |
| `seed` | `number` | `Date.now()` | Random seed for data generation |
| `latency` | `[number, number]` | `[0, 0]` | Latency simulation range [min, max] |

## License

MIT
