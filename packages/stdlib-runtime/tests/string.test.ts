import { describe, test, expect } from 'vitest';
import * as String from '../src/string';

describe('String Module', () => {
  describe('Length Operations', () => {
    test('length returns correct length', () => {
      expect(String.length('hello')).toBe(5);
      expect(String.length('')).toBe(0);
      expect(String.length('unicode: \u{1F600}')).toBe(11);
    });

    test('isEmpty checks empty strings', () => {
      expect(String.isEmpty('')).toBe(true);
      expect(String.isEmpty('hello')).toBe(false);
      expect(String.isEmpty(' ')).toBe(false);
    });

    test('isBlank checks whitespace-only strings', () => {
      expect(String.isBlank('')).toBe(true);
      expect(String.isBlank('   ')).toBe(true);
      expect(String.isBlank('\t\n')).toBe(true);
      expect(String.isBlank('hello')).toBe(false);
    });
  });

  describe('Case Operations', () => {
    test('toLowerCase converts to lowercase', () => {
      expect(String.toLowerCase('HELLO')).toBe('hello');
      expect(String.toLowerCase('HeLLo WoRLd')).toBe('hello world');
    });

    test('toUpperCase converts to uppercase', () => {
      expect(String.toUpperCase('hello')).toBe('HELLO');
      expect(String.toUpperCase('Hello World')).toBe('HELLO WORLD');
    });

    test('toTitleCase converts to title case', () => {
      expect(String.toTitleCase('hello world')).toBe('Hello World');
      expect(String.toTitleCase('HELLO WORLD')).toBe('Hello World');
    });

    test('toCamelCase converts to camelCase', () => {
      expect(String.toCamelCase('hello world')).toBe('helloWorld');
      expect(String.toCamelCase('hello-world')).toBe('helloWorld');
      expect(String.toCamelCase('hello_world')).toBe('helloWorld');
    });

    test('toSnakeCase converts to snake_case', () => {
      expect(String.toSnakeCase('helloWorld')).toBe('hello_world');
      expect(String.toSnakeCase('HelloWorld')).toBe('hello_world');
    });

    test('toKebabCase converts to kebab-case', () => {
      expect(String.toKebabCase('helloWorld')).toBe('hello-world');
      expect(String.toKebabCase('HelloWorld')).toBe('hello-world');
    });
  });

  describe('Trim Operations', () => {
    test('trim removes whitespace from both ends', () => {
      expect(String.trim('  hello  ')).toBe('hello');
      expect(String.trim('\t\nhello\n\t')).toBe('hello');
    });

    test('trimStart removes whitespace from start', () => {
      expect(String.trimStart('  hello  ')).toBe('hello  ');
    });

    test('trimEnd removes whitespace from end', () => {
      expect(String.trimEnd('  hello  ')).toBe('  hello');
    });

    test('trimChars removes specific characters', () => {
      expect(String.trimChars('---hello---', '-')).toBe('hello');
      expect(String.trimChars('xxhelloxx', 'x')).toBe('hello');
    });
  });

  describe('Search Operations', () => {
    test('contains checks substring existence', () => {
      expect(String.contains('hello world', 'world')).toBe(true);
      expect(String.contains('hello world', 'foo')).toBe(false);
      expect(String.contains('Hello World', 'world', false)).toBe(true);
    });

    test('startsWith checks prefix', () => {
      expect(String.startsWith('hello world', 'hello')).toBe(true);
      expect(String.startsWith('hello world', 'world')).toBe(false);
    });

    test('endsWith checks suffix', () => {
      expect(String.endsWith('hello world', 'world')).toBe(true);
      expect(String.endsWith('hello world', 'hello')).toBe(false);
    });

    test('indexOf finds first occurrence', () => {
      expect(String.indexOf('hello world', 'o')).toBe(4);
      expect(String.indexOf('hello world', 'o', 5)).toBe(7);
      expect(String.indexOf('hello world', 'x')).toBe(-1);
    });

    test('lastIndexOf finds last occurrence', () => {
      expect(String.lastIndexOf('hello world', 'o')).toBe(7);
      expect(String.lastIndexOf('hello world', 'x')).toBe(-1);
    });
  });

  describe('Manipulation Operations', () => {
    test('substring extracts portion', () => {
      expect(String.substring('hello', 0, 2)).toBe('he');
      expect(String.substring('hello', 2)).toBe('llo');
    });

    test('replace replaces first occurrence', () => {
      expect(String.replace('hello hello', 'hello', 'hi')).toBe('hi hello');
    });

    test('replaceAll replaces all occurrences', () => {
      expect(String.replaceAll('hello hello', 'hello', 'hi')).toBe('hi hi');
    });

    test('split splits string', () => {
      const result = String.split('a,b,c', ',');
      expect(result.parts).toEqual(['a', 'b', 'c']);
      expect(result.count).toBe(3);
    });

    test('join joins strings', () => {
      expect(String.join(['a', 'b', 'c'], ',')).toBe('a,b,c');
      expect(String.join(['a', 'b', 'c'])).toBe('abc');
    });

    test('repeat repeats string', () => {
      expect(String.repeat('ab', 3)).toBe('ababab');
      expect(String.repeat('x', 0)).toBe('');
    });

    test('padStart pads at start', () => {
      expect(String.padStart('5', 3, '0')).toBe('005');
    });

    test('padEnd pads at end', () => {
      expect(String.padEnd('5', 3, '0')).toBe('500');
    });

    test('reverse reverses string', () => {
      expect(String.reverse('hello')).toBe('olleh');
    });
  });

  describe('Validation Operations', () => {
    test('isValidEmail validates email format', () => {
      expect(String.isValidEmail('user@example.com')).toBe(true);
      expect(String.isValidEmail('invalid')).toBe(false);
      expect(String.isValidEmail('user@')).toBe(false);
    });

    test('isValidUrl validates URL format', () => {
      expect(String.isValidUrl('https://example.com')).toBe(true);
      expect(String.isValidUrl('http://example.com')).toBe(true);
      expect(String.isValidUrl('invalid')).toBe(false);
    });

    test('isValidPhone validates E.164 format', () => {
      expect(String.isValidPhone('+14155551234')).toBe(true);
      expect(String.isValidPhone('14155551234')).toBe(false);
    });

    test('isAlpha checks letters only', () => {
      expect(String.isAlpha('hello')).toBe(true);
      expect(String.isAlpha('hello123')).toBe(false);
    });

    test('isNumeric checks digits only', () => {
      expect(String.isNumeric('12345')).toBe(true);
      expect(String.isNumeric('12.45')).toBe(false);
    });

    test('isHexadecimal checks hex format', () => {
      expect(String.isHexadecimal('deadbeef')).toBe(true);
      expect(String.isHexadecimal('DEADBEEF')).toBe(true);
      expect(String.isHexadecimal('xyz')).toBe(false);
    });
  });
});
