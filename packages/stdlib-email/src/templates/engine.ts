/**
 * Email Template Engine
 * 
 * Renders email templates with variable substitution and validation.
 */

import type {
  TemplateEngine,
  TemplateVariable,
  TemplateValidation,
  TemplateError,
  TemplateWarning,
  VariableType,
} from '../types.js';

/**
 * Default template engine using simple variable substitution
 */
export class SimpleTemplateEngine implements TemplateEngine {
  name = 'simple';
  
  async render(template: string, data: Record<string, unknown>): Promise<string> {
    return renderTemplate(template, data);
  }
  
  async validate(template: string): Promise<TemplateValidation> {
    return validateTemplate(template);
  }
  
  extractVariables(template: string): TemplateVariable[] {
    return extractTemplateVariables(template);
  }
}

/**
 * Handlebars-compatible template engine
 */
export class HandlebarsTemplateEngine implements TemplateEngine {
  name = 'handlebars';
  
  async render(template: string, data: Record<string, unknown>): Promise<string> {
    return renderHandlebarsTemplate(template, data);
  }
  
  async validate(template: string): Promise<TemplateValidation> {
    return validateHandlebarsTemplate(template);
  }
  
  extractVariables(template: string): TemplateVariable[] {
    return extractHandlebarsVariables(template);
  }
}

/**
 * Render simple template with {{variable}} syntax
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = getNestedValue(data, trimmedKey);
    
    if (value === undefined || value === null) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  });
}

/**
 * Render Handlebars-compatible template
 */
export function renderHandlebarsTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  let result = template;
  
  // Handle {{#if condition}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, condition, content) => {
      const value = getNestedValue(data, condition.trim());
      return isTruthy(value) ? content : '';
    }
  );
  
  // Handle {{#unless condition}}...{{/unless}}
  result = result.replace(
    /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (match, condition, content) => {
      const value = getNestedValue(data, condition.trim());
      return !isTruthy(value) ? content : '';
    }
  );
  
  // Handle {{#each array}}...{{/each}}
  result = result.replace(
    /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, arrayKey, content) => {
      const array = getNestedValue(data, arrayKey.trim());
      if (!Array.isArray(array)) return '';
      
      return array.map((item, index) => {
        let itemContent = content;
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        // Replace {{@first}} and {{@last}}
        itemContent = itemContent.replace(/\{\{@first\}\}/g, String(index === 0));
        itemContent = itemContent.replace(/\{\{@last\}\}/g, String(index === array.length - 1));
        
        // If item is object, allow accessing properties
        if (typeof item === 'object' && item !== null) {
          return renderTemplate(itemContent, { ...data, ...item });
        }
        return itemContent;
      }).join('');
    }
  );
  
  // Handle simple variables {{variable}}
  result = renderTemplate(result, data);
  
  // Handle HTML escaping {{{unescaped}}}
  result = result.replace(/\{\{\{([^}]+)\}\}\}/g, (match, key) => {
    const value = getNestedValue(data, key.trim());
    return value === undefined || value === null ? '' : String(value);
  });
  
  return result;
}

/**
 * Validate template syntax
 */
