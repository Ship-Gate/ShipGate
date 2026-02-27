// ============================================================================
// Form Component Emitter
// Generates React create/edit form components from entity or behavior inputs
// ============================================================================

import type { FieldUIModel, BehaviorUIModel, EntityUIModel } from '../types.js';

export function emitEntityForm(entity: EntityUIModel): string {
  const editableFields = entity.fields.filter((f) => !f.immutable && !f.hidden);
  const name = entity.name;
  return emitFormComponent(`${name}Form`, editableFields, name);
}

export function emitBehaviorForm(behavior: BehaviorUIModel): string {
  const fields = behavior.inputFields.filter((f) => !f.hidden);
  return emitFormComponent(`${behavior.name}Form`, fields, behavior.name);
}

function emitFormComponent(
  componentName: string,
  fields: FieldUIModel[],
  baseName: string,
): string {
  const lines: string[] = [];

  lines.push(`import React, { useState, FormEvent } from 'react';`);
  lines.push(`import { validate${baseName} } from './validation';`);
  lines.push('');
  lines.push(`export interface ${componentName}Props {`);
  lines.push(`  initialValues?: Record<string, unknown>;`);
  lines.push(`  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;`);
  lines.push(`  loading?: boolean;`);
  lines.push(`  submitLabel?: string;`);
  lines.push('}');
  lines.push('');
  lines.push(`export function ${componentName}({ initialValues = {}, onSubmit, loading, submitLabel }: ${componentName}Props) {`);
  lines.push(`  const [values, setValues] = useState<Record<string, unknown>>(initialValues);`);
  lines.push(`  const [errors, setErrors] = useState<Record<string, string>>({});`);
  lines.push('');
  lines.push('  function handleChange(field: string, value: unknown) {');
  lines.push('    setValues((prev) => ({ ...prev, [field]: value }));');
  lines.push('  }');
  lines.push('');
  lines.push('  function handleSubmit(e: FormEvent) {');
  lines.push('    e.preventDefault();');
  lines.push(`    const errs = validate${baseName}(values);`);
  lines.push('    setErrors(errs);');
  lines.push('    if (Object.keys(errs).length === 0) {');
  lines.push('      onSubmit(values);');
  lines.push('    }');
  lines.push('  }');
  lines.push('');
  lines.push('  return (');
  lines.push('    <form onSubmit={handleSubmit} noValidate>');

  for (const field of fields) {
    lines.push(emitFieldJSX(field));
  }

  lines.push(`      <button type="submit" disabled={loading}>`);
  lines.push(`        {loading ? 'Submitting…' : (submitLabel ?? 'Submit')}`);
  lines.push('      </button>');
  lines.push('    </form>');
  lines.push('  );');
  lines.push('}');

  return lines.join('\n');
}

function emitFieldJSX(field: FieldUIModel): string {
  const lines: string[] = [];
  const key = field.name;
  const label = field.label;

  lines.push(`      <div className="form-field">`);
  lines.push(`        <label htmlFor="${key}">${label}</label>`);

  switch (field.type) {
    case 'checkbox':
      lines.push(`        <input`);
      lines.push(`          id="${key}"`);
      lines.push(`          type="checkbox"`);
      lines.push(`          checked={Boolean(values['${key}'])}`);
      lines.push(`          onChange={(e) => handleChange('${key}', e.target.checked)}`);
      lines.push(`        />`);
      break;
    case 'select':
      lines.push(`        <select`);
      lines.push(`          id="${key}"`);
      lines.push(`          value={String(values['${key}'] ?? '')}`);
      lines.push(`          onChange={(e) => handleChange('${key}', e.target.value)}`);
      lines.push(`        >`);
      lines.push(`          <option value="">Select…</option>`);
      lines.push(`        </select>`);
      break;
    case 'textarea':
      lines.push(`        <textarea`);
      lines.push(`          id="${key}"`);
      lines.push(`          value={String(values['${key}'] ?? '')}`);
      lines.push(`          onChange={(e) => handleChange('${key}', e.target.value)}`);
      lines.push(`        />`);
      break;
    case 'number':
      lines.push(`        <input`);
      lines.push(`          id="${key}"`);
      lines.push(`          type="number"`);
      lines.push(`          value={String(values['${key}'] ?? '')}`);
      lines.push(`          onChange={(e) => handleChange('${key}', e.target.valueAsNumber)}`);
      lines.push(`        />`);
      break;
    default: {
      const htmlType = field.type === 'password' ? 'password'
        : field.type === 'email' ? 'email'
        : field.type === 'date' ? 'date'
        : field.type === 'datetime' ? 'datetime-local'
        : 'text';
      lines.push(`        <input`);
      lines.push(`          id="${key}"`);
      lines.push(`          type="${htmlType}"`);
      lines.push(`          value={String(values['${key}'] ?? '')}`);
      lines.push(`          onChange={(e) => handleChange('${key}', e.target.value)}`);
      lines.push(`        />`);
      break;
    }
  }

  lines.push(`        {errors['${key}'] && <span className="field-error">{errors['${key}']}</span>}`);
  lines.push(`      </div>`);

  return lines.join('\n');
}
