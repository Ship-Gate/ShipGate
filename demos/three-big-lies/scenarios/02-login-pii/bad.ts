/**
 * AI-GENERATED: Login API
 *
 * Prompt: "Build a login endpoint that authenticates users with email and password"
 *
 * THE LIE: "This handles login securely"
 * THE BUG: Logs the password to console - PII breach, credential leak
 */

export async function login(email: string, password: string): Promise<{ token: string } | null> {
  // BUG: Logging password - CRITICAL security violation!
  console.log('Login attempt for', email, 'with password:', password);

  // Fake auth check
  if (email === 'user@test.com' && password === 'secret123') {
    return { token: 'jwt_token_here' };
  }

  return null;
}
