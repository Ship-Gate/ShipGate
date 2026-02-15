// BAD: Return type changed — spec expects User with {id, email, name, created_at}
// but implementation returns just a number (outdated after refactor)

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export function GetUser(input: { id: string }): number {
  // Returns a number instead of User — violates typed signature
  return 42;
}
