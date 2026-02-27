/**
 * Inference Tests
 *
 * Test the spec inference functionality.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { infer } from '../src/index.js';

describe('Spec Inference', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'isl-inference-'));
  });

  describe('TypeScript Inference', () => {
    it('should infer entity from interface', async () => {
      const sourceFile = path.join(tempDir, 'user.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
interface User {
  id: string;
  email: string;
  username: string;
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
}
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'UserManagement',
      });

      expect(result.isl).toContain('entity User');
      expect(result.isl).toContain('id:');
      expect(result.isl).toContain('email:');
      expect(result.isl).toContain('[immutable');
      expect(result.parsed.types).toHaveLength(1);
    });

    it('should infer behavior from async function', async () => {
      const sourceFile = path.join(tempDir, 'createUser.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
interface User {
  id: string;
  email: string;
  username: string;
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
}

async function createUser(email: string, username: string): Promise<User> {
  if (!email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (username.length < 3) {
    throw new Error('Username too short');
  }
  
  const existing = await db.users.findByEmail(email);
  if (existing) {
    throw new Error('Email already exists');
  }
  
  const user = await db.users.create({
    id: uuid(),
    email,
    username,
    status: 'pending',
    createdAt: new Date(),
  });
  
  return user;
}
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'UserManagement',
      });

      expect(result.isl).toContain('behavior CreateUser');
      expect(result.isl).toContain('input {');
      expect(result.isl).toContain('email:');
      expect(result.isl).toContain('username:');
      expect(result.isl).toContain('output {');
      expect(result.isl).toContain('errors {');
      expect(result.isl).toContain('INVALID');
      expect(result.parsed.functions).toHaveLength(1);
    });

    it('should infer enum from string literal union', async () => {
      const sourceFile = path.join(tempDir, 'status.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
type UserStatus = 'pending' | 'active' | 'suspended';
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'Test',
      });

      expect(result.isl).toContain('enum UserStatus');
      expect(result.isl).toContain('PENDING');
      expect(result.isl).toContain('ACTIVE');
      expect(result.isl).toContain('SUSPENDED');
    });

    it('should extract preconditions from validation logic', async () => {
      const sourceFile = path.join(tempDir, 'validate.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
async function login(email: string, password: string): Promise<boolean> {
  if (!email.includes('@')) {
    throw new Error('Invalid email format');
  }
  if (password.length < 8) {
    throw new Error('Password too short');
  }
  return true;
}
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'Auth',
      });

      expect(result.isl).toContain('preconditions');
      expect(result.isl).toContain('email');
      expect(result.isl).toContain('password');
      expect(result.parsed.validations.length).toBeGreaterThan(0);
    });

    it('should calculate confidence scores', async () => {
      const sourceFile = path.join(tempDir, 'simple.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
interface Product {
  id: string;
  name: string;
  price: number;
}
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'Products',
      });

      expect(result.confidence.overall).toBeGreaterThan(0);
      expect(result.confidence.entities.get('Product')).toBeGreaterThan(0);
    });
  });

  describe('Test Case Enhancement', () => {
    it('should enhance behavior with test cases', async () => {
      const sourceFile = path.join(tempDir, 'func.ts');
      const testFile = path.join(tempDir, 'func.test.ts');

      await fs.promises.writeFile(
        sourceFile,
        `
async function createOrder(productId: string, quantity: number): Promise<{ id: string }> {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive');
  }
  return { id: 'order-123' };
}
`
      );

      await fs.promises.writeFile(
        testFile,
        `
import { createOrder } from './func';

test('should create order with valid quantity', async () => {
  const result = await createOrder('prod-1', 5);
  expect(result.id).toBeDefined();
});

test('should reject zero quantity', async () => {
  await expect(createOrder('prod-1', 0)).rejects.toThrow('Quantity must be positive');
});

test('should reject negative quantity', async () => {
  await expect(createOrder('prod-1', -1)).rejects.toThrow();
});
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        testFiles: [testFile],
        domainName: 'Orders',
      });

      expect(result.parsed.testCases.length).toBeGreaterThan(0);
      // Higher confidence with tests
      expect(result.confidence.behaviors.get('CreateOrder')).toBeGreaterThan(0.5);
    });
  });

  describe('Generated ISL Format', () => {
    it('should generate valid ISL structure', async () => {
      const sourceFile = path.join(tempDir, 'complete.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

async function confirmOrder(orderId: string): Promise<Order> {
  const order = await db.orders.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  if (order.status !== 'PENDING') {
    throw new Error('Order cannot be confirmed');
  }
  
  order.status = 'CONFIRMED';
  order.updatedAt = new Date();
  
  return await db.orders.update(order);
}
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'OrderManagement',
        inferInvariants: true,
      });

      // Check structure
      expect(result.isl).toContain('domain OrderManagement');
      expect(result.isl).toContain('version: "1.0.0"');
      expect(result.isl).toContain('enum OrderStatus');
      expect(result.isl).toContain('entity Order');
      expect(result.isl).toContain('behavior ConfirmOrder');

      // Check enum values
      expect(result.isl).toContain('PENDING');
      expect(result.isl).toContain('CONFIRMED');
      expect(result.isl).toContain('SHIPPED');
      expect(result.isl).toContain('DELIVERED');

      // Check entity fields
      expect(result.isl).toContain('id:');
      expect(result.isl).toContain('user_id:');
      expect(result.isl).toContain('status:');
      expect(result.isl).toContain('total:');

      // Check behavior
      expect(result.isl).toContain('input {');
      expect(result.isl).toContain('output {');
      expect(result.isl).toContain('errors {');
    });
  });

  describe('Diagnostics', () => {
    it('should report low confidence warnings', async () => {
      const sourceFile = path.join(tempDir, 'minimal.ts');
      await fs.promises.writeFile(
        sourceFile,
        `
interface Minimal {
  x: number;
}
`
      );

      const result = await infer({
        language: 'typescript',
        sourceFiles: [sourceFile],
        domainName: 'Test',
        confidenceThreshold: 0.8,
      });

      // Should have warning about low confidence
      const hasWarning = result.diagnostics.some(
        (d) => d.severity === 'warning' && d.message.includes('confidence')
      );
      expect(hasWarning).toBe(true);
    });
  });
});

describe('Example: Full User Service', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'isl-example-'));
  });

  it('should infer complete spec from user service', async () => {
    const sourceFile = path.join(tempDir, 'userService.ts');
    await fs.promises.writeFile(
      sourceFile,
      `
interface User {
  id: string;
  email: string;
  username: string;
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
}

async function createUser(email: string, username: string): Promise<User> {
  if (!email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (username.length < 3) {
    throw new Error('Username too short');
  }
  
  const existing = await db.users.findByEmail(email);
  if (existing) {
    throw new Error('Email already exists');
  }
  
  const user = await db.users.create({
    id: uuid(),
    email,
    username,
    status: 'pending',
    createdAt: new Date(),
  });
  
  return user;
}
`
    );

    const result = await infer({
      language: 'typescript',
      sourceFiles: [sourceFile],
      domainName: 'UserService',
      inferInvariants: true,
    });

    // Verify the expected output structure
    expect(result.isl).toContain('domain UserService');
    expect(result.isl).toContain('enum Status');
    expect(result.isl).toContain('entity User');
    expect(result.isl).toContain('behavior CreateUser');

    // Verify preconditions were inferred
    expect(result.isl).toContain('email');
    expect(result.isl).toContain('username');

    // Verify errors were extracted
    expect(result.isl).toContain('INVALID');
    expect(result.isl).toContain('EMAIL_ALREADY_EXISTS');

    // Should have reasonable confidence
    expect(result.confidence.overall).toBeGreaterThan(0.5);
  });
});
