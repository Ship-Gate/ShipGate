/**
 * Completion Provider
 * 
 * Provides auto-completion suggestions for ISL documents.
 */

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Position,
  MarkupKind,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService } from '../services/language-service.js';

// ============================================================================
// Completion Provider
// ============================================================================

export class CompletionProvider {
  private languageService: ISLLanguageService;

  constructor(languageService: ISLLanguageService) {
    this.languageService = languageService;
  }

  /**
   * Provide completion items
   */
  provideCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const content = document.getText();
    const offset = document.offsetAt(position);
    const textBefore = content.substring(0, offset);
    const lineText = this.getLineText(content, position);
    const wordBefore = this.getWordBefore(textBefore);

    const completions: CompletionItem[] = [];

    // Determine context
    const context = this.determineContext(textBefore, lineText);

    switch (context) {
      case 'top-level':
        completions.push(...this.getTopLevelCompletions());
        break;
      case 'entity-body':
        completions.push(...this.getEntityBodyCompletions());
        break;
      case 'behavior-body':
        completions.push(...this.getBehaviorBodyCompletions());
        break;
      case 'type-annotation':
        completions.push(...this.getTypeCompletions(document));
        break;
      case 'constraint':
        completions.push(...this.getConstraintCompletions());
        break;
      case 'annotation':
        completions.push(...this.getAnnotationCompletions());
        break;
      default:
        completions.push(...this.getKeywordCompletions());
    }

