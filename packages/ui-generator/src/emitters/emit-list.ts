// ============================================================================
// List View Emitter
// Generates React table/list components for each entity
// ============================================================================

import type { EntityUIModel } from '../types.js';

export function emitListView(entity: EntityUIModel): string {
  const name = entity.name;
  const plural = entity.pluralName;
  const visibleFields = entity.fields.filter((f) => !f.hidden);

  const lines: string[] = [];

  lines.push(`import React from 'react';`);
  lines.push(`import type { ${name} } from './types';`);
  lines.push('');
  lines.push(`export interface ${name}ListProps {`);
  lines.push(`  items: ${name}[];`);
  lines.push(`  onSelect?: (item: ${name}) => void;`);
  lines.push(`  onDelete?: (item: ${name}) => void;`);
  lines.push('}');
  lines.push('');
  lines.push(`export function ${name}List({ items, onSelect, onDelete }: ${name}ListProps) {`);
  lines.push(`  if (items.length === 0) {`);
  lines.push(`    return <p>No ${plural.toLowerCase()} found.</p>;`);
  lines.push('  }');
  lines.push('');
  lines.push('  return (');
  lines.push('    <table>');
  lines.push('      <thead>');
  lines.push('        <tr>');

  for (const f of visibleFields) {
    lines.push(`          <th>${f.label}</th>`);
  }

  lines.push('          <th>Actions</th>');
  lines.push('        </tr>');
  lines.push('      </thead>');
  lines.push('      <tbody>');
  lines.push('        {items.map((item, idx) => (');
  lines.push('          <tr key={idx}>');

  for (const f of visibleFields) {
    if (f.type === 'checkbox') {
      lines.push(`            <td>{item.${f.name} ? 'Yes' : 'No'}</td>`);
    } else if (f.type === 'password') {
      lines.push(`            <td>••••••••</td>`);
    } else {
      lines.push(`            <td>{String(item.${f.name} ?? '')}</td>`);
    }
  }

  lines.push('            <td>');
  lines.push(`              {onSelect && <button onClick={() => onSelect(item)}>View</button>}`);
  lines.push(`              {onDelete && <button onClick={() => onDelete(item)}>Delete</button>}`);
  lines.push('            </td>');
  lines.push('          </tr>');
  lines.push('        ))}');
  lines.push('      </tbody>');
  lines.push('    </table>');
  lines.push('  );');
  lines.push('}');

  return lines.join('\n');
}
