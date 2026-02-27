// BAD: Violates multiple postconditions and missing error cases
// - Returns empty id (violates result.id.length > 0)
// - Returns wrong email (violates result.email == input.email)
// - Missing INVALID_EMAIL error case
// - Missing NOT_FOUND error case

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export function CreateUser(input: { email: string; name: string }): User {
  // No validation — missing INVALID_EMAIL and EMPTY_NAME errors
  return {
    id: '',
    email: 'hardcoded@example.com',
    name: input.name,
    created_at: '',
  };
}

export function GetUser(_input: { id: string }): User {
  // Always returns fake data — never throws NOT_FOUND
  return {
    id: 'fake',
    email: 'fake@example.com',
    name: 'Fake User',
    created_at: '',
  };
}
