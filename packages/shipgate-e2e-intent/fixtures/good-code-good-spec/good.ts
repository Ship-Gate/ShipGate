// GOOD: Fully compliant implementation — all postconditions met, all errors handled

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

const users = new Map<string, User>();

export function CreateUser(input: { email: string; name: string }): User {
  if (!input.email || !input.email.includes('@')) {
    throw new Error('INVALID_EMAIL');
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('EMPTY_NAME');
  }

  const user: User = {
    id: crypto.randomUUID(),
    email: input.email,
    name: input.name,
    created_at: new Date().toISOString(),
  };

  users.set(user.id, user);
  return user;
}

export function GetUser(input: { id: string }): User {
  const user = users.get(input.id);
  if (!user) {
    throw new Error('NOT_FOUND');
  }
  return user;
}
