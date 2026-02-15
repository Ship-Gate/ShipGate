// ============================================================================
// Frontend Generator Utilities
// ============================================================================

export function toKebab(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

export function toPascal(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toUpperCase());
}

export function toCamel(str: string): string {
  const pascal = toPascal(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function pluralize(name: string): string {
  if (name.endsWith('s')) return name + 'es';
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  return name + 's';
}
