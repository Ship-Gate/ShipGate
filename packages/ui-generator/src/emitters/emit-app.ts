// ============================================================================
// App Shell / Router Emitter
// Generates a top-level App component with React Router wiring
// ============================================================================

import type { DomainUIModel } from '../types.js';

export function emitApp(model: DomainUIModel, includeRouting: boolean): string {
  const lines: string[] = [];

  lines.push(`import React from 'react';`);

  if (includeRouting) {
    lines.push(`import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';`);
  }

  // Import all entity components
  for (const entity of model.entities) {
    const n = entity.name;
    lines.push(`import { ${n}List } from './${n}List';`);
    lines.push(`import { ${n}Detail } from './${n}Detail';`);
    lines.push(`import { ${n}Form } from './${n}Form';`);
  }

  // Import behavior form components
  for (const behavior of model.behaviors) {
    if (behavior.inputFields.length > 0) {
      lines.push(`import { ${behavior.name}Form } from './${behavior.name}Form';`);
    }
  }

  lines.push('');
  lines.push('export function App() {');

  if (includeRouting) {
    lines.push('  return (');
    lines.push('    <BrowserRouter>');
    lines.push('      <nav>');
    for (const entity of model.entities) {
      const kebab = toKebab(entity.name);
      lines.push(`        <Link to="/${kebab}">${entity.pluralName}</Link>`);
    }
    lines.push('      </nav>');
    lines.push('      <Routes>');

    for (const entity of model.entities) {
      const kebab = toKebab(entity.name);
      const n = entity.name;
      lines.push(`        <Route path="/${kebab}" element={<${n}List items={[]} />} />`);
      lines.push(`        <Route path="/${kebab}/new" element={<${n}Form onSubmit={console.log} />} />`);
      lines.push(`        <Route path="/${kebab}/:id" element={<${n}Detail item={{} as any} />} />`);
    }

    for (const behavior of model.behaviors) {
      if (behavior.inputFields.length > 0) {
        const kebab = toKebab(behavior.name);
        lines.push(`        <Route path="/${kebab}" element={<${behavior.name}Form onSubmit={console.log} />} />`);
      }
    }

    lines.push('      </Routes>');
    lines.push('    </BrowserRouter>');
    lines.push('  );');
  } else {
    lines.push('  return (');
    lines.push('    <div>');
    lines.push(`      <h1>${model.name}</h1>`);
    for (const entity of model.entities) {
      lines.push(`      <section>`);
      lines.push(`        <h2>${entity.pluralName}</h2>`);
      lines.push(`        <${entity.name}List items={[]} />`);
      lines.push(`      </section>`);
    }
    lines.push('    </div>');
    lines.push('  );');
  }

  lines.push('}');
  return lines.join('\n');
}

function toKebab(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}
