/**
 * Generated Schemas - Zod schemas from ISL definitions
 * 
 * This file would be auto-generated from ISL schemas by the codegen tool.
 */
import { z } from 'zod';
import { createValidator } from '../validation/validators';

// Base schemas
export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email().max(254);
export const URLSchema = z.string().url();
export const ISODateTimeSchema = z.string().datetime();
export const CurrencySchema = z.number().multipleOf(0.01);

// User schemas
export const UserStatusSchema = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED']);
export const UserRoleSchema = z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']);

export const UserSchema = z.object({
  id: UUIDSchema,
  email: EmailSchema,
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().max(100).nullable(),
  avatarUrl: URLSchema.nullable(),
  status: UserStatusSchema,
  role: UserRoleSchema,
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  lastLoginAt: ISODateTimeSchema.nullable(),
});

// Input schemas
export const CreateUserInputSchema = z.object({
  email: EmailSchema,
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  }),
  password: z.string().min(8).max(128).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    { message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number' }
  ),
  displayName: z.string().max(100).optional(),
});

export const UpdateUserInputSchema = z.object({
  displayName: z.string().max(100).optional(),
  avatarUrl: URLSchema.nullable().optional(),
});

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().optional(),
});

export const RegisterInputSchema = z.object({
  email: EmailSchema,
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Pagination schemas
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CursorPaginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Filter schemas
export const UserFiltersSchema = z.object({
  status: UserStatusSchema.optional(),
  role: UserRoleSchema.optional(),
  search: z.string().max(100).optional(),
  createdAfter: ISODateTimeSchema.optional(),
  createdBefore: ISODateTimeSchema.optional(),
});

// Settings schemas
export const UserSettingsSchema = z.object({
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
  }),
  privacy: z.object({
    profileVisibility: z.enum(['PUBLIC', 'PRIVATE', 'FRIENDS']),
    showOnlineStatus: z.boolean(),
  }),
  preferences: z.object({
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    language: z.string().min(2).max(10),
    timezone: z.string(),
  }),
});

// Create validators from schemas
export const validateCreateUserInput = createValidator(CreateUserInputSchema);
export const validateUpdateUserInput = createValidator(UpdateUserInputSchema);
export const validateLoginInput = createValidator(LoginInputSchema);
export const validateRegisterInput = createValidator(RegisterInputSchema);
export const validateResetPasswordInput = createValidator(ResetPasswordInputSchema);
export const validateChangePasswordInput = createValidator(ChangePasswordInputSchema);
export const validatePaginationParams = createValidator(PaginationParamsSchema);
export const validateUserFilters = createValidator(UserFiltersSchema);
export const validateUserSettings = createValidator(UserSettingsSchema);

// Type exports are in ./types.ts to avoid duplicate declarations
