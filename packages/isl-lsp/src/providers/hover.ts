/**
 * Hover Provider
 * 
 * Provides hover information for ISL documents.
 */

import { Hover, MarkupKind, Position } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService } from '../services/language-service.js';

// ============================================================================
// Hover Provider
// ============================================================================

export class HoverProvider {
  private languageService: ISLLanguageService;

  constructor(languageService: ISLLanguageService) {
    this.languageService = languageService;
  }

  /**
   * Provide hover information
   */
  provideHover(document: TextDocument, position: Position): Hover | null {
    const content = document.getText();
    const word = this.languageService.getWordAtPosition(content, position);
    
    if (!word) return null;

    // Check for keyword
    const keywordHover = this.getKeywordHover(word);
    if (keywordHover) return keywordHover;

    // Check for built-in type
    const typeHover = this.getBuiltInTypeHover(word);
    if (typeHover) return typeHover;

    // Check for symbol in document
    const symbolHover = this.getSymbolHover(document.uri, word);
    if (symbolHover) return symbolHover;

    return null;
  }

  /**
   * Get hover for ISL keywords
   */
  private getKeywordHover(word: string): Hover | null {
    const keywords: Record<string, string> = {
      'domain': '**domain**\n\nDefines an ISL domain - a namespace for related entities, types, and behaviors.\n\n```isl\ndomain Auth {\n  version: "1.0.0"\n  // entities, types, behaviors...\n}\n```',
      
      'entity': '**entity**\n\nDefines a domain entity with fields and invariants.\n\n```isl\nentity User {\n  id: UUID [immutable, unique]\n  email: Email [unique]\n  created_at: Timestamp [immutable]\n}\n```',
      
      'type': '**type**\n\nDefines a constrained type alias.\n\n```isl\ntype Email = String {\n  format: /^[^@]+@[^@]+$/\n  max_length: 254\n}\n```',
      
      'enum': '**enum**\n\nDefines an enumeration type.\n\n```isl\nenum Status {\n  ACTIVE\n  INACTIVE\n  SUSPENDED\n}\n```',
      
      'behavior': '**behavior**\n\nDefines a domain behavior with input, output, and contracts.\n\n```isl\nbehavior Login {\n  input { email: Email, password: Password }\n  output { success: Session }\n  preconditions { ... }\n  postconditions { ... }\n}\n```',
      
      'input': '**input**\n\nDefines the input parameters for a behavior.',
      
      'output': '**output**\n\nDefines the output and possible errors for a behavior.',
      
      'preconditions': '**preconditions**\n\nConditions that must be true before a behavior executes.',
      
      'postconditions': '**postconditions**\n\nConditions that must be true after a behavior executes.',
      
      'invariants': '**invariants**\n\nConditions that must always be true.',
      
      'temporal': '**temporal**\n\nDefines timing and ordering constraints.\n\n```isl\ntemporal {\n  response within 200.ms (p50)\n  eventually within 5.seconds: audit_log_created\n}\n```',
      
      'security': '**security**\n\nDefines security requirements and constraints.\n\n```isl\nsecurity {\n  requires authentication\n  rate_limit 10/minute per user_id\n}\n```',
      
      'lifecycle': '**lifecycle**\n\nDefines state transitions for an entity.\n\n```isl\nlifecycle {\n  PENDING -> ACTIVE\n  ACTIVE -> SUSPENDED\n  SUSPENDED -> ACTIVE\n}\n```',
      
      'implies': '**implies**\n\nLogical implication in postconditions.\n\n```isl\nsuccess implies {\n  User.exists(result.id)\n}\n```',
      
      'old': '**old(expr)**\n\nReferences the value of an expression before the behavior executed.',
      
      'result': '**result**\n\nReferences the return value of a behavior.',
    };

    const doc = keywords[word.toLowerCase()];
    if (!doc) return null;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: doc,
      },
    };
  }

  /**
   * Get hover for built-in types
   */
  private getBuiltInTypeHover(word: string): Hover | null {
    const types: Record<string, string> = {
      'String': '**String**\n\nUnicode text value.\n\nConstraints:\n- `min_length`: Minimum character count\n- `max_length`: Maximum character count\n- `format` / `pattern`: Regex pattern\n\n```isl\ntype Username = String {\n  min_length: 3\n  max_length: 32\n  pattern: /^[a-z0-9_]+$/\n}\n```',
      
      'Int': '**Int**\n\n64-bit signed integer.\n\nConstraints:\n- `min`: Minimum value\n- `max`: Maximum value\n\n```isl\ntype Age = Int {\n  min: 0\n  max: 150\n}\n```',
      
      'Decimal': '**Decimal**\n\nArbitrary precision decimal number.\n\nConstraints:\n- `min`: Minimum value\n- `max`: Maximum value\n- `precision`: Decimal places\n\n```isl\ntype Money = Decimal {\n  precision: 2\n  min: 0\n}\n```',
      
      'Boolean': '**Boolean**\n\nTrue or false value.',
      
      'UUID': '**UUID**\n\nUniversally unique identifier (version 4).\n\nTypically used for entity IDs:\n\n```isl\nentity User {\n  id: UUID [immutable, unique]\n}\n```',
      
      'Timestamp': '**Timestamp**\n\nISO 8601 date-time with timezone.\n\n```isl\nentity Event {\n  created_at: Timestamp [immutable]\n  updated_at: Timestamp\n}\n```',
      
      'Duration': '**Duration**\n\nTime duration value.\n\nUnits: `ms`, `seconds`, `minutes`, `hours`, `days`\n\n```isl\ntemporal {\n  response within 200.ms\n  timeout: 30.seconds\n}\n```',
      
      'List': '**List<T>**\n\nOrdered collection of elements.\n\n```isl\nentity Order {\n  items: List<OrderItem>\n}\n```',
      
      'Map': '**Map<K, V>**\n\nKey-value mapping.\n\n```isl\ntype Metadata = Map<String, String>\n```',
      
      'Set': '**Set<T>**\n\nUnordered collection of unique elements.',
    };

    const doc = types[word];
    if (!doc) return null;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: doc,
      },
    };
  }

  /**
   * Get hover for symbols defined in the document
   */
  private getSymbolHover(uri: string, word: string): Hover | null {
    const doc = this.languageService.getDocument(uri);
    if (!doc?.ast) return null;

    // Search entities
    for (const entity of doc.ast.entities) {
      if (entity.name === word) {
        const fields = entity.fields?.map((f: any) => `  ${f.name}: ${f.type}${f.optional ? '?' : ''}`).join('\n') || '';
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: `**Entity: ${entity.name}**\n\n\`\`\`isl\nentity ${entity.name} {\n${fields}\n}\n\`\`\``,
          },
        };
      }

      // Search fields
      for (const field of entity.fields || []) {
        if (field.name === word) {
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `**Field: ${field.name}**\n\nType: \`${field.type}\`${field.optional ? ' (optional)' : ''}\n\nDefined in entity \`${entity.name}\``,
            },
          };
        }
      }
    }

    // Search types
    for (const type of doc.ast.types) {
      if (type.name === word) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: `**Type: ${type.name}**\n\nCustom type definition`,
          },
        };
      }
    }

    // Search enums
    for (const enumNode of doc.ast.enums) {
      if (enumNode.name === word) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: `**Enum: ${enumNode.name}**\n\nEnumeration type`,
          },
        };
      }
    }

    // Search behaviors
    for (const behavior of doc.ast.behaviors) {
      if (behavior.name === word) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: `**Behavior: ${behavior.name}**\n\nDomain behavior`,
          },
        };
      }
    }

    return null;
  }
}
