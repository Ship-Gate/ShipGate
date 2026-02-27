/**
 * User Service
 * 
 * Sample service class for testing the audit engine.
 */

import { prisma } from '../lib/db';
import { hashPassword } from '../lib/crypto';

export class UserService {
  async createUser(data: { name: string; email: string; password: string }) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error('User already exists');
    }

    const passwordHash = await hashPassword(data.password);

    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
      },
    });
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async updateUserProfile(id: string, data: { name?: string; bio?: string }) {
    // No error handling - will be flagged
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: string) {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  }
}
