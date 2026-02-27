import React from 'react';
import type { Account } from './types';

export interface AccountDetailProps {
  item: Account;
  onEdit?: () => void;
  onBack?: () => void;
}

export function AccountDetail({ item, onEdit, onBack }: AccountDetailProps) {
  return (
    <div className="detail-view">
      <h2>Account Detail</h2>
      <dl>
        <dt>Id</dt>
        <dd>{String(item.id ?? '')}</dd>
        <dt>Balance</dt>
        <dd>{String(item.balance ?? '')}</dd>
        <dt>Is Active</dt>
        <dd>{item.isActive ? 'Yes' : 'No'}</dd>
      </dl>
      <div className="detail-actions">
        {onBack && <button onClick={onBack}>Back</button>}
        {onEdit && <button onClick={onEdit}>Edit</button>}
      </div>
    </div>
  );
}