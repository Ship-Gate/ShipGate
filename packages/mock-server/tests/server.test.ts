/**
 * Mock Server Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createMockServer, MockServer } from '../src/server.js';
import { MockState } from '../src/state.js';
import { DataGenerator } from '../src/generators/data.js';
import { ErrorGenerator } from '../src/generators/error.js';
import { ScenarioManager } from '../src/scenarios.js';
import { RecordingManager } from '../src/recording.js';

describe('MockServer', () => {
  let server: MockServer;

  const testDomain = `
domain TestAuth {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
    status: UserStatus
    created_at: Timestamp [immutable]
  }

  behavior Login {
    description: "Authenticate user"

    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: User

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        USER_LOCKED {
          when: "User account is locked"
          retriable: false
        }
      }
    }
  }

  behavior CreateUser {
    description: "Create a new user"

    input {
      email: String
      name: String
    }

    output {
      success: User

      errors {
        DUPLICATE_EMAIL {
          when: "Email already exists"
          retriable: false
        }
      }
    }
  }
}
`;

  beforeAll(async () => {
    server = await createMockServer({
      domain: testDomain,
      port: 3099,
      logging: false,
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should create mock server instance', () => {
    expect(server).toBeDefined();
    expect(server.getApp()).toBeDefined();
  });

  it('should have state manager', () => {
    const state = server.getState();
    expect(state).toBeInstanceOf(MockState);
  });

  it('should have scenario manager', () => {
    const scenarioManager = server.getScenarioManager();
    expect(scenarioManager).toBeInstanceOf(ScenarioManager);
  });

  it('should have recording manager', () => {
    const recordingManager = server.getRecordingManager();
    expect(recordingManager).toBeInstanceOf(RecordingManager);
  });
});

describe('MockState', () => {
  let state: MockState;

  beforeEach(() => {
    state = new MockState({
      initialState: {
        User: [
          { id: '1', email: 'test@example.com', name: 'Test User' },
        ],
      },
    });
  });

  it('should initialize with provided state', () => {
    const users = state.get('User');
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({ id: '1', email: 'test@example.com', name: 'Test User' });
  });

  it('should add items', () => {
    state.add('User', { email: 'new@example.com', name: 'New User' });
    const users = state.get('User');
    expect(users).toHaveLength(2);
    expect(users[1]).toHaveProperty('id');
    expect(users[1]).toHaveProperty('email', 'new@example.com');
  });

  it('should find by ID', () => {
    const user = state.findById('User', '1');
    expect(user).toEqual({ id: '1', email: 'test@example.com', name: 'Test User' });
  });

  it('should update items', () => {
    const updated = state.update('User', '1', { name: 'Updated Name' });
    expect(updated).toHaveProperty('name', 'Updated Name');
    expect(updated).toHaveProperty('email', 'test@example.com');
  });

  it('should delete items', () => {
    const deleted = state.delete('User', '1');
    expect(deleted).toBe(true);
    expect(state.get('User')).toHaveLength(0);
  });

  it('should reset to initial state', () => {
    state.add('User', { email: 'extra@example.com', name: 'Extra' });
    expect(state.get('User')).toHaveLength(2);

    state.reset();
    expect(state.get('User')).toHaveLength(1);
  });

  it('should count items', () => {
    expect(state.count('User')).toBe(1);
    expect(state.count('NonExistent')).toBe(0);
  });

  it('should check existence', () => {
    expect(state.exists('User', '1')).toBe(true);
    expect(state.exists('User', '999')).toBe(false);
  });

  it('should paginate items', () => {
    // Add more items
    for (let i = 0; i < 25; i++) {
      state.add('User', { email: `user${i}@example.com`, name: `User ${i}` });
    }

    const page1 = state.paginate('User', 1, 10);
    expect(page1.items).toHaveLength(10);
    expect(page1.page).toBe(1);
    expect(page1.total).toBe(26);
    expect(page1.totalPages).toBe(3);

    const page3 = state.paginate('User', 3, 10);
    expect(page3.items).toHaveLength(6);
  });
});

describe('DataGenerator', () => {
  let generator: DataGenerator;

  beforeEach(() => {
    generator = new DataGenerator({ seed: 12345 });
  });

  it('should generate UUIDs', () => {
    const uuid = generator.uuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should generate emails', () => {
    const email = generator.email();
    expect(email).toMatch(/@/);
  });

  it('should generate names', () => {
    const name = generator.fullName();
    expect(name).toBeTruthy();
    expect(name.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('should generate integers in range', () => {
    for (let i = 0; i < 100; i++) {
      const num = generator.integer(10, 20);
      expect(num).toBeGreaterThanOrEqual(10);
      expect(num).toBeLessThanOrEqual(20);
    }
  });

  it('should generate booleans', () => {
    const trueCount = Array.from({ length: 100 }, () => generator.boolean()).filter(Boolean).length;
    expect(trueCount).toBeGreaterThan(20);
    expect(trueCount).toBeLessThan(80);
  });

  it('should generate timestamps', () => {
    const timestamp = generator.timestamp();
    expect(new Date(timestamp).getTime()).not.toBeNaN();
  });

  it('should generate arrays', () => {
    const arr = generator.array(() => generator.integer(0, 10), 5);
    expect(arr).toHaveLength(5);
    arr.forEach((n) => expect(n).toBeGreaterThanOrEqual(0));
  });

  it('should pick from enum values', () => {
    const values = ['A', 'B', 'C'];
    for (let i = 0; i < 20; i++) {
      const value = generator.enumValue(values);
      expect(values).toContain(value);
    }
  });

  it('should generate reproducible data with seed', () => {
    const gen1 = new DataGenerator({ seed: 99999 });
    const gen2 = new DataGenerator({ seed: 99999 });

    const uuid1 = gen1.uuid();
    const uuid2 = gen2.uuid();
    expect(uuid1).toBe(uuid2);

    const email1 = gen1.email();
    const email2 = gen2.email();
    expect(email1).toBe(email2);
  });
});

describe('ErrorGenerator', () => {
  let generator: ErrorGenerator;

  beforeEach(() => {
    generator = new ErrorGenerator();
  });

  it('should generate predefined errors', () => {
    const error = generator.generateError('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.body.error.code).toBe('NOT_FOUND');
  });

  it('should generate validation errors', () => {
    const error = generator.generateValidationError([
      { field: 'email', message: 'Invalid email format' },
      { field: 'name', message: 'Name is required' },
    ]);

    expect(error.status).toBe(400);
    expect(error.body.error.code).toBe('VALIDATION_ERROR');
    expect(error.body.error.details?.fields).toHaveLength(2);
  });

  it('should generate not found errors for specific resources', () => {
    const error = generator.generateNotFoundError('User', '12345');
    expect(error.body.error.details?.resource).toBe('User');
    expect(error.body.error.details?.id).toBe('12345');
  });

  it('should register custom errors', () => {
    generator.registerError({
      name: 'CUSTOM_ERROR',
      message: 'Custom error message',
      status: 418,
      retriable: true,
    });

    const error = generator.generateError('CUSTOM_ERROR');
    expect(error.status).toBe(418);
    expect(error.body.error.message).toBe('Custom error message');
  });

  it('should include retry information', () => {
    const error = generator.generateError('RATE_LIMITED');
    expect(error.body.error.retriable).toBe(true);
    expect(error.body.error.retryAfter).toBeDefined();
  });
});

describe('ScenarioManager', () => {
  let manager: ScenarioManager;

  beforeEach(() => {
    manager = new ScenarioManager();
  });

  it('should list built-in scenarios', () => {
    const scenarios = manager.listScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.some((s) => s.name === 'happy-path')).toBe(true);
    expect(scenarios.some((s) => s.name === 'all-errors')).toBe(true);
  });

  it('should activate scenarios', async () => {
    await manager.activateScenario('happy-path');
    expect(manager.getActiveScenario()).toBe('happy-path');
  });

  it('should deactivate scenarios', async () => {
    await manager.activateScenario('happy-path');
    await manager.deactivateScenario();
    expect(manager.getActiveScenario()).toBeNull();
  });

  it('should throw on unknown scenario', async () => {
    await expect(manager.activateScenario('non-existent')).rejects.toThrow();
  });

  it('should create custom scenarios', () => {
    const scenario = manager.createScenario('my-scenario', {
      description: 'My custom scenario',
      behaviors: {
        Login: {
          response: { user: { id: 'mock-id' } },
        },
      },
    });

    expect(scenario.name).toBe('my-scenario');
    expect(manager.getScenario('my-scenario')).toBeDefined();
  });

  it('should get response from active scenario', async () => {
    manager.createScenario('login-test', {
      behaviors: {
        Login: {
          response: { token: 'mock-token' },
        },
      },
    });

    await manager.activateScenario('login-test');
    const response = manager.getResponse('Login', {});
    expect(response).toEqual({ token: 'mock-token' });
  });

  it('should support conditional responses', async () => {
    manager.createScenario('conditional-test', {
      behaviors: {
        Login: {
          when: (input: { email?: string }) => input?.email === 'admin@example.com',
          response: { role: 'admin' },
        },
      },
    });

    await manager.activateScenario('conditional-test');

    const adminResponse = manager.getResponse('Login', { email: 'admin@example.com' });
    expect(adminResponse).toEqual({ role: 'admin' });

    const userResponse = manager.getResponse('Login', { email: 'user@example.com' });
    expect(userResponse).toBeUndefined();
  });
});

describe('RecordingManager', () => {
  let manager: RecordingManager;

  beforeEach(() => {
    manager = new RecordingManager({ enabled: true });
  });

  it('should record interactions', () => {
    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: { email: 'test@example.com' },
      response: { token: 'abc123' },
      status: 200,
    });

    expect(manager.count()).toBe(1);
    expect(manager.getRecordings()[0].path).toBe('/api/login');
  });

  it('should clear recordings', () => {
    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: {},
      response: {},
      status: 200,
    });

    manager.clear();
    expect(manager.count()).toBe(0);
  });

  it('should get recordings by path', () => {
    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: {},
      response: {},
      status: 200,
    });

    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/register',
      request: {},
      response: {},
      status: 200,
    });

    const loginRecordings = manager.getRecordingsForPath('/api/login');
    expect(loginRecordings).toHaveLength(1);
  });

  it('should get statistics', () => {
    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: {},
      response: {},
      status: 200,
    });

    manager.record({
      timestamp: new Date().toISOString(),
      method: 'GET',
      path: '/api/users',
      request: {},
      response: {},
      status: 200,
    });

    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: {},
      response: {},
      status: 401,
    });

    const stats = manager.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byMethod['POST']).toBe(2);
    expect(stats.byMethod['GET']).toBe(1);
    expect(stats.byStatus[200]).toBe(2);
    expect(stats.byStatus[401]).toBe(1);
  });

  it('should not record when disabled', () => {
    manager.setEnabled(false);

    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: {},
      response: {},
      status: 200,
    });

    expect(manager.count()).toBe(0);
  });

  it('should generate test cases from recordings', () => {
    manager.record({
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/login',
      request: { email: 'test@example.com' },
      response: { token: 'abc' },
      status: 200,
    });

    const testCases = manager.generateTestCases();
    expect(testCases).toHaveLength(1);
    expect(testCases[0].path).toBe('/api/login');
    expect(testCases[0].input).toEqual({ email: 'test@example.com' });
  });
});
