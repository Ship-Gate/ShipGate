/**
 * Tests for the template engine
 */

import { describe, it, expect } from 'vitest';
import { TemplateEngine, TemplateRegistry } from '../src/templates';
import { Channel } from '../src/types';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  
  beforeEach(() => {
    engine = new TemplateEngine();
  });
  
  describe('Variable Rendering', () => {
    it('should render simple variables', async () => {
      const template = {
        body: 'Hello {{variables.name}}!'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { name: 'John' }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('Hello John!');
    });
    
    it('should render recipient properties', async () => {
      const template = {
        body: 'Hello {{recipient.email}}!'
      };
      
      const context = {
        recipient: { 
          id: 'user-123',
          email: 'john@example.com'
        },
        variables: {}
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('Hello john@example.com!');
    });
    
    it('should handle missing variables gracefully', async () => {
      const template = {
        body: 'Hello {{variables.name}}!'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: {}
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('Hello !');
      expect(result.metadata?.missingVariables).toContain('variables.name');
    });
  });
  
  describe('Filters', () => {
    it('should apply string filters', async () => {
      const template = {
        body: '{{variables.name | upper}} - {{variables.message | lower}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { 
          name: 'John',
          message: 'HELLO WORLD'
        }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('JOHN - hello world');
    });
    
    it('should apply number filters', async () => {
      const template = {
        body: 'Total: ${{variables.price | number:2}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { price: 123.456 }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('Total: $123.46');
    });
    
    it('should apply date filters', async () => {
      const template = {
        body: 'Date: {{variables.date | date:locale}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { 
          date: '2024-01-01T00:00:00Z'
        }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toMatch(/^Date: \d{1,2}\/\d{1,2}\/\d{4}$/);
    });
    
    it('should chain filters', async () => {
      const template = {
        body: '{{variables.text | truncate:10 | upper}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { 
          text: 'This is a very long text'
        }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('THIS IS A...');
    });
  });
  
  describe('Functions', () => {
    it('should call functions with arguments', async () => {
      const template = {
        body: '{{if:variables.showGreeting,"Hello","Goodbye"}} {{variables.name}}!'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { 
          showGreeting: true,
          name: 'John'
        }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('Hello John!');
    });
    
    it('should use now function', async () => {
      const template = {
        body: 'Current time: {{now}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: {}
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toMatch(/^Current time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
  
  describe('HTML Escaping', () => {
    it('should escape HTML by default', async () => {
      engine.setEscapeHtml(true);
      
      const template = {
        htmlBody: '<p>{{variables.message}}</p>'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { 
          message: '<script>alert("xss")</script>'
        }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.htmlBody).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
    });
    
    it('should allow disabling HTML escaping', async () => {
      engine.setEscapeHtml(false);
      
      const template = {
        htmlBody: '<p>{{variables.message}}</p>'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { 
          message: '<strong>Bold</strong>'
        }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.htmlBody).toBe('<p><strong>Bold</strong></p>');
    });
  });
  
  describe('Custom Filters and Functions', () => {
    it('should allow adding custom filters', async () => {
      engine.addFilter('reverse', (value: string) => 
        value.split('').reverse().join('')
      );
      
      const template = {
        body: '{{variables.text | reverse}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { text: 'hello' }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('olleh');
    });
    
    it('should allow adding custom functions', async () => {
      engine.addFunction('greet', async (context, name) => 
        `Greetings, ${name}!`
      );
      
      const template = {
        body: '{{greet:variables.name}}'
      };
      
      const context = {
        recipient: { id: 'user-123' },
        variables: { name: 'John' }
      };
      
      const result = await engine.render(template, context);
      
      expect(result.body).toBe('Greetings, John!');
    });
  });
});

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;
  
  beforeEach(() => {
    registry = new TemplateRegistry();
  });
  
  it('should create and retrieve templates', async () => {
    const template = await registry.createTemplate({
      id: 'test-template',
      name: 'Test Template',
      channels: {
        EMAIL: {
          subject: 'Test',
          body: 'Test body'
        }
      }
    });
    
    expect(template.id).toBe('test-template');
    
    const retrieved = await registry.getTemplate('test-template');
    expect(retrieved.id).toBe('test-template');
  });
  
  it('should validate required fields', async () => {
    await expect(
      registry.createTemplate({
        id: 'invalid',
        name: '',
        channels: {}
      })
    ).rejects.toThrow('Template name is required');
    
    await expect(
      registry.createTemplate({
        id: 'invalid2',
        name: 'Test',
        channels: {}
      })
    ).rejects.toThrow('Template must have at least one channel');
  });
  
  it('should require subject for email templates', async () => {
    await expect(
      registry.createTemplate({
        id: 'email-no-subject',
        name: 'Email No Subject',
        channels: {
          EMAIL: {
            body: 'Body without subject'
          }
        }
      })
    ).rejects.toThrow('Email templates must have a subject');
  });
  
  it('should update templates', async () => {
    await registry.createTemplate({
      id: 'update-test',
      name: 'Original Name',
      channels: {
        EMAIL: {
          subject: 'Original',
          body: 'Original body'
        }
      }
    });
    
    const updated = await registry.updateTemplate('update-test', {
      name: 'Updated Name',
      channels: {
        EMAIL: {
          subject: 'Updated',
          body: 'Updated body'
        }
      }
    });
    
    expect(updated.name).toBe('Updated Name');
    expect(updated.version).toBe(2);
  });
  
  it('should validate template data', async () => {
    await registry.createTemplate({
      id: 'validation-test',
      name: 'Validation Test',
      variables: [
        { name: 'required', type: 'STRING' as any, required: true },
        { name: 'optional', type: 'NUMBER' as any, required: false }
      ],
      channels: {
        EMAIL: {
          subject: 'Test',
          body: 'Test'
        }
      }
    });
    
    // Valid data
    const valid = await registry.validateTemplateData('validation-test', {
      required: 'value',
      optional: 123
    });
    expect(valid.valid).toBe(true);
    
    // Missing required
    const missing = await registry.validateTemplateData('validation-test', {
      optional: 123
    });
    expect(missing.valid).toBe(false);
    expect(missing.missing).toContain('required');
    
    // Invalid type
    const invalid = await registry.validateTemplateData('validation-test', {
      required: 'value',
      optional: 'not a number'
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.invalid).toContain('optional');
  });
});
