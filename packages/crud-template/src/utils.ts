/**
 * String utilities for template generation
 */

export function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

export function pluralize(str: string): string {
  const irregular: Record<string, string> = {
    person: 'people',
    child: 'children',
    product: 'products',
    invoice: 'invoices',
    post: 'posts',
  };
  const lower = str.toLowerCase();
  if (irregular[lower]) return irregular[lower];
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
    return str.slice(0, -1) + 'ies';
  }
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
    return str + 'es';
  }
  return str + 's';
}
