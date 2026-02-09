import React, { useState, FormEvent } from 'react';
import { validateRegister } from './validation';

export interface RegisterFormProps {
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function RegisterForm({ initialValues = {}, onSubmit, loading, submitLabel }: RegisterFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateRegister(values);
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
        <label htmlFor="confirm_password">Confirm Password</label>
        <input
          id="confirm_password"
          type="password"
          value={String(values['confirm_password'] ?? '')}
          onChange={(e) => handleChange('confirm_password', e.target.value)}
        />
        {errors['confirm_password'] && <span className="field-error">{errors['confirm_password']}</span>}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting…' : (submitLabel ?? 'Submit')}
      </button>
    </form>
  );
}