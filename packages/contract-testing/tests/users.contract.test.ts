/**
 * User Management Domain Contract Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContractTestHarness } from '../src/harness.js';
import { ScenarioParser } from '../src/scenario-parser.js';
import { InMemoryUserAdapter } from '../src/mock-adapters.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const userAdapter = new InMemoryUserAdapter();

async function createUserHandler(input: {
  email: string;
  name: string;
}): Promise<{ success: boolean; id?: string; email?: string; name?: string; error?: { code: string } }> {
  const existing = await userAdapter.getUserByEmail(input.email);
  if (existing) {
    return { success: false, error: { code: 'EMAIL_ALREADY_EXISTS' } };
  }

  const user = await userAdapter.createUser(input);
  return {
    success: true,
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

describe('CreateUser Contract Tests', () => {
  let harness: ContractTestHarness;
  let parser: ScenarioParser;

  beforeEach(() => {
    harness = new ContractTestHarness({ timeout: 5000 });
    parser = new ScenarioParser();
    userAdapter.reset();

    // Setup existing user for duplicate test
    userAdapter.createUser({ email: 'existing@example.com', name: 'Existing User' });

    harness.bindBehavior('CreateUser', createUserHandler);
  });

  it('successful user creation', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'users-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const scenarios = parsed.find((p) => p.behaviorName === 'CreateUser');
    
    if (!scenarios) {
      throw new Error('CreateUser scenarios not found');
    }

    const scenario = scenarios.scenarios.find((s) => s.name === 'successful user creation');
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const testCase = harness.scenarioToTestCase(scenario);
    const result = await harness.runTestCase(testCase);

    expect(result.passed).toBe(true);
    expect(result.actualResult).toHaveProperty('success', true);
    expect(result.actualResult).toHaveProperty('email', 'test@example.com');
    expect(result.actualResult).toHaveProperty('name', 'Test User');
  });

  it('duplicate email', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'users-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const scenarios = parsed.find((p) => p.behaviorName === 'CreateUser');
    
    if (!scenarios) {
      throw new Error('CreateUser scenarios not found');
    }

    const scenario = scenarios.scenarios.find((s) => s.name === 'duplicate email');
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const testCase = harness.scenarioToTestCase(scenario);
    const result = await harness.runTestCase(testCase);

    expect(result.passed).toBe(true);
    expect(result.actualResult).toHaveProperty('success', false);
    expect(result.actualResult).toHaveProperty('error');
  });
});
