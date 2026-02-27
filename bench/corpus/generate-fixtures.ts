#!/usr/bin/env node
/**
 * Generate corpus fixtures for gate calibration
 * 
 * Creates 50+ good and 50+ bad implementations with various violation patterns.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

const CORPUS_DIR = resolve(__dirname);

// ============================================================================
// Good Implementations (should SHIP)
// ============================================================================

const goodFixtures = [
  {
    id: 'auth-login-clean',
    spec: `domain Auth {
  behavior Login {
    input { email: Email, password: String }
    output { session: Session }
    precondition { email.length > 0 }
    postcondition { session.userId != null }
  }
}`,
    impl: `export async function login(email: string, password: string): Promise<Session> {
  if (!email || email.length === 0) {
    throw new Error('Email required');
  }
  
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }
  
  const isValid = await verifyPassword(user, password);
  if (!isValid) {
    throw new Error('Invalid password');
  }
  
  const session = await createSession(user.id);
  return session;
}`,
    metadata: {
      expectedVerdict: 'SHIP',
      category: 'auth',
      description: 'Clean login implementation',
    },
  },
  
  {
    id: 'crud-create-user',
    spec: `domain Users {
  behavior CreateUser {
    input { email: Email, name: String }
    output { user: User }
    precondition { email.length > 0 && name.length > 0 }
    postcondition { user.id != null && user.email == email }
  }
}`,
    impl: `export async function createUser(email: string, name: string): Promise<User> {
  if (!email || email.length === 0) {
    throw new Error('Email required');
  }
  if (!name || name.length === 0) {
    throw new Error('Name required');
  }
  
  const existing = await db.users.findOne({ email });
  if (existing) {
    throw new Error('User already exists');
  }
  
  const user = await db.users.create({
    email,
    name,
    createdAt: new Date(),
  });
  
  return user;
}`,
    metadata: {
      expectedVerdict: 'SHIP',
      category: 'crud',
      description: 'Clean user creation',
    },
  },
  
  {
    id: 'payment-charge-secure',
    spec: `domain Payments {
  behavior Charge {
    input { amount: Number, token: String }
    output { charge: Charge }
    precondition { amount > 0 && token.length > 0 }
    postcondition { charge.amount == amount && charge.status == 'completed' }
  }
}`,
    impl: `export async function charge(amount: number, token: string): Promise<Charge> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  if (!token || token.length === 0) {
    throw new Error('Token required');
  }
  
  const paymentMethod = await validateToken(token);
  if (!paymentMethod) {
    throw new Error('Invalid payment token');
  }
  
  const charge = await paymentProcessor.charge({
    amount,
    paymentMethod,
  });
  
  return charge;
}`,
    metadata: {
      expectedVerdict: 'SHIP',
      category: 'payments',
      description: 'Secure payment charge',
    },
  },
];

// ============================================================================
// Bad Implementations (should NO_SHIP)
// ============================================================================

const badFixtures = [
  {
    id: 'auth-login-hardcoded-password',
    spec: `domain Auth {
  behavior Login {
    input { email: Email, password: String }
    output { session: Session }
    precondition { email.length > 0 }
    postcondition { session.userId != null }
  }
}`,
    impl: `export async function login(email: string, password: string): Promise<Session> {
  // Hardcoded password check - SECURITY VIOLATION
  if (password === 'admin123') {
    return { userId: 'admin', token: 'hardcoded-token' };
  }
  
  const user = await findUserByEmail(email);
  return { userId: user.id, token: 'token' };
}`,
    metadata: {
      expectedVerdict: 'NO_SHIP',
      category: 'auth',
      description: 'Hardcoded password check',
      knownViolations: [
        {
          ruleId: 'no-hardcoded-secrets',
          severity: 'critical',
          description: 'Hardcoded password in code',
        },
      ],
    },
  },
  
  {
    id: 'auth-login-no-validation',
    spec: `domain Auth {
  behavior Login {
    input { email: Email, password: String }
    output { session: Session }
    precondition { email.length > 0 }
    postcondition { session.userId != null }
  }
}`,
    impl: `export async function login(email: string, password: string): Promise<Session> {
  // Missing precondition check - violates spec
  const user = await findUserByEmail(email);
  return { userId: user.id, token: 'token' };
}`,
    metadata: {
      expectedVerdict: 'NO_SHIP',
      category: 'auth',
      description: 'Missing precondition validation',
      knownViolations: [
        {
          ruleId: 'precondition-violation',
          severity: 'high',
          description: 'Precondition not checked',
        },
      ],
    },
  },
  
  {
    id: 'payment-charge-sql-injection',
    spec: `domain Payments {
  behavior Charge {
    input { amount: Number, userId: String }
    output { charge: Charge }
    precondition { amount > 0 }
    postcondition { charge.amount == amount }
  }
}`,
    impl: `export async function charge(amount: number, userId: string): Promise<Charge> {
  // SQL injection vulnerability
  const query = \`SELECT * FROM users WHERE id = '\${userId}'\`;
  const user = await db.query(query);
  
  return { amount, userId: user.id };
}`,
    metadata: {
      expectedVerdict: 'NO_SHIP',
      category: 'payments',
      description: 'SQL injection vulnerability',
      knownViolations: [
        {
          ruleId: 'no-sql-injection',
          severity: 'critical',
          description: 'SQL injection vulnerability',
        },
      ],
    },
  },
  
  {
    id: 'crud-create-no-auth',
    spec: `domain Users {
  behavior CreateUser {
    input { email: Email, name: String }
    output { user: User }
    precondition { email.length > 0 }
    postcondition { user.id != null }
  }
}`,
    impl: `export async function createUser(email: string, name: string): Promise<User> {
  // Missing authentication check - anyone can create users
  const user = await db.users.create({ email, name });
  return user;
}`,
    metadata: {
      expectedVerdict: 'NO_SHIP',
      category: 'crud',
      description: 'Missing authentication',
      knownViolations: [
        {
          ruleId: 'unprotected-sensitive-route',
          severity: 'high',
          description: 'Route not protected by authentication',
        },
      ],
    },
  },
  
  {
    id: 'payment-charge-console-log',
    spec: `domain Payments {
  behavior Charge {
    input { amount: Number, token: String }
    output { charge: Charge }
    precondition { amount > 0 }
    postcondition { charge.amount == amount }
  }
}`,
    impl: `export async function charge(amount: number, token: string): Promise<Charge> {
  // Console.log in production code
  console.log('Charging:', amount, 'Token:', token);
  
  const charge = await paymentProcessor.charge({ amount, token });
  return charge;
}`,
    metadata: {
      expectedVerdict: 'NO_SHIP',
      category: 'payments',
      description: 'Console.log in production',
      knownViolations: [
        {
          ruleId: 'no-console-log',
          severity: 'medium',
          description: 'Console.log found in production code',
        },
      ],
    },
  },
];

// ============================================================================
// Generator
// ============================================================================

async function generateFixtures(): Promise<void> {
  console.log('Generating corpus fixtures...\n');
  
  // Generate more fixtures programmatically
  const categories = ['auth', 'payments', 'crud', 'uploads', 'webhooks', 'search'];
  const violationTypes = [
    { id: 'hardcoded-secret', severity: 'critical' },
    { id: 'sql-injection', severity: 'critical' },
    { id: 'no-auth', severity: 'high' },
    { id: 'console-log', severity: 'medium' },
    { id: 'missing-validation', severity: 'high' },
    { id: 'precondition-violation', severity: 'high' },
    { id: 'postcondition-violation', severity: 'high' },
    { id: 'any-type', severity: 'medium' },
    { id: 'mock-data', severity: 'medium' },
  ];
  
  // Generate good fixtures
  let goodCount = 0;
  for (const fixture of goodFixtures) {
    await writeFixture('good', fixture);
    goodCount++;
  }
  
  // Generate more good fixtures
  for (let i = goodCount; i < 50; i++) {
    const category = categories[i % categories.length];
    const fixture = generateGoodFixture(category, i);
    await writeFixture('good', fixture);
  }
  
  // Generate bad fixtures
  let badCount = 0;
  for (const fixture of badFixtures) {
    await writeFixture('bad', fixture);
    badCount++;
  }
  
  // Generate more bad fixtures with various violations
  for (let i = badCount; i < 50; i++) {
    const category = categories[i % categories.length];
    const violation = violationTypes[i % violationTypes.length];
    const fixture = generateBadFixture(category, violation, i);
    await writeFixture('bad', fixture);
  }
  
  console.log(`✓ Generated ${goodCount + 50} good fixtures`);
  console.log(`✓ Generated ${badCount + 50} bad fixtures`);
  console.log(`\nTotal: ${goodCount + 50 + badCount + 50} fixtures\n`);
}

function generateGoodFixture(category: string, index: number): any {
  const id = `${category}-clean-${index}`;
  
  return {
    id,
    spec: generateSpec(category),
    impl: generateGoodImpl(category),
    metadata: {
      expectedVerdict: 'SHIP',
      category,
      description: `Clean ${category} implementation ${index}`,
    },
  };
}

function generateBadFixture(category: string, violation: any, index: number): any {
  const id = `${category}-${violation.id}-${index}`;
  
  return {
    id,
    spec: generateSpec(category),
    impl: generateBadImpl(category, violation),
    metadata: {
      expectedVerdict: 'NO_SHIP',
      category,
      description: `${category} with ${violation.id} violation`,
      knownViolations: [
        {
          ruleId: violation.id,
          severity: violation.severity,
          description: violation.id,
        },
      ],
    },
  };
}

function generateSpec(category: string): string {
  const specs: Record<string, string> = {
    auth: `domain Auth {
  behavior Login {
    input { email: Email, password: String }
    output { session: Session }
    precondition { email.length > 0 }
    postcondition { session.userId != null }
  }
}`,
    payments: `domain Payments {
  behavior Charge {
    input { amount: Number, token: String }
    output { charge: Charge }
    precondition { amount > 0 }
    postcondition { charge.amount == amount }
  }
}`,
    crud: `domain Users {
  behavior CreateUser {
    input { email: Email, name: String }
    output { user: User }
    precondition { email.length > 0 }
    postcondition { user.id != null }
  }
}`,
    uploads: `domain Uploads {
  behavior UploadFile {
    input { file: File, userId: String }
    output { upload: Upload }
    precondition { file.size > 0 }
    postcondition { upload.url != null }
  }
}`,
    webhooks: `domain Webhooks {
  behavior SendWebhook {
    input { event: String, payload: Object }
    output { delivery: Delivery }
    precondition { event.length > 0 }
    postcondition { delivery.status == 'sent' }
  }
}`,
    search: `domain Search {
  behavior Search {
    input { query: String }
    output { results: Array<Result> }
    precondition { query.length > 0 }
    postcondition { results.length >= 0 }
  }
}`,
  };
  
  return specs[category] || specs.auth;
}

function generateGoodImpl(category: string): string {
  const impls: Record<string, string> = {
    auth: `export async function login(email: string, password: string): Promise<Session> {
  if (!email || email.length === 0) {
    throw new Error('Email required');
  }
  
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }
  
  const isValid = await verifyPassword(user, password);
  if (!isValid) {
    throw new Error('Invalid password');
  }
  
  return await createSession(user.id);
}`,
    payments: `export async function charge(amount: number, token: string): Promise<Charge> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }
  if (!token || token.length === 0) {
    throw new Error('Token required');
  }
  
  const paymentMethod = await validateToken(token);
  const charge = await paymentProcessor.charge({ amount, paymentMethod });
  return charge;
}`,
    crud: `export async function createUser(email: string, name: string): Promise<User> {
  if (!email || email.length === 0) {
    throw new Error('Email required');
  }
  
  const existing = await db.users.findOne({ email });
  if (existing) {
    throw new Error('User exists');
  }
  
  return await db.users.create({ email, name });
}`,
    uploads: `export async function uploadFile(file: File, userId: string): Promise<Upload> {
  if (!file || file.size === 0) {
    throw new Error('File required');
  }
  
  const url = await storage.upload(file);
  return { url, userId };
}`,
    webhooks: `export async function sendWebhook(event: string, payload: Record<string, unknown>): Promise<Delivery> {
  if (!event || event.length === 0) {
    throw new Error('Event required');
  }
  
  const delivery = await webhookService.send({ event, payload });
  return delivery;
}`,
    search: `export async function search(query: string): Promise<Result[]> {
  if (!query || query.length === 0) {
    throw new Error('Query required');
  }
  
  return await searchIndex.search(query);
}`,
  };
  
  return impls[category] || impls.auth;
}

function generateBadImpl(category: string, violation: any): string {
  const baseImpl = generateGoodImpl(category);
  
  switch (violation.id) {
    case 'hardcoded-secret':
      return baseImpl.replace(
        'await verifyPassword(user, password)',
        "password === 'admin123' || await verifyPassword(user, password)"
      );
    
    case 'sql-injection':
      return baseImpl.replace(
        'await findUserByEmail(email)',
        `await db.query(\`SELECT * FROM users WHERE email = '\${email}'\`)`
      );
    
    case 'no-auth':
      return baseImpl.replace(/if \(!.*\) \{[\s\S]*?\}/g, '');
    
    case 'console-log':
      return `console.log('Debug:', arguments);\n${baseImpl}`;
    
    case 'missing-validation':
      return baseImpl.replace(/if \(!.*\) \{[\s\S]*?throw[\s\S]*?\}/g, '');
    
    case 'precondition-violation':
      return baseImpl.replace(/if \(.*length.*\) \{[\s\S]*?\}/g, '');
    
    case 'postcondition-violation':
      return baseImpl.replace(/return.*/, 'return null;');
    
    case 'any-type':
      return baseImpl.replace(/: (string|number|Promise)/g, ': any');
    
    case 'mock-data':
      return baseImpl.replace(/await.*\(/g, 'return mockData(');
    
    default:
      return baseImpl;
  }
}

async function writeFixture(category: string, fixture: any): Promise<void> {
  const dir = join(CORPUS_DIR, category, fixture.id);
  await mkdir(dir, { recursive: true });
  
  await writeFile(join(dir, 'spec.isl'), fixture.spec);
  await writeFile(join(dir, 'impl.ts'), fixture.impl);
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(fixture.metadata, null, 2));
}

// Run generator
generateFixtures().catch(console.error);
