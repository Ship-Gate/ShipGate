// ==========================================================================
// AuthService Server
// Auto-generated from ISL domain definition
// ==========================================================================

import * as grpc from '@grpc/grpc-js';
import * as pb from './auth_pb';

export interface IAuthService {
  registerUser(
    call: grpc.ServerUnaryCall<pb.RegisterUserRequest, pb.RegisterUserResponse>,
    callback: grpc.sendUnaryData<pb.RegisterUserResponse>
  ): void;
  login(
    call: grpc.ServerUnaryCall<pb.LoginRequest, pb.LoginResponse>,
    callback: grpc.sendUnaryData<pb.LoginResponse>
  ): void;
  logout(
    call: grpc.ServerUnaryCall<pb.LogoutRequest, pb.LogoutResponse>,
    callback: grpc.sendUnaryData<pb.LogoutResponse>
  ): void;
  createUser(
    call: grpc.ServerUnaryCall<pb.CreateUserRequest, pb.CreateUserResponse>,
    callback: grpc.sendUnaryData<pb.CreateUserResponse>
  ): void;
  getUser(
    call: grpc.ServerUnaryCall<pb.GetUserRequest, pb.GetUserResponse>,
    callback: grpc.sendUnaryData<pb.GetUserResponse>
  ): void;
  updateUser(
    call: grpc.ServerUnaryCall<pb.UpdateUserRequest, pb.UpdateUserResponse>,
    callback: grpc.sendUnaryData<pb.UpdateUserResponse>
  ): void;
  deleteUser(
    call: grpc.ServerUnaryCall<pb.DeleteUserRequest, pb.DeleteUserResponse>,
    callback: grpc.sendUnaryData<pb.DeleteUserResponse>
  ): void;
  listUsers(
    call: grpc.ServerUnaryCall<pb.ListUsersRequest, pb.ListUsersResponse>,
    callback: grpc.sendUnaryData<pb.ListUsersResponse>
  ): void;
  createSession(
    call: grpc.ServerUnaryCall<pb.CreateSessionRequest, pb.CreateSessionResponse>,
    callback: grpc.sendUnaryData<pb.CreateSessionResponse>
  ): void;
  getSession(
    call: grpc.ServerUnaryCall<pb.GetSessionRequest, pb.GetSessionResponse>,
    callback: grpc.sendUnaryData<pb.GetSessionResponse>
  ): void;
  updateSession(
    call: grpc.ServerUnaryCall<pb.UpdateSessionRequest, pb.UpdateSessionResponse>,
    callback: grpc.sendUnaryData<pb.UpdateSessionResponse>
  ): void;
  deleteSession(
    call: grpc.ServerUnaryCall<pb.DeleteSessionRequest, pb.DeleteSessionResponse>,
    callback: grpc.sendUnaryData<pb.DeleteSessionResponse>
  ): void;
  listSessions(
    call: grpc.ServerUnaryCall<pb.ListSessionsRequest, pb.ListSessionsResponse>,
    callback: grpc.sendUnaryData<pb.ListSessionsResponse>
  ): void;
}

export function createAuthServiceServer(
  implementation: IAuthService
): grpc.Server {
  const server = new grpc.Server();

  const serviceDefinition: grpc.ServiceDefinition<grpc.UntypedServiceImplementation> = {
    registerUser: {
      path: '/AuthService/RegisterUser',
      requestStream: false,
      responseStream: false,
      requestSerialize: (req: pb.RegisterUserRequest) => Buffer.from(req.serializeBinary()),
      requestDeserialize: (buf: Buffer) => pb.RegisterUserRequest.deserializeBinary(new Uint8Array(buf)),
      responseSerialize: (res: pb.RegisterUserResponse) => Buffer.from(res.serializeBinary()),
      responseDeserialize: (buf: Buffer) => pb.RegisterUserResponse.deserializeBinary(new Uint8Array(buf)),
    },
    login: {
      path: '/AuthService/Login',
      requestStream: false,
      responseStream: false,
      requestSerialize: (req: pb.LoginRequest) => Buffer.from(req.serializeBinary()),
      requestDeserialize: (buf: Buffer) => pb.LoginRequest.deserializeBinary(new Uint8Array(buf)),
      responseSerialize: (res: pb.LoginResponse) => Buffer.from(res.serializeBinary()),
      responseDeserialize: (buf: Buffer) => pb.LoginResponse.deserializeBinary(new Uint8Array(buf)),
    },
    logout: {
      path: '/AuthService/Logout',
      requestStream: false,
      responseStream: false,
      requestSerialize: (req: pb.LogoutRequest) => Buffer.from(req.serializeBinary()),
      requestDeserialize: (buf: Buffer) => pb.LogoutRequest.deserializeBinary(new Uint8Array(buf)),
      responseSerialize: (res: pb.LogoutResponse) => Buffer.from(res.serializeBinary()),
      responseDeserialize: (buf: Buffer) => pb.LogoutResponse.deserializeBinary(new Uint8Array(buf)),
    },
  };

  server.addService(serviceDefinition, implementation as grpc.UntypedServiceImplementation);

  return server;
}