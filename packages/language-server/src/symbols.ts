/**
 * ISL Document Symbols
 */

import {
  DocumentSymbol,
  SymbolKind,
  Range,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLAnalyzer, ISLSymbol } from './analyzer';

/**
 * Get document symbols (outline)
 */
export function getDocumentSymbols(
  document: TextDocument,
  analyzer: ISLAnalyzer
): DocumentSymbol[] {
  const parsed = analyzer.getDocument(document.uri);
  
  if (!parsed) {
    // Parse if not already parsed
    const result = analyzer.analyzeDocument(document);
    return convertSymbols(result.symbols);
  }

  return convertSymbols(parsed.symbols);
}

function convertSymbols(symbols: ISLSymbol[]): DocumentSymbol[] {
  return symbols.map((symbol) => convertSymbol(symbol));
}

function convertSymbol(symbol: ISLSymbol): DocumentSymbol {
  return {
    name: symbol.name,
    kind: getSymbolKind(symbol.kind),
    range: symbol.range,
    selectionRange: symbol.range,
    detail: symbol.detail,
    children: symbol.children?.map((child) => convertSymbol(child)),
  };
}

function getSymbolKind(kind: ISLSymbol['kind']): SymbolKind {
  switch (kind) {
    case 'domain':
      return SymbolKind.Namespace;
    case 'type':
      return SymbolKind.TypeParameter;
    case 'entity':
      return SymbolKind.Class;
    case 'behavior':
      return SymbolKind.Function;
    case 'field':
      return SymbolKind.Property;
    case 'error':
      return SymbolKind.EnumMember;
    case 'invariant':
      return SymbolKind.Constant;
    default:
      return SymbolKind.Variable;
  }
}

/**
 * Parse document for outline (quick parse without full analysis)
 */
export function getQuickOutline(document: TextDocument): DocumentSymbol[] {
  const text = document.getText();
  const lines = text.split('\n');
  const symbols: DocumentSymbol[] = [];

  const stack: { symbol: DocumentSymbol; depth: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    // Domain
    const domainMatch = trimmed.match(/^domain\s+(\w+)/);
    if (domainMatch) {
      const symbol: DocumentSymbol = {
        name: domainMatch[1],
        kind: SymbolKind.Namespace,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
        children: [],
      };
      symbols.push(symbol);
      stack.length = 0;
      stack.push({ symbol, depth: indent });
      continue;
    }

    // Type
    const typeMatch = trimmed.match(/^type\s+(\w+)/);
    if (typeMatch) {
      const symbol: DocumentSymbol = {
        name: typeMatch[1],
        kind: SymbolKind.TypeParameter,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      continue;
    }

    // Entity
    const entityMatch = trimmed.match(/^entity\s+(\w+)/);
    if (entityMatch) {
      const symbol: DocumentSymbol = {
        name: entityMatch[1],
        kind: SymbolKind.Class,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
        children: [],
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      stack.push({ symbol, depth: indent });
      continue;
    }

    // Behavior
    const behaviorMatch = trimmed.match(/^behavior\s+(\w+)/);
    if (behaviorMatch) {
      const symbol: DocumentSymbol = {
        name: behaviorMatch[1],
        kind: SymbolKind.Function,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
        children: [],
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      stack.push({ symbol, depth: indent });
      continue;
    }

    // Enum
    const enumMatch = trimmed.match(/^enum\s+(\w+)/);
    if (enumMatch) {
      const symbol: DocumentSymbol = {
        name: enumMatch[1],
        kind: SymbolKind.Enum,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
        children: [],
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      stack.push({ symbol, depth: indent });
      continue;
    }

    // Invariants block
    const invariantsMatch = trimmed.match(/^invariants\s+(\w+)/);
    if (invariantsMatch) {
      const symbol: DocumentSymbol = {
        name: invariantsMatch[1],
        kind: SymbolKind.Constant,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      continue;
    }

    // Scenarios block
    const scenariosMatch = trimmed.match(/^scenarios\s+(\w+)/);
    if (scenariosMatch) {
      const symbol: DocumentSymbol = {
        name: `scenarios ${scenariosMatch[1]}`,
        kind: SymbolKind.Module,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
        children: [],
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      stack.push({ symbol, depth: indent });
      continue;
    }

    // Scenario
    const scenarioMatch = trimmed.match(/^scenario\s+"([^"]+)"/);
    if (scenarioMatch) {
      const symbol: DocumentSymbol = {
        name: scenarioMatch[1],
        kind: SymbolKind.Event,
        range: createRange(i, line),
        selectionRange: createRange(i, line),
      };
      addToParentOrRoot(symbol, stack, indent, symbols);
      continue;
    }

    // Field (within entity or behavior input/output)
    const fieldMatch = trimmed.match(/^(\w+):\s*(\w+)/);
    if (fieldMatch && stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (parent.symbol.kind === SymbolKind.Class || 
          parent.symbol.kind === SymbolKind.Function) {
        const symbol: DocumentSymbol = {
          name: fieldMatch[1],
          kind: SymbolKind.Property,
          detail: fieldMatch[2],
          range: createRange(i, line),
          selectionRange: createRange(i, line),
        };
        if (!parent.symbol.children) {
          parent.symbol.children = [];
        }
        parent.symbol.children.push(symbol);
      }
    }
  }

  return symbols;
}

function createRange(line: number, lineText: string): Range {
  return {
    start: { line, character: 0 },
    end: { line, character: lineText.length },
  };
}

function addToParentOrRoot(
  symbol: DocumentSymbol,
  stack: { symbol: DocumentSymbol; depth: number }[],
  indent: number,
  root: DocumentSymbol[]
): void {
  // Pop stack until we find parent at lower indent
  while (stack.length > 0 && stack[stack.length - 1].depth >= indent) {
    stack.pop();
  }

  if (stack.length > 0) {
    const parent = stack[stack.length - 1].symbol;
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(symbol);
  } else {
    root.push(symbol);
  }
}
