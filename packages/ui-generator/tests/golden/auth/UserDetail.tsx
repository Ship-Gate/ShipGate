import React from 'react';
import type { User } from './types';

export interface UserDetailProps {
  item: User;
  onEdit?: () => void;
  onBack?: () => void;
}

export function UserDetail({ item, onEdit, onBack }: UserDetailProps) {
  return (
    <div className="detail-view">
      <h2>User Detail</h2>
      <dl>
        <dt>Id</dt>
        <dd>{String(item.id ?? '')}</dd>
        <dt>Email</dt>
        <dd>{String(item.email ?? '')}</dd>
        <dt>Status</dt>
        <dd>{String(item.status ?? '')}</dd>
      </dl>
      <div className="detail-actions">
        {onBack && <button onClick={onBack}>Back</button>}
        {onEdit && <button onClick={onEdit}>Edit</button>}
      </div>
    </div>
  );
}