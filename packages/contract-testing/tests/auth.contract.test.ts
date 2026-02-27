/**
 * Auth Domain Contract Tests
 * 
 * Tests generated from ISL scenarios for UserAuthentication domain.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContractTestHarness } from '../src/harness.js';
import { ScenarioParser } from '../src/scenario-parser.js';
import { InMemoryAuthAdapter } from '../src/mock-adapters.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock handlers using InMemoryAuthAdapter
const authAdapter = new InMemoryAuthAdapter();

async function loginHandler(input: {
  email: string;
  password: string;
  ip_address: string;
}): Promise<{ success: boolean; id?: string; user_id?: string; error?: { code: string } }> {
  const user = await authAdapter.getUserByEmail(input.email);
  
  if (!user) {
    return { success: false, error: { code: 'USER_NOT_FOUND' } };
  }

  const isValid = await authAdapter.verifyPassword(input.password, user.password_hash);
  if (!isValid) {
    return { success: false, error: { code: 'INVALID_CREDENTIALS' } };
  }

  const session = await authAdapter.createSession(user.id, input.ip_address);
  return {
    success: true,
    id: session.id,
    user_id: session.user_id,
  };
}

async function registerHandler(input: {
  email: string;
  password: string;
  confirm_password: string;
}): Promise<{ success: boolean; id?: string; email?: string; error?: { code: string } }> {
  const existing = await authAdapter.getUserByEmail(input.email);
  if (existing) {
    return { success: false, error: { code: 'EMAIL_ALREADY_EXISTS' } };
  }

  if (input.password !== input.confirm_password) {
    return { success: false, error: { code: 'PASSWORDS_DO_NOT_MATCH' } };
  }

  const passwordHash = `hash_${input.password}`;
  const user = await authAdapter.createUser(input.email, passwordHash);
  
  return {
    success: true,
    id: user.id,
    email: user.email,
  };
}

describe('Login Contract Tests', () => {
  let harness: ContractTestHarness;
  let parser: ScenarioParser;

  beforeEach(() => {
    harness = new ContractTestHarness({ timeout: 5000 });
    parser = new ScenarioParser();
    authAdapter.reset();

    // Bind behavior handlers
    harness.bindBehavior('Login', loginHandler);
    harness.bindBehavior('Register', registerHandler);

    // Setup test data
    authAdapter.createUser('alice@example.com', 'hash_password123');
  });

  it('successful login', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'auth-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const loginScenarios = parsed.find((p) => p.behaviorName === 'Login');
    
    if (!loginScenarios) {
      throw new Error('Login scenarios not found');
    }

    const scenario = loginScenarios.scenarios.find((s) => s.name === 'successful login');
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const testCase = harness.scenarioToTestCase(scenario);
    const result = await harness.runTestCase(testCase);

    expect(result.passed).toBe(true);
    expect(result.actualResult).toHaveProperty('success', true);
    expect(result.actualResult).toHaveProperty('id');
  });

  it('invalid credentials', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'auth-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const loginScenarios = parsed.find((p) => p.behaviorName === 'Login');
    
    if (!loginScenarios) {
      throw new Error('Login scenarios not found');
    }

    const scenario = loginScenarios.scenarios.find((s) => s.name === 'invalid credentials');
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

describe('Register Contract Tests', () => {
  let harness: ContractTestHarness;
  let parser: ScenarioParser;

  beforeEach(() => {
    harness = new ContractTestHarness({ timeout: 5000 });
    parser = new ScenarioParser();
    authAdapter.reset();

    harness.bindBehavior('Register', registerHandler);
  });

  it('successful registration', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'auth-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const registerScenarios = parsed.find((p) => p.behaviorName === 'Register');
    
    if (!registerScenarios) {
      throw new Error('Register scenarios not found');
    }

    const scenario = registerScenarios.scenarios.find((s) => s.name === 'successful registration');
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const testCase = harness.scenarioToTestCase(scenario);
    const result = await harness.runTestCase(testCase);

    expect(result.passed).toBe(true);
    expect(result.actualResult).toHaveProperty('success', true);
    expect(result.actualResult).toHaveProperty('email');
  });
});
