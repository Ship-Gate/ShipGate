/**
 * Template engine with HTML escaping
 */

import { 
  ChannelTemplate, 
  RenderContext, 
  RenderResult, 
  TemplateError,
  TemplateFilter,
  TemplateFunction,
  TemplateEngine as ITemplateEngine
} from './types';
import { TemplateRenderError, InvalidVariableError } from '../errors';

export class TemplateEngine implements ITemplateEngine {
  private filters: Map<string, TemplateFilter> = new Map();
  private functions: Map<string, TemplateFunction> = new Map();
  private escapeHtml: boolean = true;
  
  constructor() {
    this.initializeDefaultFilters();
    this.initializeDefaultFunctions();
  }
  
  async render(template: ChannelTemplate, context: RenderContext): Promise<RenderResult> {
    const variablesUsed = new Set<string>();
    const missingVariables = new Set<string>();
    
    try {
      // Validate required variables
      this.validateVariables(template, context);
      
      // Render each part
      const subject = template.subject ? 
        await this.renderString(template.subject, context, variablesUsed, missingVariables) : 
        undefined;
      
      const body = await this.renderString(template.body, context, variablesUsed, missingVariables);
      
      const htmlBody = template.htmlBody ? 
        await this.renderString(template.htmlBody, context, variablesUsed, missingVariables) : 
        undefined;
      
      const title = template.title ? 
        await this.renderString(template.title, context, variablesUsed, missingVariables) : 
        undefined;
      
      return {
        subject,
        body,
        htmlBody,
        title,
        metadata: {
          variablesUsed: Array.from(variablesUsed),
          missingVariables: Array.from(missingVariables),
          locale: context.locale || context.recipient.locale || 'en'
        }
      };
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        throw error;
      }
      throw new TemplateRenderError(error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  private async renderString(
    template: string, 
    context: RenderContext,
    variablesUsed: Set<string>,
    missingVariables: Set<string>
  ): Promise<string> {
    // Simple template syntax: {{variable}} or {{function(arg1, arg2)}}
    // Support filters: {{variable | filter:arg1:arg2 }}
    
    const regex = /\{\{([^}]+)\}\}/g;
    let result = template;
    const matches = [...template.matchAll(regex)];
    
    for (const match of matches) {
      const fullMatch = match[0];
      const expression = match[1].trim();
      
      try {
        const rendered = await this.evaluateExpression(expression, context);
        result = result.replace(fullMatch, rendered);
        
        // Track variable usage
        if (expression.includes('recipient.') || !expression.includes('(')) {
          const varName = expression.split('|')[0].split(':')[0].trim();
          variablesUsed.add(varName);
          
          // Check if variable was missing
          const value = this.getValue(expression.split('|')[0].split(':')[0].trim(), context);
          if (value === undefined || value === null) {
            missingVariables.add(varName);
          }
        }
      } catch (error) {
        throw new TemplateRenderError(
          `Error rendering expression "${expression}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
    
    return result;
  }
  
  private async evaluateExpression(expression: string, context: RenderContext): Promise<string> {
    // Parse filters and functions
    const parts = expression.split('|').map(p => p.trim());
    let value = parts[0];
    
    // Evaluate base value
    if (value.includes('(')) {
      // It's a function
      const fnMatch = value.match(/^(\w+)\((.*)\)$/);
      if (fnMatch) {
        const fnName = fnMatch[1];
        const args = fnMatch[2] ? fnMatch[2].split(',').map(a => a.trim()) : [];
        
        const fn = this.functions.get(fnName);
        if (!fn) {
          throw new InvalidVariableError(`Unknown function: ${fnName}`);
        }
        
        const evaluatedArgs = args.map(arg => {
          if (arg.startsWith('"') || arg.startsWith("'")) {
            return arg.slice(1, -1); // String literal
          }
          return this.getValue(arg, context);
        });
        
        value = await fn(context, ...evaluatedArgs);
      }
    } else {
      // It's a variable
      value = this.getValue(value, context);
    }
    
    // Apply filters
    for (let i = 1; i < parts.length; i++) {
      const filterParts = parts[i].split(':').map(p => p.trim());
      const filterName = filterParts[0];
      const filterArgs = filterParts.slice(1).map(arg => {
        if (arg.startsWith('"') || arg.startsWith("'")) {
          return arg.slice(1, -1);
        }
        return this.getValue(arg, context);
      });
      
      const filter = this.filters.get(filterName);
      if (!filter) {
        throw new InvalidVariableError(`Unknown filter: ${filterName}`);
      }
      
      value = filter(value, ...filterArgs);
    }
    
    // Convert to string and escape if needed
    const stringValue = value !== null && value !== undefined ? String(value) : '';
    
    // Escape HTML by default for htmlBody
    if (this.escapeHtml && typeof stringValue === 'string') {
      return this.escapeHtmlEntities(stringValue);
    }
    
    return stringValue;
  }
  
  private getValue(path: string, context: RenderContext): any {
    if (path.startsWith('recipient.')) {
      const prop = path.substring(10);
      return context.recipient[prop as keyof typeof context.recipient];
    }
    
    if (path.startsWith('variables.')) {
      const varName = path.substring(10);
      return context.variables[varName];
    }
    
    // Check if it's a direct variable
    if (context.variables.hasOwnProperty(path)) {
      return context.variables[path];
    }
    
    // Check special context values
    if (path === 'locale') {
      return context.locale || context.recipient.locale || 'en';
    }
    
    if (path === 'timezone') {
      return context.recipient.timezone || 'UTC';
    }
    
    return undefined;
  }
  
  private validateVariables(template: ChannelTemplate, context: RenderContext): void {
    // This would be enhanced to parse template and extract all variables
    // For now, we'll do basic validation
    
    const allStrings = [
      template.subject || '',
      template.body,
      template.htmlBody || '',
      template.title || ''
    ].join('\n'); // Use newline as separator to avoid issues with empty strings
    
    if (!allStrings) return;
    
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = allStrings.match(regex);
    
    if (!matches) return;
    
    for (const match of matches) {
      const expression = match.slice(2, -2).trim();
      const varName = expression.split('|')[0].split(':')[0].trim();
      
      // Skip functions and special variables
      if (varName.includes('(') || varName.startsWith('recipient.') || varName === 'locale' || varName === 'timezone') {
        continue;
      }
      
      // Check if it's a variable that should be in context.variables
      if (!varName.startsWith('variables.') && !context.variables.hasOwnProperty(varName)) {
        // Check if it might be a required variable (this would come from template definition)
        // For now, we'll allow undefined variables
      }
    }
  }
  
  private escapeHtmlEntities(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
  }
  
  addFilter(name: string, filter: TemplateFilter): void {
    this.filters.set(name, filter);
  }
  
  addFunction(name: string, fn: TemplateFunction): void {
    this.functions.set(name, fn);
  }
  
  setEscapeHtml(escape: boolean): void {
    this.escapeHtml = escape;
  }
  
  private initializeDefaultFilters(): void {
    // String filters
    this.addFilter('upper', (value: any) => String(value).toUpperCase());
    this.addFilter('lower', (value: any) => String(value).toLowerCase());
    this.addFilter('capitalize', (value: any) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    this.addFilter('title', (value: any) => {
      return String(value).replace(/\w\S*/g, txt => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    });
    
    // Number filters
    this.addFilter('default', (value: any, defaultValue: any) => 
      value !== null && value !== undefined ? value : defaultValue
    );
    
    this.addFilter('number', (value: any, decimals: number = 0) => {
      const num = Number(value);
      return isNaN(num) ? '0' : num.toFixed(decimals);
    });
    
    // Date filters
    this.addFilter('date', (value: any, format: string = 'ISO') => {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      
      switch (format) {
        case 'ISO':
          return date.toISOString();
        case 'locale':
          return date.toLocaleDateString();
        case 'time':
          return date.toLocaleTimeString();
        case 'datetime':
          return date.toLocaleString();
        default:
          return date.toLocaleDateString();
      }
    });
    
    // Utility filters
    this.addFilter('json', (value: any) => JSON.stringify(value));
    this.addFilter('length', (value: any) => {
      if (Array.isArray(value) || typeof value === 'string') {
        return value.length;
      }
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length;
      }
      return 0;
    });
    
    // URL encoding
    this.addFilter('urlencode', (value: any) => encodeURIComponent(String(value)));
    
    // Truncate
    this.addFilter('truncate', (value: any, length: number = 50, suffix: string = '...') => {
      const str = String(value);
      return str.length > length ? str.substring(0, length) + suffix : str;
    });
  }
  
  private initializeDefaultFunctions(): void {
    // Date functions
    this.addFunction('now', () => new Date().toISOString());
    
    // String functions
    this.addFunction('concat', (...args: any[]) => args.join(''));
    
    // Conditional functions
    this.addFunction('if', (context: RenderContext, condition: any, trueValue: any, falseValue: any) => 
      condition ? trueValue : falseValue
    );
    
    // Math functions
    this.addFunction('add', (context: RenderContext, a: number, b: number) => (a || 0) + (b || 0));
    this.addFunction('subtract', (context: RenderContext, a: number, b: number) => (a || 0) - (b || 0));
    
    // Format functions
    this.addFunction('formatCurrency', (context: RenderContext, amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount || 0);
    });
  }
}
