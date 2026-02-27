import React, { useState, FormEvent } from 'react';
import { validateTransferFunds } from './validation';

export interface TransferFundsFormProps {
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function TransferFundsForm({ initialValues = {}, onSubmit, loading, submitLabel }: TransferFundsFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateTransferFunds(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="senderId">Sender Id</label>
        <input
          id="senderId"
          type="text"
          value={String(values['senderId'] ?? '')}
          onChange={(e) => handleChange('senderId', e.target.value)}
        />
        {errors['senderId'] && <span className="field-error">{errors['senderId']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="receiverId">Receiver Id</label>
        <input
          id="receiverId"
          type="text"
          value={String(values['receiverId'] ?? '')}
          onChange={(e) => handleChange('receiverId', e.target.value)}
        />
        {errors['receiverId'] && <span className="field-error">{errors['receiverId']}</span>}
      </div>
      <div className="form-field">
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          value={String(values['amount'] ?? '')}
          onChange={(e) => handleChange('amount', e.target.valueAsNumber)}
        />
        {errors['amount'] && <span className="field-error">{errors['amount']}</span>}
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting…' : (submitLabel ?? 'Submit')}
      </button>
    </form>
  );
}