/**
 * AI-GENERATED: User Registration
 *
 * Prompt: "Create a function to register new users"
 *
 * THE LIE: "Input is validated"
 * THE BUG: No validation - empty strings, SQL injection, XSS all possible
 */

const users = new Map<string, { id: string; email: string; name: string }>();

export function registerUser(email: string, name: string): { id: string } {
  // BUG: No validation! Accepts:
  // - Empty email: ""
  // - Invalid email: "not-an-email"
  // - SQL injection: "'; DROP TABLE users; --"
  // - XSS: "<script>alert('xss')</script>"
  const id = `user_${Date.now()}`;
  users.set(email, { id, email, name });
  return { id };
}
