/**
 * ISL TypeScript SDK
 *
 * Universal TypeScript SDK for ISL-verified APIs.
 *
 * @example
 * ```typescript
 * import { ISLClient } from '@isl/sdk';
 *
 * const client = new ISLClient({
 *   baseUrl: 'https://api.example.com',
 *   authToken: 'your-token',
 * });
 *
 * const result = await client.users.createUser({
 *   email: 'user@example.com',
 *   username: 'newuser',
 * });
 * ```
 */

// Client
export { ISLClient } from './client';
export type { ISLClientConfig, RetryConfig, VerificationConfig } from './config';

// Models
export {
  type User,
  UserStatus,
  UserRole,
  SortOrder,
  ChangeType,
} from './models';
export type {
  Email,
  Username,
  UserId,
  PageToken,
  CreateUserInput,
  UpdateUserInput,
  ListUsersInput,
  SearchUsersInput,
  UserProfile,
  PaginatedList,
  UserUpdateEvent,
} from './models';

// Results
export type {
  Result,
  CreateUserResult,
  GetUserResult,
  UpdateUserResult,
  DeleteUserResult,
  ListUsersResult,
  SearchUsersResult,
  CreateUserError,
  GetUserError,
  UpdateUserError,
  DeleteUserError,
  ListUsersError,
  SearchUsersError,
} from './results';

// Errors
export {
  ISLError,
  PreconditionError,
  PostconditionError,
  ValidationError,
  NetworkError,
  ServerError,
} from './errors';

// Validation
export { validators, validate } from './validation';

// Verification
export { RuntimeChecker } from './verification';
export type { Violation, ViolationType } from './verification';