    return completions;
  }

  /**
   * Resolve completion item with additional details
   */
  resolveCompletion(item: CompletionItem): CompletionItem {
    // Add documentation for built-in types
    if (item.data?.type === 'builtin-type') {
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: this.getTypeDocumentation(item.label as string),
      };
    }
    return item;
  }

  // ============================================================================
  // Context Detection
  // ============================================================================

  private determineContext(textBefore: string, lineText: string): string {
    // Check for annotation context
    if (lineText.trim().startsWith('@') || textBefore.endsWith('@')) {
      return 'annotation';
    }

    // Check for type annotation
    if (textBefore.match(/:\s*$/) || lineText.match(/:\s*\w*$/)) {
      return 'type-annotation';
    }

    // Check for constraint block
    if (textBefore.match(/{\s*$/m) && textBefore.match(/type\s+\w+\s*=\s*\w+\s*{\s*$/m)) {
      return 'constraint';
    }

    // Check if inside entity
    const entityMatch = textBefore.match(/entity\s+\w+\s*{[^}]*$/);
    if (entityMatch) {
      return 'entity-body';
    }

    // Check if inside behavior
    const behaviorMatch = textBefore.match(/behavior\s+\w+\s*{[^}]*$/);
    if (behaviorMatch) {
      return 'behavior-body';
    }

    // Check if at top level
    const braceCount = (textBefore.match(/{/g) || []).length - (textBefore.match(/}/g) || []).length;
    if (braceCount <= 1) {
      return 'top-level';
    }

    return 'unknown';
  }

  // ============================================================================
  // Completion Generators
  // ============================================================================

  private getTopLevelCompletions(): CompletionItem[] {
    return [
      this.createSnippet('domain', 'domain ${1:DomainName} {\n\tversion: "${2:1.0.0}"\n\t$0\n}', 'Define a new domain'),
      this.createSnippet('entity', 'entity ${1:EntityName} {\n\t${2:id}: UUID [immutable, unique]\n\t$0\n}', 'Define a new entity'),
      this.createSnippet('type', 'type ${1:TypeName} = ${2:String} {\n\t$0\n}', 'Define a constrained type'),
      this.createSnippet('enum', 'enum ${1:EnumName} {\n\t${2:VALUE1}\n\t${3:VALUE2}\n}', 'Define an enumeration'),
      this.createSnippet('behavior', 'behavior ${1:BehaviorName} {\n\tdescription: "${2:Description}"\n\t\n\tinput {\n\t\t$0\n\t}\n\t\n\toutput {\n\t\tsuccess: ${3:ResultType}\n\t}\n}', 'Define a behavior'),
      this.createSnippet('invariants', 'invariants ${1:InvariantName} {\n\tdescription: "${2:Description}"\n\tscope: ${3|global,transaction|}\n\t\n\talways {\n\t\t$0\n\t}\n}', 'Define invariants'),
      this.createSnippet('view', 'view ${1:ViewName} {\n\tfor: ${2:EntityName}\n\t\n\tfields {\n\t\t$0\n\t}\n}', 'Define a view'),
      this.createSnippet('policy', 'policy ${1:PolicyName} {\n\tapplies_to: ${2|all behaviors,|}[\n\t\n\trules {\n\t\t$0\n\t}\n}', 'Define a policy'),
      this.createKeyword('imports', 'imports { }'),
    ];
  }

  private getEntityBodyCompletions(): CompletionItem[] {
    return [
      this.createSnippet('field', '${1:fieldName}: ${2:Type}', 'Add a field'),
      this.createSnippet('field-optional', '${1:fieldName}: ${2:Type}?', 'Add an optional field'),
      this.createSnippet('field-annotated', '${1:fieldName}: ${2:Type} [${3:annotation}]', 'Add an annotated field'),
      this.createSnippet('id-field', 'id: UUID [immutable, unique]', 'Add ID field'),
      this.createSnippet('timestamp-field', '${1:created_at}: Timestamp [immutable]', 'Add timestamp field'),
      this.createSnippet('invariants', 'invariants {\n\t$0\n}', 'Add entity invariants'),
      this.createSnippet('lifecycle', 'lifecycle {\n\t${1:STATE1} -> ${2:STATE2}\n\t$0\n}', 'Add lifecycle transitions'),
    ];
  }

  private getBehaviorBodyCompletions(): CompletionItem[] {
    return [
      this.createSnippet('description', 'description: "${1:Behavior description}"', 'Add description'),
      this.createSnippet('actors', 'actors {\n\t${1:User} { ${2:must: authenticated} }\n}', 'Define actors'),
      this.createSnippet('input', 'input {\n\t${1:field}: ${2:Type}\n}', 'Define input fields'),
      this.createSnippet('output', 'output {\n\tsuccess: ${1:ResultType}\n\t\n\terrors {\n\t\t${2:ERROR_CODE} {\n\t\t\twhen: "${3:Error description}"\n\t\t\tretriable: ${4|true,false|}\n\t\t}\n\t}\n}', 'Define output'),
      this.createSnippet('preconditions', 'preconditions {\n\t$0\n}', 'Add preconditions'),
      this.createSnippet('postconditions', 'postconditions {\n\tsuccess implies {\n\t\t$0\n\t}\n}', 'Add postconditions'),
      this.createSnippet('invariants', 'invariants {\n\t$0\n}', 'Add behavior invariants'),
      this.createSnippet('temporal', 'temporal {\n\tresponse within ${1:200}.ms (p${2:50})\n}', 'Add temporal constraints'),
      this.createSnippet('security', 'security {\n\trequires ${1:authentication}\n\trate_limit ${2:10}/minute per ${3:user_id}\n}', 'Add security rules'),
      this.createSnippet('compliance', 'compliance {\n\t${1:pci_dss} {\n\t\t$0\n\t}\n}', 'Add compliance requirements'),
    ];
  }

  private getTypeCompletions(document: TextDocument): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    // Built-in primitive types
    const primitives = ['String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp', 'Duration'];
    for (const type of primitives) {
      completions.push({
        label: type,
        kind: CompletionItemKind.TypeParameter,
        detail: 'Built-in type',
        data: { type: 'builtin-type' },
      });
    }

    // Generic types
    completions.push(
      this.createSnippet('List', 'List<${1:Type}>', 'List of items'),
      this.createSnippet('Map', 'Map<${1:KeyType}, ${2:ValueType}>', 'Map of key-value pairs'),
      this.createSnippet('Optional', '${1:Type}?', 'Optional type'),
    );

    // Get custom types from document
    const doc = this.languageService.getDocument(document.uri);
    if (doc?.ast) {
      for (const type of doc.ast.types) {
        completions.push({
          label: type.name,
          kind: CompletionItemKind.TypeParameter,
          detail: 'Custom type',
        });
      }
      for (const entity of doc.ast.entities) {
        completions.push({
          label: entity.name,
          kind: CompletionItemKind.Class,
          detail: 'Entity',
        });
      }
      for (const enumNode of doc.ast.enums) {
        completions.push({
          label: enumNode.name,
          kind: CompletionItemKind.Enum,
          detail: 'Enum',
        });
      }
    }

    return completions;
  }

  private getConstraintCompletions(): CompletionItem[] {
    return [
      this.createSnippet('min', 'min: ${1:0}', 'Minimum value'),
      this.createSnippet('max', 'max: ${1:100}', 'Maximum value'),
      this.createSnippet('min_length', 'min_length: ${1:1}', 'Minimum string length'),
      this.createSnippet('max_length', 'max_length: ${1:255}', 'Maximum string length'),
      this.createSnippet('pattern', 'pattern: /${1:regex}/', 'Regex pattern'),
      this.createSnippet('format', 'format: /${1:regex}/', 'Format regex'),
      this.createSnippet('precision', 'precision: ${1:2}', 'Decimal precision'),
    ];
  }

  private getAnnotationCompletions(): CompletionItem[] {
    return [
      this.createKeyword('immutable', 'immutable', 'Field cannot be changed'),
      this.createKeyword('unique', 'unique', 'Field must be unique'),
      this.createKeyword('indexed', 'indexed', 'Field should be indexed'),
      this.createKeyword('secret', 'secret', 'Field contains sensitive data'),
      this.createKeyword('pii', 'pii', 'Personally identifiable information'),
      this.createKeyword('computed', 'computed', 'Field is computed'),
      this.createKeyword('sensitive', 'sensitive', 'Sensitive data'),
      this.createSnippet('references', 'references: ${1:Entity}.${2:field}', 'Foreign key reference'),
    ];
  }

  private getKeywordCompletions(): CompletionItem[] {
    const keywords = [
      'domain', 'entity', 'type', 'enum', 'behavior', 'view', 'policy',
      'invariants', 'input', 'output', 'preconditions', 'postconditions',
      'success', 'errors', 'actors', 'temporal', 'security', 'compliance',
      'lifecycle', 'imports', 'from', 'as',
    ];

    return keywords.map(kw => this.createKeyword(kw, kw));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private createSnippet(label: string, snippet: string, detail?: string): CompletionItem {
    return {
      label,
      kind: CompletionItemKind.Snippet,
      insertText: snippet,
      insertTextFormat: InsertTextFormat.Snippet,
      detail,
    };
  }

  private createKeyword(label: string, insertText: string, detail?: string): CompletionItem {
    return {
      label,
      kind: CompletionItemKind.Keyword,
      insertText,
      detail,
    };
  }

  private getLineText(content: string, position: Position): string {
    const lines = content.split('\n');
    return lines[position.line] || '';
  }

  private getWordBefore(text: string): string {
    const match = text.match(/\w+$/);
    return match ? match[0] : '';
  }

  private getTypeDocumentation(typeName: string): string {
    const docs: Record<string, string> = {
      'String': '**String**\n\nUnicode text value.\n\n```isl\ntype Email = String {\n  format: /^[^@]+@[^@]+$/\n  max_length: 254\n}\n```',
      'Int': '**Int**\n\n64-bit signed integer.\n\n```isl\ntype Age = Int {\n  min: 0\n  max: 150\n}\n```',
      'Decimal': '**Decimal**\n\nArbitrary precision decimal number.\n\n```isl\ntype Money = Decimal {\n  precision: 2\n  min: 0\n}\n```',
      'Boolean': '**Boolean**\n\nTrue or false value.',
      'UUID': '**UUID**\n\nUniversally unique identifier (v4).',
      'Timestamp': '**Timestamp**\n\nISO 8601 date-time with timezone.',
      'Duration': '**Duration**\n\nTime duration (e.g., `5.minutes`, `100.ms`).',
    };
    return docs[typeName] || `**${typeName}**`;
  }
}
