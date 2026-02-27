import React from 'react';
import type { Session } from './types';

export interface SessionDetailProps {
  item: Session;
  onEdit?: () => void;
  onBack?: () => void;
}

export function SessionDetail({ item, onEdit, onBack }: SessionDetailProps) {
  return (
    <div className="detail-view">
      <h2>Session Detail</h2>
      <dl>
        <dt>Id</dt>
        <dd>{String(item.id ?? '')}</dd>
        <dt>User Id</dt>
        <dd>{String(item.user_id ?? '')}</dd>
        <dt>Expires At</dt>
        <dd>{String(item.expires_at ?? '')}</dd>
        <dt>Revoked</dt>
        <dd>{item.revoked ? 'Yes' : 'No'}</dd>
        <dt>Ip Address</dt>
        <dd>{String(item.ip_address ?? '')}</dd>
      </dl>
      <div className="detail-actions">
        {onBack && <button onClick={onBack}>Back</button>}
        {onEdit && <button onClick={onEdit}>Edit</button>}
      </div>
    </div>
  );
}