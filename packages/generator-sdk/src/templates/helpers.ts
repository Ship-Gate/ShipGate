/**
 * Template Helpers
 *
 * Common helper functions for code generation templates.
 */

import type { TemplateHelpers, TemplateHelper } from '../types.js';

// ============================================================================
// Default Helpers
// ============================================================================

/**
 * Default template helpers available in all generators.
 */
export const defaultHelpers: TemplateHelpers = {
  // ==========================================================================
  // Case Conversion
  // ==========================================================================

  /**
   * Convert to camelCase.
   */
  camelCase: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  /**
   * Convert to PascalCase.
   */
  pascalCase: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Convert to kebab-case.
   */
  kebabCase: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  },

  /**
   * Convert to snake_case.
   */
  snakeCase: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  },

  /**
   * Convert to SCREAMING_SNAKE_CASE.
   */
  screamingSnakeCase: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toUpperCase();
  },

  // ==========================================================================
  // String Manipulation
  // ==========================================================================

  /**
   * Pluralize a word (simple English rules).
   */
  pluralize: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
    if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) {
      return str + 'es';
    }
    return str + 's';
  },

  /**
   * Singularize a word (simple English rules).
   */
  singularize: (str: unknown): string => {
    if (typeof str !== 'string') return '';
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('es')) return str.slice(0, -2);
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
  },

  /**
   * Truncate a string to a maximum length.
   */
  truncate: (str: unknown, length: unknown, suffix: unknown = '...'): string => {
    if (typeof str !== 'string') return '';
    const len = typeof length === 'number' ? length : 50;
    const suf = typeof suffix === 'string' ? suffix : '...';
    if (str.length <= len) return str;
    return str.slice(0, len - suf.length) + suf;
  },

  /**
   * Pad string to a minimum length.
   */
  padStart: (str: unknown, length: unknown, char: unknown = ' '): string => {
    if (typeof str !== 'string') return '';
    const len = typeof length === 'number' ? length : str.length;
    const ch = typeof char === 'string' ? char : ' ';
    return str.padStart(len, ch);
  },

  /**
   * Pad string to a minimum length (end).
   */
  padEnd: (str: unknown, length: unknown, char: unknown = ' '): string => {
    if (typeof str !== 'string') return '';
    const len = typeof length === 'number' ? length : str.length;
    const ch = typeof char === 'string' ? char : ' ';
    return str.padEnd(len, ch);
  },

  /**
   * Repeat a string n times.
   */
  repeat: (str: unknown, count: unknown): string => {
    if (typeof str !== 'string') return '';
    const n = typeof count === 'number' ? count : 1;
    return str.repeat(n);
  },

  /**
   * Replace all occurrences of a substring.
   */
  replaceAll: (str: unknown, search: unknown, replace: unknown): string => {
    if (typeof str !== 'string') return '';
    if (typeof search !== 'string') return str;
    const rep = typeof replace === 'string' ? replace : '';
    return str.split(search).join(rep);
  },

  // ==========================================================================
  // Code Generation
  // ==========================================================================

  /**
   * Generate a JSDoc comment.
   */
  jsdoc: (description: unknown, params?: unknown): string => {
    const lines = ['/**'];
    if (typeof description === 'string') {
      lines.push(` * ${description}`);
    }
    if (params && typeof params === 'object') {
      lines.push(' *');
      for (const [name, desc] of Object.entries(params as Record<string, string>)) {
        lines.push(` * @param ${name} - ${desc}`);
      }
    }
    lines.push(' */');
    return lines.join('\n');
  },

  /**
   * Generate a Python docstring.
   */
  pydoc: (description: unknown, params?: unknown): string => {
    const lines = ['"""'];
    if (typeof description === 'string') {
      lines.push(description);
    }
    if (params && typeof params === 'object') {
      lines.push('');
      lines.push('Args:');
      for (const [name, desc] of Object.entries(params as Record<string, string>)) {
        lines.push(`    ${name}: ${desc}`);
      }
    }
    lines.push('"""');
    return lines.join('\n');
  },

  /**
   * Generate an import statement.
   */
  import: (items: unknown, from: unknown, type: unknown = 'es6'): string => {
    const itemsArr = Array.isArray(items) ? items : [items];
    const fromStr = typeof from === 'string' ? from : '';
    const importType = typeof type === 'string' ? type : 'es6';

    if (importType === 'commonjs') {
      if (itemsArr.length === 1 && itemsArr[0] === 'default') {
        return `const ${itemsArr[0]} = require('${fromStr}');`;
      }
      return `const { ${itemsArr.join(', ')} } = require('${fromStr}');`;
    }

    // ES6 style
    if (itemsArr.length === 1 && itemsArr[0] === 'default') {
      return `import ${itemsArr[0]} from '${fromStr}';`;
    }
    return `import { ${itemsArr.join(', ')} } from '${fromStr}';`;
  },

  /**
   * Quote a string for code output.
   */
  quote: (str: unknown, style: unknown = 'single'): string => {
    if (typeof str !== 'string') return "''";
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const q = style === 'double' ? '"' : "'";
    return `${q}${escaped}${q}`;
  },

  /**
   * Generate indentation.
   */
  indent: (level: unknown, style: unknown = 'spaces'): string => {
    const n = typeof level === 'number' ? level : 1;
    if (style === 'tabs') return '\t'.repeat(n);
    return '  '.repeat(n);
  },

  // ==========================================================================
  // Type Helpers
  // ==========================================================================

  /**
   * Check if type is optional.
   */
  isOptional: (type: unknown): boolean => {
    if (!type || typeof type !== 'object') return false;
    const t = type as { kind?: string; name?: { name?: string } };
    return t.kind === 'GenericType' && t.name?.name === 'Optional';
  },

  /**
   * Check if type is a list/array.
   */
  isList: (type: unknown): boolean => {
    if (!type || typeof type !== 'object') return false;
    const t = type as { kind?: string; name?: { name?: string } };
    return t.kind === 'ArrayType' || (t.kind === 'GenericType' && t.name?.name === 'List');
  },

  /**
   * Check if type is a map/dictionary.
   */
  isMap: (type: unknown): boolean => {
    if (!type || typeof type !== 'object') return false;
    const t = type as { kind?: string; name?: { name?: string } };
    return t.kind === 'GenericType' && t.name?.name === 'Map';
  },

  /**
   * Get the unwrapped type (for Optional, List, etc.).
   */
  unwrapType: (type: unknown): unknown => {
    if (!type || typeof type !== 'object') return type;
    const t = type as { kind?: string; typeArguments?: unknown[]; elementType?: unknown };
    if (t.kind === 'GenericType' && t.typeArguments?.[0]) {
      return t.typeArguments[0];
    }
    if (t.kind === 'ArrayType' && t.elementType) {
      return t.elementType;
    }
    return type;
  },

  // ==========================================================================
  // Date/Time
  // ==========================================================================

  /**
   * Get current timestamp.
   */
  now: (): string => new Date().toISOString(),

  /**
   * Get current year.
   */
  year: (): number => new Date().getFullYear(),

  /**
   * Format a date.
   */
  formatDate: (date: unknown, format: unknown = 'iso'): string => {
    const d = date instanceof Date ? date : new Date();
    if (format === 'iso') return d.toISOString();
    if (format === 'date') return d.toISOString().split('T')[0];
    if (format === 'time') return d.toISOString().split('T')[1].split('.')[0];
    return d.toISOString();
  },

  // ==========================================================================
  // Math
  // ==========================================================================

  /**
   * Add numbers.
   */
  add: (a: unknown, b: unknown): number => {
    const numA = typeof a === 'number' ? a : 0;
    const numB = typeof b === 'number' ? b : 0;
    return numA + numB;
  },

  /**
   * Subtract numbers.
   */
  subtract: (a: unknown, b: unknown): number => {
    const numA = typeof a === 'number' ? a : 0;
    const numB = typeof b === 'number' ? b : 0;
    return numA - numB;
  },

  /**
   * Multiply numbers.
   */
  multiply: (a: unknown, b: unknown): number => {
    const numA = typeof a === 'number' ? a : 0;
    const numB = typeof b === 'number' ? b : 1;
    return numA * numB;
  },

  /**
   * Divide numbers.
   */
  divide: (a: unknown, b: unknown): number => {
    const numA = typeof a === 'number' ? a : 0;
    const numB = typeof b === 'number' ? b : 1;
    return numB !== 0 ? numA / numB : 0;
  },
};

// ============================================================================
// Custom Helper Registration
// ============================================================================

/**
 * Helper definitions for custom registration.
 */
export interface HelperDefinitions {
  [name: string]: TemplateHelper;
}

/**
 * Register custom helpers.
 *
 * @param helpers - Object mapping helper names to functions
 * @returns Combined helpers object
 */
export function registerCustomHelpers(helpers: HelperDefinitions): TemplateHelpers {
  return {
    ...defaultHelpers,
    ...helpers,
  };
}
