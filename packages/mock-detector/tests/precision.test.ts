/**
 * Precision tests for mock detector
 * 
 * Tests 20 "should not flag" fixtures and 20 "should flag" fixtures
 * to measure and improve precision.
 */

import { describe, it, expect } from 'vitest';
import { scanFile } from '../src/detector.js';
import type { MockDetectorConfig } from '../src/types.js';

const DEFAULT_CONFIG: MockDetectorConfig = {
  allowlist: [],
  checkDevPaths: true,
  minConfidence: 0.5,
};

// ============================================================================
// SHOULD NOT FLAG (20 fixtures)
// ============================================================================

describe('Precision: Should NOT flag', () => {
  const shouldNotFlagFixtures = [
    {
      name: 'Legitimate success response with error handling',
      code: `
        async function processPayment(amount: number) {
          try {
            const result = await paymentGateway.charge(amount);
            return { success: true, transactionId: result.id };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      `,
    },
    {
      name: 'Real user data from database',
      code: `
        const users = await db.query('SELECT * FROM users WHERE active = true');
        return users.map(u => ({ id: u.id, name: u.name, email: u.email }));
      `,
    },
    {
      name: 'API response handling',
      code: `
        const response = await fetch('/api/users');
        if (response.ok) {
          return { status: 'success', data: await response.json() };
        }
        return { status: 'error', error: 'Failed to fetch' };
      `,
    },
    {
      name: 'Configuration object',
      code: `
        const config = {
          apiUrl: process.env.API_URL,
          timeout: 5000,
          retries: 3,
        };
      `,
    },
    {
      name: 'Type definition with example',
      code: `
        interface User {
          id: number;
          name: string;
          email: string;
        }
        // Example: { id: 1, name: 'John Doe', email: 'john@example.com' }
      `,
    },
    {
      name: 'Test file with mock data',
      code: `
        describe('UserService', () => {
          const mockUser = { id: 1, name: 'Test User' };
          it('should create user', () => {
            expect(service.create(mockUser)).toBeDefined();
          });
        });
      `,
      filePath: 'src/services/user.test.ts',
    },
    {
      name: 'Mock file in mocks directory',
      code: `
        export const mockUsers = [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ];
      `,
      filePath: 'src/mocks/users.ts',
    },
    {
      name: 'Fixture file',
      code: `
        export const fixtureData = {
          users: [{ id: 1 }, { id: 2 }],
        };
      `,
      filePath: 'tests/fixtures/data.ts',
    },
    {
      name: 'Storybook story',
      code: `
        export default {
          component: UserCard,
          args: {
            user: { id: 1, name: 'John Doe' },
          },
        };
      `,
      filePath: 'src/components/UserCard.stories.tsx',
    },
    {
      name: 'Development environment check',
      code: `
        if (process.env.NODE_ENV === 'development') {
          console.log('Development mode');
        }
      `,
    },
    {
      name: 'Error handling with status codes',
      code: `
        function handleResponse(statusCode: number) {
          if (statusCode === 200) return { success: true };
          if (statusCode === 404) return { success: false, error: 'Not found' };
          return { success: false, error: 'Unknown error' };
        }
      `,
    },
    {
      name: 'Real API call with error handling',
      code: `
        async function fetchUser(id: number) {
          const response = await api.get(\`/users/\${id}\`);
          return response.data;
        }
      `,
    },
    {
      name: 'Database query result',
      code: `
        const result = await db.query(
          'SELECT id, name FROM users WHERE id = ?',
          [userId]
        );
        return result.rows[0];
      `,
    },
    {
      name: 'Environment variable usage',
      code: `
        const apiKey = process.env.API_KEY || 'default-key';
        return { apiKey };
      `,
    },
    {
      name: 'Validation logic',
      code: `
        function validateEmail(email: string) {
          const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          return regex.test(email);
        }
      `,
    },
    {
      name: 'Real business logic',
      code: `
        function calculateTotal(items: Item[]) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `,
    },
    {
      name: 'Type guard function',
      code: `
        function isUser(obj: unknown): obj is User {
          return typeof obj === 'object' && obj !== null && 'id' in obj;
        }
      `,
    },
    {
      name: 'Utility function',
      code: `
        function formatDate(date: Date): string {
          return date.toISOString().split('T')[0];
        }
      `,
    },
    {
      name: 'Real error response',
      code: `
        try {
          await processPayment();
          return { status: 200, message: 'Payment processed' };
        } catch (error) {
          return { status: 500, error: error.message };
        }
      `,
    },
    {
      name: 'Configuration with real values',
      code: `
        export const appConfig = {
          port: parseInt(process.env.PORT || '3000'),
          database: {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
          },
        };
      `,
    },
  ];

  for (const fixture of shouldNotFlagFixtures) {
    it(`should NOT flag: ${fixture.name}`, () => {
      const findings = scanFile({
        filePath: fixture.filePath || 'src/service.ts',
        content: fixture.code,
        config: DEFAULT_CONFIG,
      });

      expect(findings.length).toBe(0);
    });
  }
});

