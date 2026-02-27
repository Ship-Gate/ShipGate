/**
 * Registration - NO VALIDATION (the bug)
 * AI said "input is validated" - it isn't.
 */
const users = new Map<string, { id: string; email: string; name: string }>();

export function registerUser(email: string, name: string): { id: string } {
  const id = `user_${Date.now()}`;
  users.set(email, { id, email, name });
  return { id };
}

export function getUser(email: string) {
  return users.get(email);
}
