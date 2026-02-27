import React from 'react';
import type { Account } from './types';

export interface AccountListProps {
  items: Account[];
  onSelect?: (item: Account) => void;
  onDelete?: (item: Account) => void;
}

export function AccountList({ items, onSelect, onDelete }: AccountListProps) {
  if (items.length === 0) {
    return <p>No accounts found.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Balance</th>
          <th>Is Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={idx}>
            <td>{String(item.id ?? '')}</td>
            <td>{String(item.balance ?? '')}</td>
            <td>{item.isActive ? 'Yes' : 'No'}</td>
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