import React from 'react';
import type { Session } from './types';

export interface SessionListProps {
  items: Session[];
  onSelect?: (item: Session) => void;
  onDelete?: (item: Session) => void;
}

export function SessionList({ items, onSelect, onDelete }: SessionListProps) {
  if (items.length === 0) {
    return <p>No sessions found.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Id</th>
          <th>User Id</th>
          <th>Expires At</th>
          <th>Revoked</th>
          <th>Ip Address</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx}>
            <td>{String(item.id ?? '')}</td>
            <td>{String(item.user_id ?? '')}</td>
            <td>{String(item.expires_at ?? '')}</td>
            <td>{item.revoked ? 'Yes' : 'No'}</td>
            <td>{String(item.ip_address ?? '')}</td>
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