export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export function GetUser(input: { id: string }): User {
  if (!input.id) {
    throw new Error('USER_NOT_FOUND');
  }
  return {
    id: input.id,
    email: 'alice@example.com',
    name: 'Alice',
    created_at: new Date().toISOString(),
  };
}