// ============================================================================
// SHOULD FLAG (20 fixtures)
// ============================================================================

describe('Precision: Should flag', () => {
  const shouldFlagFixtures = [
    {
      name: 'Hardcoded success without error handling',
      code: `
        function processPayment() {
          return { success: true, transactionId: '12345' };
        }
      `,
      expectedType: 'hardcoded_success',
    },
    {
      name: 'Placeholder array with sentinel values',
      code: `
        const users = [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' },
        ];
      `,
      expectedType: 'placeholder_array',
    },
    {
      name: 'TODO with fake data comment',
      code: `
        function getUsers() {
          // TODO: Replace with real API call
          return [{ id: 1, name: 'Test User' }];
        }
      `,
      expectedType: 'todo_fake_data',
    },
    {
      name: 'Promise.resolve with hardcoded success',
      code: `
        async function fetchData() {
          return Promise.resolve({ success: true, data: [] });
        }
      `,
      expectedType: 'hardcoded_success',
    },
    {
      name: 'Mock response object in production code',
      code: `
        const mockResponse = {
          status: 'success',
          data: { id: 1, name: 'Mock User' },
        };
        return mockResponse;
      `,
      filePath: 'src/api/users.ts',
      expectedType: 'mock_response',
    },
    {
      name: 'Stub function in production',
      code: `
        const stubHandler = () => {
          return { ok: true };
        };
        export default stubHandler;
      `,
      filePath: 'src/handlers/payment.ts',
      expectedType: 'stub_implementation',
    },
    {
      name: 'Fake data export in production',
      code: `
        export const fakeUsers = [
          { id: 1, name: 'Fake User 1' },
          { id: 2, name: 'Fake User 2' },
        ];
      `,
      filePath: 'src/data/users.ts',
      expectedType: 'fake_data_structure',
    },
    {
      name: 'Hardcoded status code without condition',
      code: `
        function createResponse() {
          return { statusCode: 200, body: 'OK' };
        }
      `,
      expectedType: 'hardcoded_success',
    },
    {
      name: 'Return with fake comment',
      code: `
        function getData() {
          return []; // fake data for now
        }
      `,
      expectedType: 'todo_fake_data',
    },
    {
      name: 'Conditional fake data without proper gating',
      code: `
        function getUser(id: number) {
          if (!id) {
            return { id: 1, name: 'fake user' };
          }
          return fetchUser(id);
        }
      `,
      expectedType: 'todo_fake_data',
    },
    {
      name: 'Placeholder array with sequential IDs',
      code: `
        const products = [
          { id: 1, name: 'Product 1', price: 10 },
          { id: 2, name: 'Product 2', price: 20 },
        ];
      `,
      expectedType: 'placeholder_array',
    },
    {
      name: 'Empty array with TODO',
      code: `
        const items = []; // TODO: Load from API
      `,
      expectedType: 'placeholder_array',
    },
    {
      name: 'Hardcoded success in production handler',
      code: `
        export async function handler(req: Request) {
          return { success: true };
        }
      `,
      filePath: 'src/api/handler.ts',
      expectedType: 'hardcoded_success',
    },
    {
      name: 'Mock data structure in service',
      code: `
        export const mockData = {
          users: [{ id: 1 }, { id: 2 }],
        };
      `,
      filePath: 'src/services/data.ts',
      expectedType: 'mock_response',
    },
    {
      name: 'Stub implementation without actual logic',
      code: `
        export function processOrder(order: Order) {
          // Stub implementation
          return { processed: true };
        }
      `,
      filePath: 'src/services/order.ts',
      expectedType: 'stub_implementation',
    },
    {
      name: 'FIXME with placeholder',
      code: `
        function getConfig() {
          // FIXME: Replace placeholder with real config
          return { apiUrl: 'https://api.example.com' };
        }
      `,
      expectedType: 'todo_fake_data',
    },
    {
      name: 'Always returning success status',
      code: `
        function createResponse(data: any) {
          return {
            status: 'success',
            statusCode: 200,
            data,
          };
        }
      `,
      expectedType: 'hardcoded_success',
    },
    {
      name: 'Placeholder with sentinel name',
      code: `
        const user = {
          id: 1,
          name: 'placeholder',
          email: 'test@example.com',
        };
      `,
      expectedType: 'placeholder_array',
    },
    {
      name: 'Mock response in API route',
      code: `
        export default function handler() {
          return Promise.resolve({
            success: true,
            data: { id: 1, name: 'Mock' },
          });
        }
      `,
      filePath: 'src/pages/api/users.ts',
      expectedType: 'hardcoded_success',
    },
    {
      name: 'Fake data in production utility',
      code: `
        export function getSampleData() {
          return [
            { id: 1, value: 'sample1' },
            { id: 2, value: 'sample2' },
          ];
        }
      `,
      filePath: 'src/utils/data.ts',
      expectedType: 'fake_data_structure',
    },
  ];

  for (const fixture of shouldFlagFixtures) {
    it(`should flag: ${fixture.name}`, () => {
      const findings = scanFile({
        filePath: fixture.filePath || 'src/service.ts',
        content: fixture.code,
        config: DEFAULT_CONFIG,
      });

      expect(findings.length).toBeGreaterThan(0);
      
      if (fixture.expectedType) {
        const hasExpectedType = findings.some(f => f.type === fixture.expectedType);
        expect(hasExpectedType).toBe(true);
      }

      // All findings should have confidence >= minConfidence
      findings.forEach(finding => {
        expect(finding.confidence).toBeGreaterThanOrEqual(DEFAULT_CONFIG.minConfidence);
      });
    });
  }
});

// ============================================================================
// PRECISION METRICS
// ============================================================================

describe('Precision metrics', () => {
  it('should calculate precision summary', () => {
    const { calculateSummary } = require('../src/detector.js');
    
    const mockFindings = [
      {
        id: '1',
        type: 'hardcoded_success' as const,
        severity: 'high' as const,
        location: { file: 'test.ts', line: 1 },
        reason: 'Test',
        confidence: 0.8,
      },
      {
        id: '2',
        type: 'placeholder_array' as const,
        severity: 'medium' as const,
        location: { file: 'test.ts', line: 2 },
        reason: 'Test',
        confidence: 0.6,
      },
    ];

    const summary = calculateSummary(mockFindings, 10);
    
    expect(summary.totalFiles).toBe(10);
    expect(summary.totalFindings).toBe(2);
    expect(summary.findingsByType.hardcoded_success).toBe(1);
    expect(summary.findingsByType.placeholder_array).toBe(1);
    expect(summary.precision).toBeDefined();
  });
});
