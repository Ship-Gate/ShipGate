import React from 'react';
import { UserList } from './UserList';
import { UserDetail } from './UserDetail';
import { UserForm } from './UserForm';
import { SessionList } from './SessionList';
import { SessionDetail } from './SessionDetail';
import { SessionForm } from './SessionForm';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function App() {
  return (
    <div>
      <h1>UserAuthentication</h1>
      <section>
        <h2>Users</h2>
        <UserList items={[]} />
      </section>
      <section>
        <h2>Sessions</h2>
        <SessionList items={[]} />
      </section>
    </div>
  );
}