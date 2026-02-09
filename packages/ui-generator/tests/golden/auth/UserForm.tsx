import React, { useState, FormEvent } from 'react';
import { validateUser } from './validation';

export interface UserFormProps {
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function UserForm({ initialValues = {}, onSubmit, loading, submitLabel }: UserFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateUser(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={String(values['email'] ?? '')}
          onChange={(e) => handleChange('email', e.target.value)}
        />
        {errors['email'] && <span className="field-error">{errors['email']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          value={String(values['status'] ?? '')}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="">Select…</option>
        </select>
        {errors['status'] && <span className="field-error">{errors['status']}</span>}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting…' : (submitLabel ?? 'Submit')}
      </button>
    </form>
  );
}