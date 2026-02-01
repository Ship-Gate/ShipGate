/**
 * ISL Domain Simulator Demo
 * 
 * Demonstrates the simulator package functionality.
 */

import { 
  Simulator, 
  defineDomain, 
  simulate,
  type BehaviorImplementation,
} from './packages/simulator/src/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEFINE A DOMAIN
// ═══════════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  ISL Domain Simulator Demo');
console.log('═══════════════════════════════════════════════════════════════════\n');

const authDomain = defineDomain('Auth', {
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: 'UUID', modifiers: ['immutable', 'unique'] },
        { name: 'email', type: 'Email', modifiers: ['unique'] },
        { name: 'username', type: 'String', modifiers: [] },
        { name: 'status', type: 'UserStatus', modifiers: [], defaultValue: 'ACTIVE' },
        { name: 'login_count', type: 'Integer', modifiers: [], defaultValue: 0 },
        { name: 'created_at', type: 'Timestamp', modifiers: ['immutable'] },
        { name: 'updated_at', type: 'Timestamp', modifiers: [] },
      ],
      invariants: ['login_count >= 0'],
    },
    {
      name: 'Session',
      fields: [
        { name: 'id', type: 'UUID', modifiers: ['immutable', 'unique'] },
        { name: 'user_id', type: 'UUID', modifiers: ['immutable'] },
        { name: 'ip_address', type: 'String', modifiers: [] },
        { name: 'created_at', type: 'Timestamp', modifiers: ['immutable'] },
      ],
    },
  ],
  behaviors: [
    {
      name: 'CreateUser',
      description: 'Register a new user',
      inputs: [
        { name: 'email', type: 'Email', modifiers: [] },
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
      name: 'Login',
      description: 'Log in a user',
      inputs: [
        { name: 'email', type: 'Email', modifiers: [] },
        { name: 'ip_address', type: 'String', modifiers: [] },
      ],
      outputs: {
        successType: 'Session',
        errors: [
          { code: 'USER_NOT_FOUND', when: 'User does not exist' },
          { code: 'USER_LOCKED', when: 'User account is locked' },
        ],
      },
      preconditions: ['input.email.length > 0'],
      postconditions: [],
      invariants: [],
    },
    {
      name: 'GetUser',
      description: 'Get user by ID',
      inputs: [{ name: 'id', type: 'UUID', modifiers: [] }],
      outputs: {
        successType: 'User',
        errors: [{ code: 'NOT_FOUND', when: 'User not found' }],
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
        errors: [{ code: 'NOT_FOUND', when: 'User not found' }],
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

console.log('1. Domain Defined: Auth');
console.log(`   - Entities: ${authDomain.entities.map(e => e.name).join(', ')}`);
console.log(`   - Behaviors: ${authDomain.behaviors.map(b => b.name).join(', ')}\n`);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CREATE SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════

const sim = new Simulator({
  domain: authDomain,
  seed: 12345, // Deterministic for demo
});

console.log('2. Simulator Created');
console.log(`   - Available behaviors: ${sim.getAvailableBehaviors().join(', ')}\n`);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. REGISTER CUSTOM IMPLEMENTATION (Optional)
// ═══════════════════════════════════════════════════════════════════════════════

const loginImpl: BehaviorImplementation = async (input, ctx) => {
  // Find user by email
  const users = ctx.findEntities<{ id: string; email: string; login_count: number; status: string }>(
    'User',
    (u) => u.email === input.email
  );
  
  if (users.length === 0) {
    return { 
      success: false, 
      error: { code: 'USER_NOT_FOUND', message: 'User not found' } 
    };
  }
  
  const user = users[0];
  
  if (user.status === 'LOCKED') {
    return {
      success: false,
      error: { code: 'USER_LOCKED', message: 'Account is locked' },
    };
  }
  
  // Update login count
  ctx.updateEntity('User', user.id, { login_count: user.login_count + 1 });
  
  // Create session
  const session = ctx.createEntity('Session', {
    user_id: user.id,
    ip_address: input.ip_address as string,
  });
  
  return { success: true, data: session };
};

sim.registerImplementation('Login', loginImpl);
console.log('3. Custom Login Implementation Registered\n');

// ═══════════════════════════════════════════════════════════════════════════════
// 4. EXECUTE BEHAVIORS
// ═══════════════════════════════════════════════════════════════════════════════

async function runDemo() {
  console.log('4. Executing Behaviors');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  // Create users
  console.log('   Creating users...');
  const user1 = await sim.execute('CreateUser', {
    email: 'alice@example.com',
    username: 'alice',
  });
  console.log(`   → Created: ${(user1.data as any)?.username} (${(user1.data as any)?.id?.slice(0, 8)}...)`);
  
  const user2 = await sim.execute('CreateUser', {
    email: 'bob@example.com', 
    username: 'bob',
  });
  console.log(`   → Created: ${(user2.data as any)?.username} (${(user2.data as any)?.id?.slice(0, 8)}...)`);
  
  console.log(`\n   Current state: ${sim.count('User')} users, ${sim.count('Session')} sessions\n`);
  
  // Login
  console.log('   Logging in alice...');
  const session = await sim.execute('Login', {
    email: 'alice@example.com',
    ip_address: '192.168.1.100',
  });
  console.log(`   → Session created: ${(session.data as any)?.id?.slice(0, 8)}...`);
  console.log(`   → User login count updated\n`);
  
  // Check state
  const alice = sim.findEntities<{ username: string; login_count: number }>(
    'User', 
    u => u.username === 'alice'
  )[0];
  console.log(`   Alice's login count: ${alice?.login_count}`);
  
  console.log(`\n   Current state: ${sim.count('User')} users, ${sim.count('Session')} sessions\n`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. CHECK INVARIANTS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log('5. Checking Invariants');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  const check = sim.checkInvariants();
  console.log(`   Valid: ${check.valid ? '✓ Yes' : '✗ No'}`);
  console.log(`   Checked: ${check.checked} invariants`);
  console.log(`   Passed: ${check.passed}`);
  console.log(`   Failed: ${check.failed}\n`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log('6. Timeline');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  const timeline = sim.getTimeline();
  console.log(`   Total events: ${timeline.events.length}`);
  console.log(`   Duration: ${timeline.durationMs}ms\n`);
  
  console.log('   Events:');
  for (const event of timeline.events) {
    if (event.type === 'behavior') {
      const status = event.output?.success ? '✓' : '✗';
      console.log(`   ${status} ${event.behavior} @ +${event.relativeTime}ms (${event.durationMs}ms)`);
    }
  }
  
  const stats = sim.getTimelineStats();
  console.log(`\n   Stats:`);
  console.log(`   - Behavior executions: ${stats.behaviorExecutions}`);
  console.log(`   - Success rate: ${(stats.successRate * 100).toFixed(0)}%`);
  console.log(`   - Average duration: ${stats.averageDurationMs.toFixed(2)}ms\n`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. SCENARIO RECORDING & REPLAY
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log('7. Scenario Recording & Replay');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  // Start recording
  sim.startRecording('User Registration Flow');
  
  await sim.execute('CreateUser', {
    email: 'charlie@example.com',
    username: 'charlie',
  });
  
  await sim.execute('Login', {
    email: 'charlie@example.com',
    ip_address: '10.0.0.1',
  });
  
  const scenario = sim.stopRecording();
  console.log(`   Recorded scenario: "${scenario?.name}"`);
  console.log(`   Steps: ${scenario?.steps.length}\n`);
  
  // Replay
  console.log('   Replaying on fresh simulator...');
  const freshSim = new Simulator({ domain: authDomain, seed: 99999 });
  freshSim.registerImplementation('Login', loginImpl);
  
  const result = await freshSim.playScenario(scenario!);
  console.log(`   Replay success: ${result.success ? '✓ Yes' : '✗ No'}`);
  console.log(`   Steps executed: ${result.steps.length}`);
  console.log(`   Duration: ${result.durationMs}ms\n`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. SNAPSHOT & RESTORE
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log('8. Snapshot & Restore');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  console.log(`   Current users: ${sim.count('User')}`);
  const snapshot = sim.snapshot();
  console.log('   → Snapshot taken\n');
  
  // Delete all users
  const users = sim.getEntities<{ id: string }>('User');
  for (const user of users) {
    await sim.execute('DeleteUser', { id: user.id });
  }
  console.log(`   After deletions: ${sim.count('User')} users`);
  
  // Restore
  sim.restore(snapshot);
  console.log(`   After restore: ${sim.count('User')} users\n`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. QUICK SIMULATE HELPER
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log('9. Quick Simulate Helper');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  const quickResult = await simulate(authDomain, [
    { behavior: 'CreateUser', input: { email: 'quick@test.com', username: 'quickuser' } },
  ]);
  
  console.log(`   Results: ${quickResult.results.length} behaviors executed`);
  console.log(`   All succeeded: ${quickResult.results.every(r => r.success) ? '✓' : '✗'}`);
  console.log(`   Invariants valid: ${quickResult.invariantsValid ? '✓' : '✗'}\n`);
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Demo Complete!');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`
  The ISL Simulator provides:
  
  ✓ Domain-based state management
  ✓ Behavior execution with auto-implementations
  ✓ Custom behavior implementations  
  ✓ Precondition/postcondition checking
  ✓ Invariant validation
  ✓ Event timeline recording
  ✓ Scenario recording & playback
  ✓ State snapshots & restore
  ✓ Undo support
  
  Use cases:
  • Test ISL specifications without real implementations
  • Explore domain behavior interactively
  • Generate test scenarios
  • Validate invariants during development
  • Debug behavior execution with timeline
  `);
}

runDemo().catch(console.error);
