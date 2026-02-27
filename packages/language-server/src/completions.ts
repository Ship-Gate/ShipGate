/**
 * ISL Completions
 */

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Position,
  MarkupKind,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLAnalyzer } from './analyzer';
import { ISL_KEYWORDS, ISL_BUILTIN_TYPES, ISL_ANNOTATIONS } from './capabilities';

/**
 * Get completions at position
 */
export function getCompletions(
  document: TextDocument,
  position: Position,
  analyzer: ISLAnalyzer
): CompletionItem[] {
  const text = document.getText();
  const offset = document.offsetAt(position);
  
  // Get line text up to cursor
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineText = text.substring(lineStart, offset);
  const trimmedLine = lineText.trim();

  const completions: CompletionItem[] = [];

  // Determine context
  const context = getCompletionContext(text, offset, trimmedLine);

  switch (context) {
    case 'top_level':
      completions.push(...getTopLevelCompletions());
      break;

    case 'domain_body':
      completions.push(...getDomainBodyCompletions());
      break;

    case 'type_definition':
      completions.push(...getTypeCompletions(analyzer));
      break;

    case 'field_type':
      completions.push(...getTypeCompletions(analyzer));
      break;

    case 'behavior_body':
      completions.push(...getBehaviorBodyCompletions());
      break;

    case 'annotation':
      completions.push(...getAnnotationCompletions());
      break;

    case 'constraint':
      completions.push(...getConstraintCompletions());
      break;

    default:
      // General completions
      completions.push(...getKeywordCompletions());
      completions.push(...getTypeCompletions(analyzer));
  }

  return completions;
}

type CompletionContext =
  | 'top_level'
  | 'domain_body'
  | 'type_definition'
  | 'field_type'
  | 'behavior_body'
  | 'annotation'
  | 'constraint'
  | 'unknown';

function getCompletionContext(
  text: string,
  offset: number,
  lineText: string
): CompletionContext {
  // Check for annotation context
  if (lineText.includes('[')) {
    return 'annotation';
  }

  // Check for type context
  if (lineText.includes(': ') || lineText.match(/type\s+\w+\s*=\s*/)) {
    return 'field_type';
  }

  // Check for constraint context
  if (lineText.includes('{') && (lineText.includes('min') || lineText.includes('max'))) {
    return 'constraint';
  }

  // Count braces to determine nesting
  const textBefore = text.substring(0, offset);
  const openBraces = (textBefore.match(/{/g) || []).length;
  const closeBraces = (textBefore.match(/}/g) || []).length;
  const braceDepth = openBraces - closeBraces;

  if (braceDepth === 0) {
    return 'top_level';
  }

  // Check what block we're in
  const lastDomain = textBefore.lastIndexOf('domain ');
  const lastBehavior = textBefore.lastIndexOf('behavior ');
  const lastEntity = textBefore.lastIndexOf('entity ');
  const lastType = textBefore.lastIndexOf('type ');

  const maxIndex = Math.max(lastDomain, lastBehavior, lastEntity, lastType);

  if (maxIndex === lastDomain && braceDepth === 1) {
    return 'domain_body';
  }

  if (maxIndex === lastBehavior) {
    return 'behavior_body';
  }

  if (maxIndex === lastType) {
    return 'type_definition';
  }

  return 'unknown';
}

function getTopLevelCompletions(): CompletionItem[] {
  return [
    {
      label: 'domain',
      kind: CompletionItemKind.Keyword,
      insertText: 'domain ${1:Name} {\n  version: "${2:1.0.0}"\n  \n  $0\n}',
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Define a new ISL domain',
      },
    },
    {
      label: 'import',
      kind: CompletionItemKind.Keyword,
      insertText: 'import { ${1:} } from "${2:}"',
      insertTextFormat: InsertTextFormat.Snippet,
    },
  ];
}

