/**
 * ISL Diagnostics
 * 
 * Provides error and warning diagnostics for ISL files.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { 
  type ParseResult, 
  type Symbol,
  type Position,
  type Range,
  BUILTIN_TYPES,
} from './parser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticRule {
  id: string;
  name: string;
  severity: DiagnosticSeverity;
  check: (parseResult: ParseResult, text: string) => Diagnostic[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic Rules
// ─────────────────────────────────────────────────────────────────────────────

const rules: DiagnosticRule[] = [
  // Parse errors
  {
    id: 'ISL001',
    name: 'Parse Error',
    severity: DiagnosticSeverity.Error,
    check: (result) => {
      return result.errors.map(error => ({
        severity: error.severity === 'error' ? DiagnosticSeverity.Error :
                  error.severity === 'warning' ? DiagnosticSeverity.Warning :
                  error.severity === 'info' ? DiagnosticSeverity.Information :
                  DiagnosticSeverity.Hint,
        range: error.range,
        message: error.message,
        source: 'isl',
        code: 'ISL001',
      }));
    },
  },

  // Empty entities
  {
    id: 'ISL002',
    name: 'Empty Entity',
    severity: DiagnosticSeverity.Warning,
    check: (result) => {
      const diagnostics: Diagnostic[] = [];
      
      for (const symbol of result.symbols) {
        if (symbol.kind === 'domain' && symbol.children) {
          for (const child of symbol.children) {
            if (child.kind === 'entity' && (!child.children || child.children.length === 0)) {
              diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: child.selectionRange,
                message: `Entity '${child.name}' has no fields`,
                source: 'isl',
                code: 'ISL002',
              });
            }
          }
        }
      }
      
      return diagnostics;
    },
  },

  // Empty behaviors
  {
    id: 'ISL003',
    name: 'Empty Behavior',
    severity: DiagnosticSeverity.Warning,
    check: (result) => {
      const diagnostics: Diagnostic[] = [];
      
      for (const symbol of result.symbols) {
        if (symbol.kind === 'domain' && symbol.children) {
          for (const child of symbol.children) {
            if (child.kind === 'behavior' && (!child.children || child.children.length === 0)) {
              diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: child.selectionRange,
                message: `Behavior '${child.name}' has no input/output`,
                source: 'isl',
                code: 'ISL003',
              });
            }
          }
        }
      }
      
      return diagnostics;
    },
  },

  // Missing domain
  {
    id: 'ISL004',
    name: 'Missing Domain',
    severity: DiagnosticSeverity.Error,
    check: (result, text) => {
      const hasDomain = result.symbols.some(s => s.kind === 'domain');
      if (!hasDomain && text.trim().length > 0) {
        return [{
          severity: DiagnosticSeverity.Error,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          message: 'ISL file must contain a domain definition',
          source: 'isl',
          code: 'ISL004',
        }];
      }
      return [];
    },
  },

  // Unresolved type references
  {
    id: 'ISL005',
    name: 'Unresolved Type',
    severity: DiagnosticSeverity.Error,
    check: (result) => {
      const diagnostics: Diagnostic[] = [];
      
      // Collect all defined types
      const definedTypes = new Set<string>(BUILTIN_TYPES);
      
      for (const symbol of result.symbols) {
        if (symbol.kind === 'domain' && symbol.children) {
          for (const child of symbol.children) {
            if (child.kind === 'entity' || child.kind === 'type' || child.kind === 'enum') {
              definedTypes.add(child.name);
            }
          }
        }
      }
      
      // Check references
      for (const ref of result.references) {
        if (!definedTypes.has(ref.name)) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: ref.range,
            message: `Unknown type '${ref.name}'`,
            source: 'isl',
            code: 'ISL005',
          });
        }
      }
      
      return diagnostics;
    },
  },

  // Naming conventions
  {
    id: 'ISL006',
    name: 'Naming Convention',
    severity: DiagnosticSeverity.Information,
    check: (result) => {
      const diagnostics: Diagnostic[] = [];
      
      for (const symbol of result.symbols) {
        // Domains, entities, behaviors, types, enums should be PascalCase
        if (['domain', 'entity', 'behavior', 'type', 'enum'].includes(symbol.kind)) {
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(symbol.name)) {
            diagnostics.push({
              severity: DiagnosticSeverity.Information,
              range: symbol.selectionRange,
              message: `${symbol.kind} names should be PascalCase`,
              source: 'isl',
              code: 'ISL006',
            });
          }
        }
        
        // Check children
        if (symbol.children) {
          for (const child of symbol.children) {
            // Fields should be snake_case or camelCase
            if (child.kind === 'field') {
              if (/^[A-Z]/.test(child.name)) {
                diagnostics.push({
                  severity: DiagnosticSeverity.Information,
                  range: child.selectionRange,
                  message: 'Field names should start with lowercase',
                  source: 'isl',
                  code: 'ISL006',
                });
              }
            }
          }
        }
      }
      
      return diagnostics;
    },
  },

  // Duplicate names
  {
    id: 'ISL007',
    name: 'Duplicate Name',
    severity: DiagnosticSeverity.Error,
    check: (result) => {
      const diagnostics: Diagnostic[] = [];
      
      for (const symbol of result.symbols) {
        if (symbol.kind === 'domain' && symbol.children) {
          const names = new Map<string, Symbol>();
          
          for (const child of symbol.children) {
            const existing = names.get(child.name);
            if (existing) {
              diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: child.selectionRange,
                message: `Duplicate ${child.kind} name '${child.name}'`,
                source: 'isl',
                code: 'ISL007',
              });
            } else {
              names.set(child.name, child);
            }
          }
          
          // Check for duplicate fields within entities
          for (const child of symbol.children) {
            if (child.kind === 'entity' && child.children) {
              const fieldNames = new Set<string>();
              
              for (const field of child.children) {
                if (fieldNames.has(field.name)) {
                  diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: field.selectionRange,
                    message: `Duplicate field '${field.name}' in entity '${child.name}'`,
                    source: 'isl',
                    code: 'ISL007',
                  });
                } else {
                  fieldNames.add(field.name);
                }
              }
            }
          }
        }
      }
      
      return diagnostics;
    },
  },

  // Missing version
  {
    id: 'ISL008',
    name: 'Missing Version',
    severity: DiagnosticSeverity.Information,
    check: (result, text) => {
      const diagnostics: Diagnostic[] = [];
      
      for (const symbol of result.symbols) {
        if (symbol.kind === 'domain' && !symbol.detail) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: symbol.selectionRange,
            message: 'Domain should have a version',
            source: 'isl',
            code: 'ISL008',
          });
        }
      }
      
      return diagnostics;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Diagnostic Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all diagnostics for parsed ISL
 */
export function getDiagnostics(parseResult: ParseResult, text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  for (const rule of rules) {
    diagnostics.push(...rule.check(parseResult, text));
  }
  
  return diagnostics;
}

/**
 * Get available diagnostic rules
 */
export function getRules(): DiagnosticRule[] {
  return [...rules];
}
