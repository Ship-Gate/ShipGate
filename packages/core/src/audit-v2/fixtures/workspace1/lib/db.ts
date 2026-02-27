/**
 * Database utilities
 * 
 * Sample database module for testing the audit engine.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email } });
  }

  async createUser(data: { name: string; email: string; passwordHash: string }) {
    return prisma.user.create({ data });
  }

  async updateUser(id: string, data: Partial<{ name: string; email: string }>) {
    return prisma.user.update({ where: { id }, data });
  }

  async deleteUser(id: string) {
    return prisma.user.delete({ where: { id } });
  }

  // Multiple operations without transaction - should be flagged
  async transferCredits(fromId: string, toId: string, amount: number) {
    await prisma.user.update({
      where: { id: fromId },
      data: { credits: { decrement: amount } },
    });
    
    await prisma.user.update({
      where: { id: toId },
      data: { credits: { increment: amount } },
    });
  }
}

// Raw SQL example - potential injection risk
export async function searchUsers(query: string) {
  // This pattern could be flagged for SQL injection
  const results = await prisma.$queryRaw`SELECT * FROM users WHERE name LIKE ${query}`;
  return results;
}
