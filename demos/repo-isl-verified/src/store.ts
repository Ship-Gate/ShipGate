import { randomUUID } from "node:crypto";

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export type PublicUser = Omit<User, "password_hash">;

const users = new Map<string, User>();
const emailIndex = new Map<string, string>();

export function toPublicUser(user: User): PublicUser {
  const { password_hash: _hash, ...publicUser } = user;
  return publicUser;
}

export const store = {
  create(data: Omit<User, "id" | "created_at">): User {
    const id = randomUUID();
    const user: User = {
      id,
      ...data,
      created_at: new Date().toISOString(),
    };
    users.set(id, user);
    emailIndex.set(data.email.toLowerCase(), id);
    return user;
  },

  findByEmail(email: string): User | undefined {
    const id = emailIndex.get(email.toLowerCase());
    return id ? users.get(id) : undefined;
  },

  findById(id: string): User | undefined {
    return users.get(id);
  },

  emailExists(email: string): boolean {
    return emailIndex.has(email.toLowerCase());
  },
};
