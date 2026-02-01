/**
 * Simulator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Simulator, defineDomain, createSimulator, simulate } from '../src/index.js';
import type { Domain, BehaviorImplementation } from '../src/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test Domain
// ─────────────────────────────────────────────────────────────────────────────

const testDomain: Domain = defineDomain('TestAuth', {
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: 'UUID', modifiers: ['immutable', 'unique'] },
        { name: 'email', type: 'String', modifiers: ['unique'] },
        { name: 'username', type: 'String', modifiers: [] },
        { name: 'status', type: 'UserStatus', modifiers: [], defaultValue: 'ACTIVE' },
        { name: 'created_at', type: 'Timestamp', modifiers: ['immutable'] },
      ],
      invariants: ['status != null'],
    },
    {
      name: 'Session',
      fields: [
        { name: 'id', type: 'UUID', modifiers: ['immutable', 'unique'] },
        { name: 'user_id', type: 'UUID', modifiers: ['immutable'] },
        { name: 'created_at', type: 'Timestamp', modifiers: ['immutable'] },
      ],
    },
  ],
  behaviors: [
    {
      name: 'CreateUser',
      description: 'Create a new user',
      inputs: [
        { name: 'email', type: 'String', modifiers: [] },
        { name: 'username', type: 'String', modifiers: [] },
      ],
      outputs: {
        successType: 'User',
        errors: [
          { code: 'EMAIL_EXISTS', when: 'Email already registered' },
          { code: 'INVALID_EMAIL', when: 'Email format invalid' },
        ],
      },
      preconditions: ['input.email.length > 0', 'input.username.length > 0'],
      postconditions: [],
      invariants: [],
    },
    {
      name: 'GetUser',
      description: 'Get a user by ID',
      inputs: [{ name: 'id', type: 'UUID', modifiers: [] }],
      outputs: {
        successType: 'User',
        errors: [{ code: 'NOT_FOUND', when: 'User does not exist' }],
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
    },
    {
      name: 'DeleteUser',
      description: 'Delete a user',
      inputs: [{ name: 'id', type: 'UUID', modifiers: [] }],
      outputs: {
        successType: 'Boolean',
        errors: [{ code: 'NOT_FOUND', when: 'User does not exist' }],
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
    },
  ],
  enums: [
    { name: 'UserStatus', values: ['ACTIVE', 'INACTIVE', 'LOCKED'] },
  ],
  invariants: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Simulator', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = new Simulator({ domain: testDomain });
  });

  describe('initialization', () => {
    it('should create simulator with domain', () => {
      expect(sim).toBeDefined();
      expect(sim.getDomainInfo().name).toBe('TestAuth');
    });

    it('should initialize with empty state', () => {
      expect(sim.count('User')).toBe(0);
      expect(sim.count('Session')).toBe(0);
    });

    it('should initialize with initial state', () => {
      const simWithState = new Simulator({
        domain: testDomain,
        initialState: {
          User: [{ id: '123', email: 'test@example.com', username: 'test' }],
        },
      });
      expect(simWithState.count('User')).toBe(1);
    });
  });

  describe('behavior execution', () => {
    it('should execute CreateUser behavior', async () => {
      const result = await sim.execute('CreateUser', {
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect((result.data as Record<string, unknown>).email).toBe('test@example.com');
    });

    it('should create entity on CreateUser', async () => {
      await sim.execute('CreateUser', {
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(sim.count('User')).toBe(1);
      const users = sim.getEntities('User');
      expect(users[0]).toHaveProperty('email', 'test@example.com');
    });

    it('should execute GetUser behavior', async () => {
      const createResult = await sim.execute('CreateUser', {
        email: 'test@example.com',
        username: 'testuser',
      });
      const userId = (createResult.data as Record<string, unknown>).id;

      const getResult = await sim.execute('GetUser', { id: userId });
      expect(getResult.success).toBe(true);
    });

    it('should execute DeleteUser behavior', async () => {
      const createResult = await sim.execute('CreateUser', {
        email: 'test@example.com',
        username: 'testuser',
      });
      const userId = (createResult.data as Record<string, unknown>).id;

      const deleteResult = await sim.execute('DeleteUser', { id: userId });
      expect(deleteResult.success).toBe(true);
      expect(sim.count('User')).toBe(0);
    });

    it('should fail for unknown behavior', async () => {
      const result = await sim.execute('UnknownBehavior', {});
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BEHAVIOR_NOT_FOUND');
    });

    it('should fail precondition check', async () => {
      const result = await sim.execute('CreateUser', {
        email: '',
        username: 'testuser',
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PRECONDITION_FAILED');
    });
  });

  describe('state management', () => {
    it('should get entity by ID', async () => {
      const createResult = await sim.execute('CreateUser', {
        email: 'test@example.com',
        username: 'testuser',
      });
      const userId = (createResult.data as Record<string, unknown>).id as string;

      const user = sim.getEntity('User', userId);
      expect(user).toBeDefined();
      expect((user as Record<string, unknown>).email).toBe('test@example.com');
    });

    it('should find entities by predicate', async () => {
      await sim.execute('CreateUser', { email: 'a@example.com', username: 'user_a' });
      await sim.execute('CreateUser', { email: 'b@example.com', username: 'user_b' });

      const found = sim.findEntities<{ username: string }>('User', u => u.username === 'user_a');
      expect(found).toHaveLength(1);
      expect(found[0].username).toBe('user_a');
    });

    it('should snapshot and restore state', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      const snapshot = sim.snapshot();

      await sim.execute('CreateUser', { email: 'another@example.com', username: 'another' });
      expect(sim.count('User')).toBe(2);

      sim.restore(snapshot);
      expect(sim.count('User')).toBe(1);
    });

    it('should undo last change', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      expect(sim.count('User')).toBe(1);

      sim.undo();
      expect(sim.count('User')).toBe(0);
    });

    it('should reset to initial state', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      expect(sim.count('User')).toBe(1);

      sim.reset();
      expect(sim.count('User')).toBe(0);
    });
  });

  describe('timeline', () => {
    it('should record behavior executions', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      
      const timeline = sim.getTimeline();
      expect(timeline.events).toHaveLength(1);
      expect(timeline.events[0].type).toBe('behavior');
      expect(timeline.events[0].behavior).toBe('CreateUser');
    });

    it('should track timeline duration', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      
      const timeline = sim.getTimeline();
      expect(timeline.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should provide timeline stats', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      
      const stats = sim.getTimelineStats();
      expect(stats.behaviorExecutions).toBe(1);
      expect(stats.successCount).toBe(1);
    });
  });

  describe('invariant checking', () => {
    it('should check invariants', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      
      const check = sim.checkInvariants();
      expect(check.valid).toBe(true);
      expect(check.violations).toHaveLength(0);
    });
  });

  describe('custom implementations', () => {
    it('should use custom behavior implementation', async () => {
      const customImpl: BehaviorImplementation = async (input, ctx) => {
        const user = ctx.createEntity('User', {
          email: input.email as string,
          username: (input.username as string).toUpperCase(), // Custom: uppercase
        });
        return { success: true, data: user };
      };

      sim.registerImplementation('CreateUser', customImpl);
      
      const result = await sim.execute('CreateUser', {
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).username).toBe('TESTUSER');
    });
  });

  describe('scenarios', () => {
    it('should play a scenario', async () => {
      const scenario = {
        name: 'Create and delete user',
        steps: [
          { behavior: 'CreateUser', input: { email: 'test@example.com', username: 'test' } },
        ],
      };

      const result = await sim.playScenario(scenario);
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
    });

    it('should record a scenario', async () => {
      sim.startRecording('Test scenario');
      
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      
      const scenario = sim.stopRecording();
      expect(scenario).toBeDefined();
      expect(scenario?.steps).toHaveLength(1);
    });
  });

  describe('replay', () => {
    it('should replay timeline', async () => {
      await sim.execute('CreateUser', { email: 'test@example.com', username: 'test' });
      const timeline = sim.getTimeline();

      sim.reset();
      expect(sim.count('User')).toBe(0);

      await sim.replay(timeline);
      expect(sim.count('User')).toBe(1);
    });
  });
});

describe('Helper functions', () => {
  it('should create simulator with createSimulator', () => {
    const sim = createSimulator(testDomain);
    expect(sim).toBeDefined();
  });

  it('should run simulation with simulate', async () => {
    const result = await simulate(testDomain, [
      { behavior: 'CreateUser', input: { email: 'test@example.com', username: 'test' } },
    ]);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
    expect(result.invariantsValid).toBe(true);
  });

  it('should define domain with defineDomain', () => {
    const domain = defineDomain('Test', {
      entities: [{ name: 'Item', fields: [] }],
    });
    expect(domain.name).toBe('Test');
    expect(domain.entities).toHaveLength(1);
  });
});
