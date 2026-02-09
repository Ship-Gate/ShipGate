import React, { useState, FormEvent } from 'react';
import { validateSession } from './validation';

export interface SessionFormProps {
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function SessionForm({ initialValues = {}, onSubmit, loading, submitLabel }: SessionFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateSession(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="expires_at">Expires At</label>
        <input
          id="expires_at"
          type="datetime-local"
          value={String(values['expires_at'] ?? '')}
          onChange={(e) => handleChange('expires_at', e.target.value)}
        />
        {errors['expires_at'] && <span className="field-error">{errors['expires_at']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="revoked">Revoked</label>
        <input
          id="revoked"
          type="checkbox"
          checked={Boolean(values['revoked'])}
          onChange={(e) => handleChange('revoked', e.target.checked)}
        />
        {errors['revoked'] && <span className="field-error">{errors['revoked']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="ip_address">Ip Address</label>
        <input
          id="ip_address"
          type="text"
          value={String(values['ip_address'] ?? '')}
          onChange={(e) => handleChange('ip_address', e.target.value)}
        />
        {errors['ip_address'] && <span className="field-error">{errors['ip_address']}</span>}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting…' : (submitLabel ?? 'Submit')}
      </button>
    </form>
  );
}