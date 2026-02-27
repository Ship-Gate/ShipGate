import { describe, it, expect } from 'vitest';
import { parseImports, isRelativeImport, isNodeBuiltin } from '../src/parser.js';

describe('Import Parser', () => {
  it('should parse named imports', () => {
    const source = `import { debounce, throttle } from 'lodash';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(imports[0]?.specifier).toBe('lodash');
    expect(imports[0]?.symbols).toEqual(['debounce', 'throttle']);
  });

  it('should parse default imports', () => {
    const source = `import express from 'express';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(imports[0]?.specifier).toBe('express');
    expect(imports[0]?.symbols).toEqual(['express']);
  });

  it('should parse type-only imports', () => {
    const source = `import type { User } from './types';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(imports[0]?.isTypeOnly).toBe(true);
  });

  it('should parse relative imports', () => {
    const source = `import { something } from './utils';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(isRelativeImport(imports[0]!.specifier)).toBe(true);
  });

  it('should identify Node.js built-ins', () => {
    expect(isNodeBuiltin('fs')).toBe(true);
    expect(isNodeBuiltin('path')).toBe(true);
    expect(isNodeBuiltin('lodash')).toBe(false);
  });

  it('should parse multiple imports', () => {
    const source = `
      import { a } from 'package-a';
      import b from 'package-b';
      import { c } from './local';
    `;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(3);
  });

  it('should parse list with extra spaces and trailing comma', () => {
    const source = `import { debounce , throttle , } from 'lodash';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(imports[0]?.symbols).toEqual(['debounce', 'throttle']);
  });

  it('should parse aliased symbols and use final name', () => {
    const source = `import { debounce as deb, throttle as th } from 'lodash';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(imports[0]?.symbols).toEqual(['deb', 'th']);
  });

  it('should parse single named import', () => {
    const source = `import { debounce } from 'lodash';`;
    const imports = parseImports(source, 'test.ts');

    expect(imports.length).toBe(1);
    expect(imports[0]?.symbols).toEqual(['debounce']);
  });
});
