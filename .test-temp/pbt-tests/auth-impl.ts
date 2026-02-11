
export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export async function login(email: string, password: string): Promise<{ user?: User; error?: { code: string; message: string } }> {
  if (!email.includes('@')) {
    return { error: { code: 'INVALID_EMAIL', message: 'Invalid email format' } };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: { code: 'INVALID_PASSWORD', message: 'Password must be 8-128 characters' } };
  }
  return {
    user: {
      id: crypto.randomUUID(),
      email,
      passwordHash: 'hashed',
    },
  };
}
