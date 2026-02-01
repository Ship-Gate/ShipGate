/**
 * User Service - User operations with verification.
 */

import type { ISLClientConfig } from '../config';
import type {
  User,
  CreateUserInput,
  UpdateUserInput,
  ListUsersInput,
  SearchUsersInput,
} from '../models';
import { parseUser } from '../models';
import type {
  CreateUserResult,
  GetUserResult,
  UpdateUserResult,
  DeleteUserResult,
  ListUsersResult,
  SearchUsersResult,
} from '../results';
import { ok, err, CreateUserErrors, GetUserErrors } from '../results';
import { RuntimeChecker } from '../verification';

/**
 * User service for user-related operations
 */
export class UserService {
  private readonly config: Required<ISLClientConfig>;
  private readonly checker: RuntimeChecker;
  private readonly fetchFn: typeof fetch;

  constructor(config: Required<ISLClientConfig>) {
    this.config = config;
    this.checker = new RuntimeChecker(config.verification);
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    // Verify preconditions
    if (this.config.verification?.enablePreconditions) {
      this.checker.verifyCreateUserPreconditions(input);
    }

    try {
      const response = await this.request('POST', '/api/users', input);

      if (response.ok) {
        const user = parseUser(await response.json());

        // Verify postconditions
        if (this.config.verification?.enablePostconditions) {
          this.checker.verifyCreateUserPostconditions(input, user);
        }

        return ok(user);
      }

      return this.handleCreateUserError(response);
    } catch (error) {
      return err(CreateUserErrors.networkError(error as Error));
    }
  }

  /**
   * Get a user by ID
   */
  async getUser(userId: string): Promise<GetUserResult> {
    // Verify preconditions
    if (this.config.verification?.enablePreconditions) {
      this.checker.verifyGetUserPreconditions(userId);
    }

    try {
      const response = await this.request('GET', `/api/users/${userId}`);

      if (response.ok) {
        const user = parseUser(await response.json());

        // Verify postconditions
        if (this.config.verification?.enablePostconditions) {
          this.checker.verifyGetUserPostconditions(userId, user);
        }

        return ok(user);
      }

      if (response.status === 404) {
        return err(GetUserErrors.notFound());
      }

      if (response.status === 401) {
        return err(GetUserErrors.unauthorized());
      }

      return err(GetUserErrors.serverError(`Server error: ${response.status}`));
    } catch (error) {
      return err(GetUserErrors.networkError(error as Error));
    }
  }

