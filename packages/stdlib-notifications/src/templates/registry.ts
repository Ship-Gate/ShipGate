/**
 * Template registry for managing templates
 */

import { Template, ChannelTemplate, Channel, VariableType } from './types';
import { TemplateNotFoundError, TemplateInactiveError } from '../errors';
import { Channel as ChannelEnum } from '../types';

export interface CreateTemplateInput {
  id: string;
  name: string;
  description?: string;
  channels: Record<string, Omit<ChannelTemplate, 'subject' | 'body' | 'htmlBody' | 'title'> & {
    subject?: string;
    body: string;
    htmlBody?: string;
    title?: string;
  }>;
  variables?: Array<{
    name: string;
    type: VariableType;
    required?: boolean;
    defaultValue?: any;
    description?: string;
  }>;
  defaultLocale?: string;
  locales?: string[];
  category?: string;
  priority?: string;
  active?: boolean;
  version?: number;
}

export class TemplateRegistry {
  private templates: Map<string, Template> = new Map();
  private localeCache: Map<string, Map<string, Template>> = new Map();
  
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    if (this.templates.has(input.id)) {
      throw new Error(`Template ${input.id} already exists`);
    }
    
    // Convert channels to Map
    const channelMap = new Map<Channel, ChannelTemplate>();
    for (const [channel, template] of Object.entries(input.channels)) {
      channelMap.set(channel as Channel, template);
    }
    
    const template: Template = {
      id: input.id,
      name: input.name,
      description: input.description,
      channels: channelMap,
      variables: input.variables || [],
      defaultLocale: input.defaultLocale || 'en',
      locales: input.locales || [input.defaultLocale || 'en'],
      category: input.category,
      priority: input.priority,
      active: input.active !== false, // Default to true
      version: input.version || 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Validate template
    this.validateTemplate(template);
    
    // Store template
    this.templates.set(input.id, template);
    this.updateCache();
    
    return template;
  }
  
  async updateTemplate(id: string, updates: Partial<CreateTemplateInput>): Promise<Template> {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new TemplateNotFoundError(id);
    }
    
