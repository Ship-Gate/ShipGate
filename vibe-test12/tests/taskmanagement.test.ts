import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/v1/tasks/route';
import { POST as RegisterPOST } from '@/app/api/v1/users/register/route';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function authHeader(userId: string): Record<string, string> {
  const token = jwt.sign({ userId }, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe('taskmanagement API', () => {
  beforeAll(async () => {
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CreateTask', () => {
    it('should create a task with valid input', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'securepassword',
        },
      });

      const request = new Request('http://localhost/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(user.id) },
        body: JSON.stringify({
          title: 'New Task',
          priority: 3,
          assigneeId: user.id,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody.title).toBe('New Task');
      expect(responseBody.priority).toBe(3);
    });

    it('should return 400 for invalid priority', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test2@example.com',
          username: 'testuser2',
          password: 'securepassword',
        },
      });

      const request = new Request('http://localhost/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(user.id) },
        body: JSON.stringify({
          title: 'Invalid Priority Task',
          priority: 6,
          assigneeId: user.id,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('RegisterUser', () => {
    it('should register a user with valid input', async () => {
      const request = new Request('http://localhost/api/v1/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'newpassword',
        }),
      });

      const response = await RegisterPOST(request);
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody.email).toBe('newuser@example.com');
    });

    it('should return 400 for duplicate email', async () => {
      await prisma.user.create({
        data: {
          email: 'duplicate@example.com',
          username: 'duplicateuser',
          password: 'password',
        },
      });

      const request = new Request('http://localhost/api/v1/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'duplicate@example.com',
          username: 'anotheruser',
          password: 'anotherpassword',
        }),
      });

      const response = await RegisterPOST(request);
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody.code).toBe('DUPLICATE_EMAIL');
    });
  });
});