// Types generated from ISL specification

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  status: UserStatus;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked: boolean;
}

export type LoginFn = (email: string, password: string) => Promise<Session>;

export interface LoginHandler {
  login(email: string, password: string): Promise<Session>;
}

export type RegisterFn = (email: string, password: string) => Promise<User>;

export interface RegisterHandler {
  register(email: string, password: string): Promise<User>;
}