    // Create updated template
    const updated: Template = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
      version: existing.version + 1
    };
    
    // Update channels if provided
    if (updates.channels) {
      updated.channels = new Map();
      for (const [channel, template] of Object.entries(updates.channels)) {
        updated.channels.set(channel as Channel, template);
      }
    }
    
    // Validate updated template
    this.validateTemplate(updated);
    
    // Store and cache
    this.templates.set(id, updated);
    this.updateCache();
    
    return updated;
  }
  
  async getTemplate(id: string): Promise<Template> {
    const template = this.templates.get(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }
    return template;
  }
  
  async getTemplateForChannel(id: string, channel: Channel): Promise<ChannelTemplate> {
    const template = await this.getTemplate(id);
    
    if (!template.active) {
      throw new TemplateInactiveError(id);
    }
    
    const channelTemplate = template.channels.get(channel);
    if (!channelTemplate) {
      throw new Error(`Template ${id} does not support channel ${channel}`);
    }
    
    return channelTemplate;
  }
  
  async listTemplates(filter?: {
    active?: boolean;
    category?: string;
    channel?: Channel;
    locale?: string;
  }): Promise<Template[]> {
    let templates = Array.from(this.templates.values());
    
    if (filter) {
      if (filter.active !== undefined) {
        templates = templates.filter(t => t.active === filter.active);
      }
      
      if (filter.category) {
        templates = templates.filter(t => t.category === filter.category);
      }
      
      if (filter.channel) {
        templates = templates.filter(t => t.channels.has(filter.channel!));
      }
      
      if (filter.locale) {
        templates = templates.filter(t => t.locales.includes(filter.locale!));
      }
    }
    
    return templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async deleteTemplate(id: string): Promise<void> {
    if (!this.templates.has(id)) {
      throw new TemplateNotFoundError(id);
    }
    
    this.templates.delete(id);
    this.updateCache();
  }
  
  async activateTemplate(id: string): Promise<void> {
    const template = await this.getTemplate(id);
    template.active = true;
    template.updatedAt = new Date();
    this.updateCache();
  }
  
  async deactivateTemplate(id: string): Promise<void> {
    const template = await this.getTemplate(id);
    template.active = false;
    template.updatedAt = new Date();
    this.updateCache();
  }
  
  async duplicateTemplate(id: string, newId: string, newName?: string): Promise<Template> {
    const original = await this.getTemplate(id);
    
    const duplicate: Template = {
      ...original,
      id: newId,
      name: newName || `${original.name} (Copy)`,
      active: false, // Start inactive
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.templates.set(newId, duplicate);
    this.updateCache();
    
    return duplicate;
  }
  
  async getTemplateVariables(id: string): Promise<Array<{
    name: string;
    type: VariableType;
    required: boolean;
    defaultValue?: any;
    description?: string;
  }>> {
    const template = await this.getTemplate(id);
    return template.variables;
  }
  
  async validateTemplateData(id: string, data: Record<string, any>): Promise<{
    valid: boolean;
    missing: string[];
    invalid: string[];
  }> {
    const template = await this.getTemplate(id);
    const missing: string[] = [];
    const invalid: string[] = [];
    
    for (const variable of template.variables) {
      const value = data[variable.name];
      
      if (variable.required && (value === undefined || value === null)) {
        missing.push(variable.name);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        if (!this.validateVariableType(value, variable.type)) {
          invalid.push(variable.name);
        }
      }
    }
    
    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid
    };
  }
  
  private validateTemplate(template: Template): void {
    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      throw new Error('Template name is required');
    }
    
    if (template.channels.size === 0) {
      throw new Error('Template must have at least one channel');
    }
    
    // Validate each channel template
    for (const [channel, channelTemplate] of template.channels) {
      if (!channelTemplate.body || channelTemplate.body.trim().length === 0) {
        throw new Error(`Channel ${channel} must have a body`);
      }
      
      // Email templates require subject
      if (channel === ChannelEnum.EMAIL && !channelTemplate.subject) {
        throw new Error('Email templates must have a subject');
      }
    }
    
    // Validate locales
    if (!template.locales.includes(template.defaultLocale)) {
      throw new Error('Default locale must be included in locales list');
    }
    
    // Validate variable names
    const variableNames = new Set<string>();
    for (const variable of template.variables) {
      if (!variable.name || variable.name.trim().length === 0) {
        throw new Error('Variable name is required');
      }
      
      if (variableNames.has(variable.name)) {
        throw new Error(`Duplicate variable name: ${variable.name}`);
      }
      
      variableNames.add(variable.name);
    }
  }
  
  private validateVariableType(value: any, type: VariableType): boolean {
    switch (type) {
      case VariableType.STRING:
        return typeof value === 'string';
      case VariableType.NUMBER:
        return typeof value === 'number' && !isNaN(value);
      case VariableType.BOOLEAN:
        return typeof value === 'boolean';
      case VariableType.DATE:
        return value instanceof Date || !isNaN(Date.parse(value));
      case VariableType.LIST:
        return Array.isArray(value);
      case VariableType.OBJECT:
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
  
  private updateCache(): void {
    // Clear and rebuild cache
    this.localeCache.clear();
    
    for (const template of this.templates.values()) {
      for (const locale of template.locales) {
        if (!this.localeCache.has(locale)) {
          this.localeCache.set(locale, new Map());
        }
        this.localeCache.get(locale)!.set(template.id, template);
      }
    }
  }
  
  // Helper methods for testing
  clear(): void {
    this.templates.clear();
    this.localeCache.clear();
  }
  
  size(): number {
    return this.templates.size;
  }
  
  has(id: string): boolean {
    return this.templates.has(id);
  }
}
