// ============================================================================
// Detail View Emitter
// Generates React detail/show components for each entity
// ============================================================================

import type { EntityUIModel } from '../types.js';

export function emitDetailView(entity: EntityUIModel): string {
  const name = entity.name;
  const visibleFields = entity.fields.filter((f) => !f.hidden);

  const lines: string[] = [];

  lines.push(`import React from 'react';`);
  lines.push(`import type { ${name} } from './types';`);
  lines.push('');
  lines.push(`export interface ${name}DetailProps {`);
  lines.push(`  item: ${name};`);
  lines.push(`  onEdit?: () => void;`);
  lines.push(`  onBack?: () => void;`);
  lines.push('}');
  lines.push('');
  lines.push(`export function ${name}Detail({ item, onEdit, onBack }: ${name}DetailProps) {`);
  lines.push('  return (');
  lines.push(`    <div className="detail-view">`);
  lines.push(`      <h2>${entity.displayName} Detail</h2>`);
  lines.push('      <dl>');

  for (const f of visibleFields) {
    if (f.type === 'password') {
      lines.push(`        <dt>${f.label}</dt>`);
      lines.push(`        <dd>••••••••</dd>`);
    } else if (f.type === 'checkbox') {
      lines.push(`        <dt>${f.label}</dt>`);
      lines.push(`        <dd>{item.${f.name} ? 'Yes' : 'No'}</dd>`);
    } else {
      lines.push(`        <dt>${f.label}</dt>`);
      lines.push(`        <dd>{String(item.${f.name} ?? '')}</dd>`);
    }
  }

  lines.push('      </dl>');
  lines.push('      <div className="detail-actions">');
  lines.push(`        {onBack && <button onClick={onBack}>Back</button>}`);
  lines.push(`        {onEdit && <button onClick={onEdit}>Edit</button>}`);
  lines.push('      </div>');
  lines.push('    </div>');
  lines.push('  );');
  lines.push('}');

  return lines.join('\n');
}
