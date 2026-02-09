// ==========================================================================
// AuthService Client
// Auto-generated from ISL domain definition
// ==========================================================================

import * as grpc from '@grpc/grpc-js';
import type { AuthServiceClient as IAuthServiceClient } from './auth_grpc_pb';
import * as pb from './auth_pb';

export interface AuthServiceClientConfig {
  address: string;
  credentials?: grpc.ChannelCredentials;
  options?: grpc.ClientOptions;
}

export class AuthServiceClient {
  private client: grpc.Client;

  constructor(config: AuthServiceClientConfig) {
    const credentials = config.credentials ?? grpc.credentials.createInsecure();
    this.client = new grpc.Client(config.address, credentials, config.options);
  }

  /**
   * Register a new user account
   */
  async registerUser(
    request: pb.RegisterUserRequest
  ): Promise<pb.RegisterUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/RegisterUserService/RegisterUser',
        (req: pb.RegisterUserRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.RegisterUserResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  /**
   * Authenticate user and create session
   */
  async login(
    request: pb.LoginRequest
  ): Promise<pb.LoginResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/LoginService/Login',
        (req: pb.LoginRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.LoginResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  /**
   * Revoke the current session
   */
  async logout(
    request: pb.LogoutRequest
  ): Promise<pb.LogoutResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/LogoutService/Logout',
        (req: pb.LogoutRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.LogoutResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }


  async createUser(
    request: pb.CreateUserRequest
  ): Promise<pb.CreateUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/UserService/CreateUser',
        (req: pb.CreateUserRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.CreateUserResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async getUser(
    request: pb.GetUserRequest
  ): Promise<pb.GetUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/UserService/GetUser',
        (req: pb.GetUserRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.GetUserResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async updateUser(
    request: pb.UpdateUserRequest
  ): Promise<pb.UpdateUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/UserService/UpdateUser',
        (req: pb.UpdateUserRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.UpdateUserResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async deleteUser(
    request: pb.DeleteUserRequest
  ): Promise<pb.DeleteUserResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/UserService/DeleteUser',
        (req: pb.DeleteUserRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.DeleteUserResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async listUsers(
    request: pb.ListUsersRequest
  ): Promise<pb.ListUsersResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/UserService/ListUsers',
        (req: pb.ListUsersRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.ListUsersResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }


  async createSession(
    request: pb.CreateSessionRequest
  ): Promise<pb.CreateSessionResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/SessionService/CreateSession',
        (req: pb.CreateSessionRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.CreateSessionResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async getSession(
    request: pb.GetSessionRequest
  ): Promise<pb.GetSessionResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/SessionService/GetSession',
        (req: pb.GetSessionRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.GetSessionResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async updateSession(
    request: pb.UpdateSessionRequest
  ): Promise<pb.UpdateSessionResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/SessionService/UpdateSession',
        (req: pb.UpdateSessionRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.UpdateSessionResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async deleteSession(
    request: pb.DeleteSessionRequest
  ): Promise<pb.DeleteSessionResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/SessionService/DeleteSession',
        (req: pb.DeleteSessionRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.DeleteSessionResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async listSessions(
    request: pb.ListSessionsRequest
  ): Promise<pb.ListSessionsResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/SessionService/ListSessions',
        (req: pb.ListSessionsRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.ListSessionsResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  close(): void {
    this.client.close();
  }
}