  /**
   * Update a user
   */
  async updateUser(userId: string, input: UpdateUserInput): Promise<UpdateUserResult> {
    // Verify preconditions
    if (this.config.verification?.enablePreconditions) {
      this.checker.verifyUpdateUserPreconditions(userId, input);
    }

    try {
      const response = await this.request('PATCH', `/api/users/${userId}`, input);

      if (response.ok) {
        const user = parseUser(await response.json());

        // Verify postconditions
        if (this.config.verification?.enablePostconditions) {
          this.checker.verifyUpdateUserPostconditions(userId, input, user);
        }

        return ok(user);
      }

      return this.handleUpdateUserError(response);
    } catch (error) {
      return err({ code: 'NETWORK_ERROR', cause: error as Error });
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<DeleteUserResult> {
    // Verify preconditions
    if (this.config.verification?.enablePreconditions) {
      this.checker.verifyDeleteUserPreconditions(userId);
    }

    try {
      const response = await this.request('DELETE', `/api/users/${userId}`);

      if (response.ok || response.status === 204) {
        return ok(undefined);
      }

      if (response.status === 404) {
        return err({ code: 'NOT_FOUND' });
      }

      if (response.status === 401) {
        return err({ code: 'UNAUTHORIZED' });
      }

      if (response.status === 403) {
        return err({ code: 'FORBIDDEN' });
      }

      return err({ code: 'SERVER_ERROR', message: `Server error: ${response.status}` });
    } catch (error) {
      return err({ code: 'NETWORK_ERROR', cause: error as Error });
    }
  }

  /**
   * List users with pagination
   */
  async listUsers(input: ListUsersInput = {}): Promise<ListUsersResult> {
    // Verify preconditions
    if (this.config.verification?.enablePreconditions) {
      this.checker.verifyListUsersPreconditions(input);
    }

    try {
      const params = new URLSearchParams();
      if (input.status) params.set('status', input.status);
      if (input.role) params.set('role', input.role);
      if (input.pageSize) params.set('page_size', String(input.pageSize));
      if (input.pageToken) params.set('page_token', input.pageToken);
      if (input.sortBy) params.set('sort_by', input.sortBy);
      if (input.sortOrder) params.set('sort_order', input.sortOrder);

      const url = `/api/users${params.toString() ? `?${params}` : ''}`;
      const response = await this.request('GET', url);

      if (response.ok) {
        const data = await response.json();
        const users = (data.items || []).map(parseUser);
        return ok({
          users,
          nextPageToken: data.next_page_token,
          totalCount: data.total_count,
        });
      }

      if (response.status === 401) {
        return err({ code: 'UNAUTHORIZED' });
      }

      return err({ code: 'SERVER_ERROR', message: `Server error: ${response.status}` });
    } catch (error) {
      return err({ code: 'NETWORK_ERROR', cause: error as Error });
    }
  }

  /**
   * Search users by query
   */
  async searchUsers(input: SearchUsersInput): Promise<SearchUsersResult> {
    // Verify preconditions
    if (this.config.verification?.enablePreconditions) {
      this.checker.verifySearchUsersPreconditions(input);
    }

    try {
      const params = new URLSearchParams();
      params.set('q', input.query);
      if (input.fields) params.set('fields', input.fields.join(','));
      if (input.pageSize) params.set('page_size', String(input.pageSize));
      if (input.pageToken) params.set('page_token', input.pageToken);

      const url = `/api/users/search?${params}`;
      const response = await this.request('GET', url);

      if (response.ok) {
        const data = await response.json();
        const users = (data.items || []).map(parseUser);
        return ok({
          users,
          nextPageToken: data.next_page_token,
          totalCount: data.total_count,
        });
      }

      if (response.status === 401) {
        return err({ code: 'UNAUTHORIZED' });
      }

      return err({ code: 'SERVER_ERROR', message: `Server error: ${response.status}` });
    } catch (error) {
      return err({ code: 'NETWORK_ERROR', cause: error as Error });
    }
  }

  /**
   * Observe user updates via WebSocket
   */
  async *observe(userId: string): AsyncIterableIterator<User> {
    const wsUrl = this.config.baseUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/users/${userId}`);

    try {
      while (true) {
        const event = await new Promise<MessageEvent>((resolve, reject) => {
          ws.onmessage = resolve;
          ws.onerror = reject;
          ws.onclose = () => reject(new Error('WebSocket closed'));
        });

        yield parseUser(JSON.parse(event.data));
      }
    } finally {
      ws.close();
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client-SDK': 'isl-typescript/0.1.0',
      ...this.config.headers,
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    let request = new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Apply request interceptor
    if (this.config.interceptors?.request) {
      request = await this.config.interceptors.request(request);
    }

    let response = await this.fetchFn(request);

    // Apply response interceptor
    if (this.config.interceptors?.response) {
      response = await this.config.interceptors.response(response);
    }

    return response;
  }

  private async handleCreateUserError(response: Response): Promise<CreateUserResult> {
    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      const message = (body.message || '').toLowerCase();
      if (message.includes('email')) {
        return err(CreateUserErrors.duplicateEmail());
      }
      if (message.includes('username')) {
        return err(CreateUserErrors.duplicateUsername());
      }
      return err(CreateUserErrors.invalidInput(body.message || 'Conflict'));
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      return err(CreateUserErrors.invalidInput(body.message || 'Invalid input', body.field));
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return err(CreateUserErrors.rateLimited(retryAfter));
    }

    return err(CreateUserErrors.serverError(`Server error: ${response.status}`));
  }

  private async handleUpdateUserError(response: Response): Promise<UpdateUserResult> {
    if (response.status === 404) {
      return err({ code: 'NOT_FOUND' });
    }

    if (response.status === 401) {
      return err({ code: 'UNAUTHORIZED' });
    }

    if (response.status === 403) {
      return err({ code: 'FORBIDDEN' });
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      return err({ code: 'INVALID_INPUT', message: body.message || 'Invalid input', field: body.field });
    }

    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      return err({ code: 'CONFLICT', message: body.message || 'Conflict' });
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      return err({ code: 'RATE_LIMITED', retryAfter });
    }

    return err({ code: 'SERVER_ERROR', message: `Server error: ${response.status}` });
  }
}
