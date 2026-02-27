/**
 * Seed Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@isl-lang/parser';
import { generateSeed } from './seed.js';
import { resolveStack } from '../types.js';

const SIMPLE_ISL = `
domain Simple {
  version: "1.0.0"
  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
  }
  entity Task {
    id: UUID [immutable, unique]
    title: String
    completed: Boolean
    user_id: UUID [references: User]
  }
}
`;

describe('SeedGenerator', () => {
  it('generates seed content for entities', () => {
    const result = parse(SIMPLE_ISL, 'test.isl');
    expect(result.success).toBe(true);
    expect(result.domain).toBeDefined();
    if (!result.domain) return;

    const stack = resolveStack({ database: 'postgres', orm: 'prisma' });
    const seedFile = generateSeed(result.domain, stack);

    expect(seedFile.path).toBe('prisma/seed.ts');
    expect(seedFile.content).toContain('import { PrismaClient } from "@prisma/client"');
    expect(seedFile.content).toContain('import { faker } from "@faker-js/faker"');
    expect(seedFile.content).toContain('prisma.User.create');
    expect(seedFile.content).toContain('prisma.Task.create');
    expect(seedFile.content).toContain('faker.seed(42)');
  });

  it('includes demo users when User has email and password', () => {
    const islWithAuth = `
domain Auth {
  version: "1.0.0"
  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    passwordHash: String
    name: String
    role: String
  }
}
`;
    const result = parse(islWithAuth, 'auth.isl');
    expect(result.success).toBe(true);
    if (!result.domain) return;

    const stack = resolveStack({ database: 'postgres' });
    const seedFile = generateSeed(result.domain, stack);

    expect(seedFile.content).toContain('admin@demo.com');
    expect(seedFile.content).toContain('author@demo.com');
    expect(seedFile.content).toContain('user@demo.com');
    expect(seedFile.content).toContain('bcrypt');
    expect(seedFile.content).toContain('demo1234');
  });

  it('respects entity dependency order for FKs', () => {
    const result = parse(SIMPLE_ISL, 'test.isl');
    if (!result.domain) return;

    const stack = resolveStack({});
    const seedFile = generateSeed(result.domain, stack);

    const userCreatePos = seedFile.content.indexOf('prisma.User.create');
    const taskCreatePos = seedFile.content.indexOf('prisma.Task.create');
    expect(userCreatePos).toBeLessThan(taskCreatePos);
  });

  it('uses picsum.photos for image fields', () => {
    const islWithImage = `
domain Media {
  version: "1.0.0"
  entity Product {
    id: UUID [immutable, unique]
    name: String
    imageUrl: String
  }
}
`;
    const result = parse(islWithImage, 'media.isl');
    if (!result.domain) return;

    const seedFile = generateSeed(result.domain, resolveStack({}));
    expect(seedFile.content).toContain('picsum.photos');
  });
});