export function validateTemplate(template: string): TemplateValidation {
  const errors: TemplateError[] = [];
  const warnings: TemplateWarning[] = [];
  
  // Check for unmatched braces
  const openBraces = (template.match(/\{\{/g) || []).length;
  const closeBraces = (template.match(/\}\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push({
      message: `Unmatched braces: ${openBraces} opening vs ${closeBraces} closing`,
    });
  }
  
  // Check for empty variables
  const emptyVars = template.match(/\{\{\s*\}\}/g);
  if (emptyVars) {
    errors.push({
      message: `Found ${emptyVars.length} empty variable placeholder(s)`,
    });
  }
  
  // Check for unclosed blocks
  const blocks = ['if', 'unless', 'each', 'with'];
  for (const block of blocks) {
    const openRegex = new RegExp(`\\{\\{#${block}`, 'g');
    const closeRegex = new RegExp(`\\{\\{/${block}\\}\\}`, 'g');
    const opens = (template.match(openRegex) || []).length;
    const closes = (template.match(closeRegex) || []).length;
    
    if (opens !== closes) {
      errors.push({
        message: `Unclosed {{#${block}}} block: ${opens} opening vs ${closes} closing`,
      });
    }
  }
  
  // Warn about potentially missing variables
  const variables = extractTemplateVariables(template);
  for (const variable of variables) {
    if (variable.name.includes('.') && !variable.name.startsWith('@')) {
      warnings.push({
        message: `Nested variable '${variable.name}' - ensure parent object exists`,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Handlebars template
 */
export function validateHandlebarsTemplate(template: string): TemplateValidation {
  const baseValidation = validateTemplate(template);
  const errors = [...baseValidation.errors];
  const warnings = [...baseValidation.warnings];
  
  // Check for invalid helper usage
  const helperPattern = /\{\{([a-z]+)\s+/gi;
  let match;
  while ((match = helperPattern.exec(template)) !== null) {
    const helper = match[1];
    const validHelpers = ['#if', '#unless', '#each', '#with', '/if', '/unless', '/each', '/with'];
    if (!validHelpers.includes(helper) && !validHelpers.includes('#' + helper)) {
      warnings.push({
        message: `Unknown helper '${helper}' at position ${match.index}`,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Extract variables from template
 */
export function extractTemplateVariables(template: string): TemplateVariable[] {
  const variables: Map<string, TemplateVariable> = new Map();
  
  // Match {{variable}} and {{{variable}}}
  const varPattern = /\{\{+([^#/}][^}]*?)\}+\}/g;
  let match;
  
  while ((match = varPattern.exec(template)) !== null) {
    const name = match[1].trim();
    
    // Skip special variables
    if (name.startsWith('@') || name === 'this') continue;
    
    // Get root variable name
    const rootName = name.split('.')[0].split(' ')[0];
    
    if (!variables.has(rootName)) {
      variables.set(rootName, {
        name: rootName,
        type: inferVariableType(template, rootName),
        required: !isVariableOptional(template, rootName),
      });
    }
  }
  
  return Array.from(variables.values());
}

/**
 * Extract variables from Handlebars template
 */
export function extractHandlebarsVariables(template: string): TemplateVariable[] {
  const variables = extractTemplateVariables(template);
  
  // Find variables used in #each blocks and mark as arrays
  const eachPattern = /\{\{#each\s+([^}]+)\}\}/g;
  let match;
  
  while ((match = eachPattern.exec(template)) !== null) {
    const varName = match[1].trim();
    const existing = variables.find(v => v.name === varName);
    if (existing) {
      existing.type = 'array';
    } else {
      variables.push({
        name: varName,
        type: 'array',
        required: true,
      });
    }
  }
  
  return variables;
}

/**
 * Infer variable type from usage
 */
function inferVariableType(template: string, varName: string): VariableType {
  // Check if used in #each
  if (template.includes(`{{#each ${varName}}}`)) {
    return 'array';
  }
  
  // Check if used in #if with comparison
  const ifPattern = new RegExp(`\\{\\{#if\\s+${varName}\\s*[<>=!]`, 'g');
  if (ifPattern.test(template)) {
    return 'number';
  }
  
  // Default to string
  return 'string';
}

/**
 * Check if variable is optional (used in #if block)
 */
function isVariableOptional(template: string, varName: string): boolean {
  return template.includes(`{{#if ${varName}}}`) || 
         template.includes(`{{#unless ${varName}}}`);
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Check if value is truthy for template conditionals
 */
function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create template engine instance
 */
export function createTemplateEngine(type: 'simple' | 'handlebars' = 'simple'): TemplateEngine {
  switch (type) {
    case 'handlebars':
      return new HandlebarsTemplateEngine();
    default:
      return new SimpleTemplateEngine();
  }
}
