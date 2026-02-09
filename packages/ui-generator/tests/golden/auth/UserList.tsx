import React from 'react';
import type { User } from './types';

export interface UserListProps {
  items: User[];
  onSelect?: (item: User) => void;
  onDelete?: (item: User) => void;
}

export function UserList({ items, onSelect, onDelete }: UserListProps) {
  if (items.length === 0) {
    return <p>No users found.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Email</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx}>
            <td>{String(item.id ?? '')}</td>
            <td>{String(item.email ?? '')}</td>
            <td>{String(item.status ?? '')}</td>
            <td>
              {onSelect && <button onClick={() => onSelect(item)}>View</button>}
              {onDelete && <button onClick={() => onDelete(item)}>Delete</button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}