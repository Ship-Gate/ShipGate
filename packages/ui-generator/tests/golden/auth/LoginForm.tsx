import React, { useState, FormEvent } from 'react';
import { validateLogin } from './validation';

export interface LoginFormProps {
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function LoginForm({ initialValues = {}, onSubmit, loading, submitLabel }: LoginFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateLogin(values);
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
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={String(values['password'] ?? '')}
          onChange={(e) => handleChange('password', e.target.value)}
        />
        {errors['password'] && <span className="field-error">{errors['password']}</span>}
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