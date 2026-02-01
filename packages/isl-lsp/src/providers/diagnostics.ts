/**
 * Diagnostic Provider
 * 
 * Provides error and warning diagnostics for ISL documents.
 */

import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService, type ParseError } from '../services/language-service.js';

// ============================================================================
// Diagnostic Codes
// ============================================================================

export const DiagnosticCodes = {
  // Syntax errors (ISL0xx)
  PARSE_ERROR: 'ISL001',
  UNEXPECTED_TOKEN: 'ISL002',
  UNCLOSED_BRACE: 'ISL003',
  INVALID_SYNTAX: 'ISL004',

  // Type errors (ISL1xx)
  UNKNOWN_TYPE: 'ISL101',
  TYPE_MISMATCH: 'ISL102',
  UNDEFINED_REFERENCE: 'ISL103',
  DUPLICATE_DEFINITION: 'ISL104',

  // Semantic errors (ISL2xx)
  MISSING_REQUIRED_FIELD: 'ISL201',
  INVALID_CONSTRAINT: 'ISL202',
  CIRCULAR_REFERENCE: 'ISL203',
  INCOMPATIBLE_CONSTRAINT: 'ISL204',

  // Warnings (ISL3xx)
  UNUSED_TYPE: 'ISL301',
  DEPRECATED_SYNTAX: 'ISL302',
  MISSING_DESCRIPTION: 'ISL303',
  IMPLICIT_ANY: 'ISL304',

  // Hints (ISL4xx)
  CONSIDER_ADDING: 'ISL401',
  NAMING_CONVENTION: 'ISL402',
} as const;

// ============================================================================
// Diagnostic Provider
// ============================================================================

export class DiagnosticProvider {
  private languageService: ISLLanguageService;

  constructor(languageService: ISLLanguageService) {
    this.languageService = languageService;
  }

  /**
   * Validate a document and return diagnostics
   */
  validateDocument(document: TextDocument): Diagnostic[] {
    const content = document.getText();
    const diagnostics: Diagnostic[] = [];

    // Update the document in the language service
    const parsed = this.languageService.updateDocument(document.uri, content);

    // Add parse errors
    for (const error of parsed.errors) {
      diagnostics.push(this.parseErrorToDiagnostic(error));
    }

    // Run semantic validation
    if (parsed.ast) {
      diagnostics.push(...this.validateSemantics(parsed.ast, content));
    }

    // Run style checks
    diagnostics.push(...this.validateStyle(content));

    return diagnostics;
  }

  /**
   * Convert parse error to diagnostic
   */
  private parseErrorToDiagnostic(error: ParseError): Diagnostic {
    return {
      severity: this.severityToLSP(error.severity),
      range: error.range,
      message: error.message,
      code: error.code,
      source: 'isl',
    };
  }

