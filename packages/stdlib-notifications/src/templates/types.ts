/**
 * Template system types
 */

import { Channel, VariableType } from '../types';

// Re-export VariableType
export { VariableType };

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface ChannelTemplate {
  subject?: string;
  body: string;
  htmlBody?: string;
  // Push-specific
  title?: string;
  imageUrl?: string;
  sound?: string;
  badge?: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  
  // Channel-specific templates
  channels: Map<Channel, ChannelTemplate>;
  
  // Variables
  variables: TemplateVariable[];
  
  // Localization
  defaultLocale: string;
  locales: string[];
  
  // Settings
  category?: string;
  priority?: string;
  
  // Status
  active: boolean;
  
  // Versioning
  version: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RenderContext {
  recipient: {
    id: string;
    email?: string;
    phone?: string;
    locale?: string;
    timezone?: string;
  };
  variables: Record<string, any>;
  locale?: string;
}

export interface RenderResult {
  subject?: string;
  body: string;
  htmlBody?: string;
  title?: string; // For push notifications
  metadata?: {
    variablesUsed: string[];
    missingVariables: string[];
    locale: string;
  };
}

export interface TemplateError {
  code: string;
  message: string;
  line?: number;
  column?: number;
}

export interface TemplateFunction {
  (context: RenderContext, ...args: any[]): string | Promise<string>;
}

export interface TemplateFilter {
  (value: any, ...args: any[]): any;
}

export interface TemplateEngine {
  render(template: ChannelTemplate, context: RenderContext): Promise<RenderResult>;
  addFilter(name: string, filter: TemplateFilter): void;
  addFunction(name: string, fn: TemplateFunction): void;
  setEscapeHtml(escape: boolean): void;
}
