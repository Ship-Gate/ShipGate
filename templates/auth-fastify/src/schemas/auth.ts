/**
 * Golden Auth Template (Fastify) — JSON Schema for auth inputs
 * Schema-based validation maps naturally to ISL constraints
 */

export const registerBodySchema = {
  type: 'object',
  required: ['email', 'password', 'name'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).+$',
    },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    role: { type: 'string', enum: ['USER', 'ADMIN'], default: 'USER' },
  },
} as const;

export const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
} as const;

export const refreshBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
} as const;

export const logoutBodySchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string', minLength: 1 },
  },
} as const;
