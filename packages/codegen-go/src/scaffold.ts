// ============================================================================
// Go Module Scaffold Generator
// Generates go.mod and supporting files for a compilable Go project
// ============================================================================

import type { Domain } from './ast-types.js';
import { toSnakeCase } from './types.js';

export interface ScaffoldFile {
  path: string;
  content: string;
}

/**
 * Generate go.mod file
 */
export function generateGoMod(modulePath: string): ScaffoldFile {
  const content = [
    `module ${modulePath}`,
    '',
    'go 1.21',
    '',
    'require (',
    '\tgithub.com/go-playground/validator/v10 v10.16.0',
    '\tgithub.com/google/uuid v1.5.0',
    '\tgithub.com/shopspring/decimal v1.3.1',
    ')',
    '',
    'require (',
    '\tgithub.com/gabriel-vasile/mimetype v1.4.3 // indirect',
    '\tgithub.com/go-playground/locales v0.14.1 // indirect',
    '\tgithub.com/go-playground/universal-translator v0.18.1 // indirect',
    '\tgithub.com/leodido/go-urn v1.2.4 // indirect',
    '\tgolang.org/x/crypto v0.17.0 // indirect',
    '\tgolang.org/x/net v0.19.0 // indirect',
    '\tgolang.org/x/sys v0.15.0 // indirect',
    '\tgolang.org/x/text v0.14.0 // indirect',
    ')',
    '',
  ].join('\n');

  return { path: 'go.mod', content };
}

/**
 * Generate go.sum placeholder (will be populated by `go mod tidy`)
 */
export function generateGoSum(): ScaffoldFile {
  return {
    path: 'go.sum',
    content: '// Run `go mod tidy` to populate this file.\n',
  };
}

/**
 * Generate doc.go package documentation file
 */
export function generateDocGo(domain: Domain, packageName: string): ScaffoldFile {
  const lines: string[] = [];
  lines.push(`// Package ${packageName} provides generated types, interfaces, and handlers`);
  lines.push(`// for the ${domain.name.name} domain (v${domain.version.value}).`);
  lines.push(`//`);
  lines.push(`// This code was generated from ISL (Intent Specification Language).`);
  lines.push(`// DO NOT EDIT.`);
  lines.push(`package ${packageName}`);
  lines.push('');
  return {
    path: `${packageName}/doc.go`,
    content: lines.join('\n'),
  };
}

/**
 * Generate all scaffold files for a compilable Go module
 */
export function generateScaffold(
  domain: Domain,
  modulePath: string,
): ScaffoldFile[] {
  const packageName = toSnakeCase(domain.name.name).toLowerCase();
  const files: ScaffoldFile[] = [];

  files.push(generateGoMod(modulePath));
  files.push(generateDocGo(domain, packageName));

  return files;
}
