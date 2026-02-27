import React, { useState, FormEvent } from 'react';
import { validateAccount } from './validation';

export interface AccountFormProps {
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function AccountForm({ initialValues = {}, onSubmit, loading, submitLabel }: AccountFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateAccount(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="id">Id</label>
        <input
          id="id"
          type="text"
          value={String(values['id'] ?? '')}
          onChange={(e) => handleChange('id', e.target.value)}
        />
        {errors['id'] && <span className="field-error">{errors['id']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="balance">Balance</label>
        <input
          id="balance"
          type="number"
          value={String(values['balance'] ?? '')}
          onChange={(e) => handleChange('balance', e.target.valueAsNumber)}
        />
        {errors['balance'] && <span className="field-error">{errors['balance']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="isActive">Is Active</label>
        <input
          id="isActive"
          type="checkbox"
          checked={Boolean(values['isActive'])}
          onChange={(e) => handleChange('isActive', e.target.checked)}
        />
        {errors['isActive'] && <span className="field-error">{errors['isActive']}</span>}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting…' : (submitLabel ?? 'Submit')}
      </button>
    </form>
  );
}