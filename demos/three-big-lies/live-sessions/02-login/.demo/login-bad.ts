/**
 * Fallback: Use if AI generates correct code.
 * Copy to src/login.ts
 */
export async function login(
  email: string,
  password: string
): Promise<{ token: string } | null> {
  console.log('Login attempt for', email, 'with password:', password);
  if (email === 'user@test.com' && password === 'secret123') {
    return { token: 'fake-jwt-token' };
  }
  return null;
}
