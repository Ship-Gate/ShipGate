/**
 * Template Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine, defaultHelpers } from '../src/index.js';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('basic rendering', () => {
    it('should render simple templates', () => {
      engine.registerTemplate('test', 'Hello, {{name}}!');
      const result = engine.render('test', { name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    it('should render inline templates', () => {
      const result = engine.renderInline('Value: {{value}}', { value: 42 });
      expect(result).toBe('Value: 42');
    });

    it('should handle missing templates', () => {
      expect(() => engine.render('nonexistent', {})).toThrow(/not found/);
    });
  });

  describe('built-in helpers', () => {
    it('should support eq helper', () => {
      engine.registerTemplate('test', '{{#if (eq a b)}}equal{{else}}not equal{{/if}}');
      expect(engine.render('test', { a: 1, b: 1 })).toBe('equal');
      expect(engine.render('test', { a: 1, b: 2 })).toBe('not equal');
    });

    it('should support lowercase/uppercase helpers', () => {
      engine.registerTemplate('lower', '{{lowercase name}}');
      engine.registerTemplate('upper', '{{uppercase name}}');
      expect(engine.render('lower', { name: 'HELLO' })).toBe('hello');
      expect(engine.render('upper', { name: 'hello' })).toBe('HELLO');
    });

    it('should support camelCase helper', () => {
      engine.registerTemplate('test', '{{camelCase name}}');
      expect(engine.render('test', { name: 'MyClass' })).toBe('myClass');
    });

    it('should support kebabCase helper', () => {
      engine.registerTemplate('test', '{{kebabCase name}}');
      expect(engine.render('test', { name: 'MyClassName' })).toBe('my-class-name');
    });

    it('should support snakeCase helper', () => {
      engine.registerTemplate('test', '{{snakeCase name}}');
      expect(engine.render('test', { name: 'MyClassName' })).toBe('my_class_name');
    });

    it('should support array helpers', () => {
      engine.registerTemplate('first', '{{first items}}');
      engine.registerTemplate('last', '{{last items}}');
      engine.registerTemplate('length', '{{length items}}');
      engine.registerTemplate('join', '{{join items ", "}}');

      const items = ['a', 'b', 'c'];
      expect(engine.render('first', { items })).toBe('a');
      expect(engine.render('last', { items })).toBe('c');
      expect(engine.render('length', { items })).toBe('3');
      expect(engine.render('join', { items })).toBe('a, b, c');
    });

    it('should support json helper', () => {
      engine.registerTemplate('test', '{{{json obj}}}');
      const result = engine.render('test', { obj: { a: 1 } });
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it('should support indent helper', () => {
      engine.registerTemplate('test', '{{#indent 2}}line1\nline2{{/indent}}');
      const result = engine.render('test', {});
      expect(result).toContain('    line1');
      expect(result).toContain('    line2');
    });
  });

  describe('type helpers', () => {
    it('should convert ISL types to TypeScript', () => {
      engine.registerTemplate('test', '{{typeToTS type}}');

      // Simple types
      expect(engine.render('test', {
        type: { kind: 'SimpleType', name: { name: 'String' } },
      })).toBe('string');

      expect(engine.render('test', {
        type: { kind: 'SimpleType', name: { name: 'Int' } },
      })).toBe('number');

      // Generic types
      expect(engine.render('test', {
        type: {
          kind: 'GenericType',
          name: { name: 'List' },
          typeArguments: [{ kind: 'SimpleType', name: { name: 'String' } }],
        },
      })).toBe('string[]');

      expect(engine.render('test', {
        type: {
          kind: 'GenericType',
          name: { name: 'Optional' },
          typeArguments: [{ kind: 'SimpleType', name: { name: 'Int' } }],
        },
      })).toBe('number | null');
    });

    it('should convert ISL types to Python', () => {
      engine.registerTemplate('test', '{{typeToPython type}}');

      expect(engine.render('test', {
        type: { kind: 'SimpleType', name: { name: 'String' } },
      })).toBe('str');

      expect(engine.render('test', {
        type: {
          kind: 'GenericType',
          name: { name: 'List' },
          typeArguments: [{ kind: 'SimpleType', name: { name: 'Int' } }],
        },
      })).toBe('list[int]');
    });

    it('should convert ISL types to Go', () => {
      engine.registerTemplate('test', '{{typeToGo type}}');

      expect(engine.render('test', {
        type: { kind: 'SimpleType', name: { name: 'String' } },
      })).toBe('string');

      expect(engine.render('test', {
        type: { kind: 'SimpleType', name: { name: 'Int' } },
      })).toBe('int64');

      expect(engine.render('test', {
        type: {
          kind: 'GenericType',
          name: { name: 'List' },
          typeArguments: [{ kind: 'SimpleType', name: { name: 'String' } }],
        },
      })).toBe('[]string');
    });

    it('should convert ISL types to Rust', () => {
      engine.registerTemplate('test', '{{typeToRust type}}');

      expect(engine.render('test', {
        type: { kind: 'SimpleType', name: { name: 'String' } },
      })).toBe('String');

      expect(engine.render('test', {
        type: {
          kind: 'GenericType',
          name: { name: 'Optional' },
          typeArguments: [{ kind: 'SimpleType', name: { name: 'Int' } }],
        },
      })).toBe('Option<i64>');
    });
  });

  describe('custom helpers', () => {
    it('should allow registering custom helpers', () => {
      engine.registerHelper('shout', (str: string) => String(str).toUpperCase() + '!');
      engine.registerTemplate('test', '{{shout message}}');
      expect(engine.render('test', { message: 'hello' })).toBe('HELLO!');
    });
  });

  describe('partials', () => {
    it('should support partials', () => {
      engine.registerPartial('greeting', 'Hello, {{name}}!');
      engine.registerTemplate('test', '{{> greeting}}');
      expect(engine.render('test', { name: 'World' })).toBe('Hello, World!');
    });
  });
});

describe('defaultHelpers', () => {
  it('should include case conversion helpers', () => {
    expect(defaultHelpers.camelCase('MyClass')).toBe('myClass');
    expect(defaultHelpers.pascalCase('myClass')).toBe('MyClass');
    expect(defaultHelpers.kebabCase('MyClassName')).toBe('my-class-name');
    expect(defaultHelpers.snakeCase('MyClassName')).toBe('my_class_name');
    expect(defaultHelpers.screamingSnakeCase('MyClassName')).toBe('MY_CLASS_NAME');
  });

  it('should include string manipulation helpers', () => {
    expect(defaultHelpers.pluralize('user')).toBe('users');
    expect(defaultHelpers.pluralize('entity')).toBe('entities');
    expect(defaultHelpers.singularize('users')).toBe('user');
    expect(defaultHelpers.singularize('entities')).toBe('entity');
  });

  it('should include code generation helpers', () => {
    const jsdoc = defaultHelpers.jsdoc('Test function', { param1: 'first param' });
    expect(jsdoc).toContain('/**');
    expect(jsdoc).toContain('Test function');
    expect(jsdoc).toContain('@param param1');
  });
});