  /**
   * Validate semantic rules
   */
  private validateSemantics(ast: any, content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split('\n');

    // Collect all defined types
    const definedTypes = new Set<string>([
      'String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp', 'Duration',
      'List', 'Map', 'Set', 'Optional',
    ]);

    for (const type of ast.types || []) {
      definedTypes.add(type.name);
    }
    for (const enumNode of ast.enums || []) {
      definedTypes.add(enumNode.name);
    }
    for (const entity of ast.entities || []) {
      definedTypes.add(entity.name);
    }

    // Check for undefined type references
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      
      // Match type annotations like `: TypeName` or `<TypeName>`
      const typeRefs = line.matchAll(/:\s*(\w+)|<(\w+)>/g);
      
      for (const match of typeRefs) {
        const typeName = match[1] || match[2];
        if (typeName && !definedTypes.has(typeName)) {
          const startCol = line.indexOf(typeName);
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: this.createRange(i, startCol, i, startCol + typeName.length),
            message: `Unknown type '${typeName}'`,
            code: DiagnosticCodes.UNKNOWN_TYPE,
            source: 'isl',
          });
        }
      }
    }

    // Check for duplicate definitions
    const definedNames = new Map<string, { line: number; kind: string }>();
    
    for (const entity of ast.entities || []) {
      this.checkDuplicate(entity.name, 'entity', entity.range.start.line, definedNames, diagnostics);
    }
    for (const type of ast.types || []) {
      this.checkDuplicate(type.name, 'type', type.range.start.line, definedNames, diagnostics);
    }
    for (const enumNode of ast.enums || []) {
      this.checkDuplicate(enumNode.name, 'enum', enumNode.range.start.line, definedNames, diagnostics);
    }
    for (const behavior of ast.behaviors || []) {
      this.checkDuplicate(behavior.name, 'behavior', behavior.range.start.line, definedNames, diagnostics);
    }

    // Check entities have required fields
    for (const entity of ast.entities || []) {
      const hasId = entity.fields?.some((f: any) => f.name === 'id');
      if (!hasId) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: entity.range,
          message: `Entity '${entity.name}' should have an 'id' field`,
          code: DiagnosticCodes.MISSING_REQUIRED_FIELD,
          source: 'isl',
        });
      }
    }

    // Check behaviors have input or output
    for (const behavior of ast.behaviors || []) {
      const hasInput = behavior.fields?.some((f: any) => f.name === 'input');
      const hasOutput = behavior.fields?.some((f: any) => f.name === 'output');
      
      if (!hasInput && !hasOutput) {
        diagnostics.push({
          severity: DiagnosticSeverity.Information,
          range: behavior.range,
          message: `Behavior '${behavior.name}' should define input or output`,
          code: DiagnosticCodes.CONSIDER_ADDING,
          source: 'isl',
        });
      }
    }

    return diagnostics;
  }

  /**
   * Validate style and conventions
   */
  private validateStyle(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';

      // Check entity naming (PascalCase)
      const entityMatch = line.match(/entity\s+(\w+)/);
      if (entityMatch && entityMatch[1]) {
        const name = entityMatch[1];
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
          diagnostics.push({
            severity: DiagnosticSeverity.Hint,
            range: this.createRange(i, line.indexOf(name), i, line.indexOf(name) + name.length),
            message: `Entity name '${name}' should use PascalCase`,
            code: DiagnosticCodes.NAMING_CONVENTION,
            source: 'isl',
          });
        }
      }

      // Check field naming (snake_case or camelCase)
      const fieldMatch = line.match(/^\s+(\w+)\s*:/);
      if (fieldMatch && fieldMatch[1]) {
        const name = fieldMatch[1];
        if (!/^[a-z][a-z0-9_]*$/.test(name) && !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
          diagnostics.push({
            severity: DiagnosticSeverity.Hint,
            range: this.createRange(i, line.indexOf(name), i, line.indexOf(name) + name.length),
            message: `Field name '${name}' should use snake_case or camelCase`,
            code: DiagnosticCodes.NAMING_CONVENTION,
            source: 'isl',
          });
        }
      }

      // Check for missing description on behaviors
      const behaviorMatch = line.match(/behavior\s+(\w+)/);
      if (behaviorMatch) {
        // Look ahead for description
        let hasDescription = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j]?.includes('description:')) {
            hasDescription = true;
            break;
          }
          if (lines[j]?.includes('}')) break;
        }
        
        if (!hasDescription) {
          diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: this.createRange(i, 0, i, line.length),
            message: `Behavior '${behaviorMatch[1]}' should have a description`,
            code: DiagnosticCodes.MISSING_DESCRIPTION,
            source: 'isl',
          });
        }
      }
    }

    return diagnostics;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private severityToLSP(severity: string): DiagnosticSeverity {
    switch (severity) {
      case 'error': return DiagnosticSeverity.Error;
      case 'warning': return DiagnosticSeverity.Warning;
      case 'info': return DiagnosticSeverity.Information;
      case 'hint': return DiagnosticSeverity.Hint;
      default: return DiagnosticSeverity.Error;
    }
  }

  private createRange(startLine: number, startChar: number, endLine: number, endChar: number): Range {
    return {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    };
  }

  private checkDuplicate(
    name: string,
    kind: string,
    line: number,
    definedNames: Map<string, { line: number; kind: string }>,
    diagnostics: Diagnostic[]
  ): void {
    if (definedNames.has(name)) {
      const existing = definedNames.get(name)!;
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: this.createRange(line, 0, line, name.length + 10),
        message: `Duplicate definition: '${name}' already defined as ${existing.kind} on line ${existing.line + 1}`,
        code: DiagnosticCodes.DUPLICATE_DEFINITION,
        source: 'isl',
      });
    } else {
      definedNames.set(name, { line, kind });
    }
  }
}
