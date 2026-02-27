/**
 * Payments Domain Contract Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContractTestHarness } from '../src/harness.js';
import { ScenarioParser } from '../src/scenario-parser.js';
import { InMemoryPaymentAdapter } from '../src/mock-adapters.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const paymentAdapter = new InMemoryPaymentAdapter();

async function createPaymentHandler(input: {
  amount: number;
  currency: string;
}): Promise<{ success: boolean; id?: string; amount?: number; currency?: string; error?: { code: string } }> {
  if (input.amount <= 0) {
    return { success: false, error: { code: 'INVALID_AMOUNT' } };
  }

  if (input.currency.length !== 3) {
    return { success: false, error: { code: 'INVALID_CURRENCY' } };
  }

  const payment = await paymentAdapter.createPayment(input.amount, input.currency);
  return {
    success: true,
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
  };
}

describe('CreatePayment Contract Tests', () => {
  let harness: ContractTestHarness;
  let parser: ScenarioParser;

  beforeEach(() => {
    harness = new ContractTestHarness({ timeout: 5000 });
    parser = new ScenarioParser();
    paymentAdapter.reset();

    harness.bindBehavior('CreatePayment', createPaymentHandler);
  });

  it('successful payment creation', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'payments-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const scenarios = parsed.find((p) => p.behaviorName === 'CreatePayment');
    
    if (!scenarios) {
      throw new Error('CreatePayment scenarios not found');
    }

    const scenario = scenarios.scenarios.find((s) => s.name === 'successful payment creation');
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const testCase = harness.scenarioToTestCase(scenario);
    const result = await harness.runTestCase(testCase);

    expect(result.passed).toBe(true);
    expect(result.actualResult).toHaveProperty('success', true);
    expect(result.actualResult).toHaveProperty('amount', 100.00);
  });

  it('invalid amount', async () => {
    const islContent = readFileSync(
      join(__dirname, 'fixtures', 'payments-with-scenarios.isl'),
      'utf-8'
    );
    const parsed = parser.parseScenarios(islContent);
    const scenarios = parsed.find((p) => p.behaviorName === 'CreatePayment');
    
    if (!scenarios) {
      throw new Error('CreatePayment scenarios not found');
    }

    const scenario = scenarios.scenarios.find((s) => s.name === 'invalid amount');
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