function getDomainBodyCompletions(): CompletionItem[] {
  return [
    {
      label: 'type',
      kind: CompletionItemKind.Keyword,
      insertText: 'type ${1:Name} = ${2:String} {\n  $0\n}',
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Define a new type',
      },
    },
    {
      label: 'entity',
      kind: CompletionItemKind.Keyword,
      insertText: 'entity ${1:Name} {\n  id: UUID [primary_key]\n  $0\n}',
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Define a new entity',
      },
    },
    {
      label: 'behavior',
      kind: CompletionItemKind.Keyword,
      insertText: [
        'behavior ${1:Name} {',
        '  description: "${2:}"',
        '  ',
        '  input {',
        '    $0',
        '  }',
        '  ',
        '  output {',
        '    success: {}',
        '    errors {}',
        '  }',
        '}',
      ].join('\n'),
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Define a new behavior',
      },
    },
    {
      label: 'enum',
      kind: CompletionItemKind.Keyword,
      insertText: 'enum ${1:Name} {\n  ${2:VALUE1}\n  ${3:VALUE2}\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'invariants',
      kind: CompletionItemKind.Keyword,
      insertText: 'invariants ${1:Name} {\n  description: "${2:}"\n  scope: global\n  \n  always {\n    $0\n  }\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'scenarios',
      kind: CompletionItemKind.Keyword,
      insertText: 'scenarios ${1:BehaviorName} {\n  scenario "${2:test case}" {\n    when {\n      $0\n    }\n    then {\n      \n    }\n  }\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
  ];
}

function getBehaviorBodyCompletions(): CompletionItem[] {
  return [
    {
      label: 'input',
      kind: CompletionItemKind.Keyword,
      insertText: 'input {\n  $0\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'output',
      kind: CompletionItemKind.Keyword,
      insertText: 'output {\n  success: {\n    $0\n  }\n  \n  errors {\n    \n  }\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'preconditions',
      kind: CompletionItemKind.Keyword,
      insertText: 'preconditions {\n  $0\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'postconditions',
      kind: CompletionItemKind.Keyword,
      insertText: 'postconditions {\n  success implies {\n    $0\n  }\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'temporal',
      kind: CompletionItemKind.Keyword,
      insertText: 'temporal {\n  - within ${1:100}.ms (p99): ${2:response}\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'security',
      kind: CompletionItemKind.Keyword,
      insertText: 'security {\n  - rate_limit ${1:100} per ${2:minute} per ${3:user}\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'actors',
      kind: CompletionItemKind.Keyword,
      insertText: 'actors {\n  ${1:User} {\n    for: ${2:operation}\n  }\n}',
      insertTextFormat: InsertTextFormat.Snippet,
    },
  ];
}

function getTypeCompletions(analyzer: ISLAnalyzer): CompletionItem[] {
  const completions: CompletionItem[] = [];

  // Built-in types
  for (const type of ISL_BUILTIN_TYPES) {
    completions.push({
      label: type,
      kind: CompletionItemKind.TypeParameter,
      detail: 'Built-in type',
    });
  }

  // User-defined types
  for (const symbol of analyzer.getAllSymbols()) {
    if (symbol.kind === 'type' || symbol.kind === 'entity') {
      completions.push({
        label: symbol.name,
        kind: symbol.kind === 'type' 
          ? CompletionItemKind.TypeParameter 
          : CompletionItemKind.Class,
        detail: symbol.detail,
      });
    }
  }

  // Generic types
  completions.push(
    {
      label: 'List<>',
      kind: CompletionItemKind.TypeParameter,
      insertText: 'List<${1:T}>',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'Set<>',
      kind: CompletionItemKind.TypeParameter,
      insertText: 'Set<${1:T}>',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'Map<>',
      kind: CompletionItemKind.TypeParameter,
      insertText: 'Map<${1:K}, ${2:V}>',
      insertTextFormat: InsertTextFormat.Snippet,
    },
    {
      label: 'Result<>',
      kind: CompletionItemKind.TypeParameter,
      insertText: 'Result<${1:T}, ${2:E}>',
      insertTextFormat: InsertTextFormat.Snippet,
    }
  );

  return completions;
}

function getAnnotationCompletions(): CompletionItem[] {
  return ISL_ANNOTATIONS.map((ann) => ({
    label: ann,
    kind: CompletionItemKind.Property,
    detail: 'Annotation',
  }));
}

function getConstraintCompletions(): CompletionItem[] {
  return [
    { label: 'min', kind: CompletionItemKind.Property },
    { label: 'max', kind: CompletionItemKind.Property },
    { label: 'min_length', kind: CompletionItemKind.Property },
    { label: 'max_length', kind: CompletionItemKind.Property },
    { label: 'pattern', kind: CompletionItemKind.Property },
    { label: 'unique', kind: CompletionItemKind.Property },
    { label: 'immutable', kind: CompletionItemKind.Property },
  ];
}

function getKeywordCompletions(): CompletionItem[] {
  return ISL_KEYWORDS.map((keyword) => ({
    label: keyword,
    kind: CompletionItemKind.Keyword,
  }));
}
