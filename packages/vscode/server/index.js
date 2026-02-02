import { createConnection, ProposedFeatures, TextDocuments, CodeActionKind as CodeActionKind$1, TextDocumentSyncKind, SemanticTokensBuilder, CompletionItemKind, SymbolKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity, IncrementalParser, SymbolIndex } from '@isl-lang/lsp-core';
export { DiagnosticSeverity } from '@isl-lang/lsp-core';
import { DiagnosticSeverity as DiagnosticSeverity$1, CodeActionKind, TextEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import * as path from 'path';

// src/server.ts
var ISLDocumentManager = class {
  parser;
  symbolIndex;
  documents = /* @__PURE__ */ new Map();
  pendingUpdates = /* @__PURE__ */ new Map();
  debounceMs = 150;
  constructor() {
    this.parser = new IncrementalParser();
    this.symbolIndex = new SymbolIndex();
  }
  /**
   * Update a document with debouncing
   */
  updateDocument(document, immediate = false) {
    const uri = document.uri;
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingUpdates.delete(uri);
    }
    if (immediate) {
      return this.parseDocument(document);
    }
    const timeout = setTimeout(() => {
      this.pendingUpdates.delete(uri);
      this.parseDocument(document);
    }, this.debounceMs);
    this.pendingUpdates.set(uri, timeout);
    return this.documents.get(uri);
  }
  /**
   * Parse document immediately
   */
  parseDocument(document) {
    const uri = document.uri;
    const source = document.getText();
    const { result } = this.parser.parse(uri, source, document.version, {
      typeCheck: true
    });
    this.symbolIndex.indexSymbols(uri, result.symbols);
    const parsed = {
      uri,
      version: document.version,
      analysisResult: result,
      domain: result.domain
    };
    this.documents.set(uri, parsed);
    return parsed;
  }
  /**
   * Get cached document
   */
  getDocument(uri) {
    return this.documents.get(uri);
  }
  /**
   * Remove document from cache
   */
  removeDocument(uri) {
    const pending = this.pendingUpdates.get(uri);
    if (pending) {
      clearTimeout(pending);
      this.pendingUpdates.delete(uri);
    }
    this.documents.delete(uri);
    this.parser.invalidate(uri);
    this.symbolIndex.clearDocument(uri);
  }
  /**
   * Get diagnostics for a document
   */
  getDiagnostics(uri) {
    const doc = this.documents.get(uri);
    return doc?.analysisResult.diagnostics || [];
  }
  /**
   * Get symbols for a document (for outline view)
   */
  getSymbols(uri) {
    const doc = this.documents.get(uri);
    return doc?.analysisResult.symbols || [];
  }
  // ============================================================================
  // Symbol Lookup
  // ============================================================================
  /**
   * Find symbol by name
   */
  findSymbol(name, kind) {
    return this.symbolIndex.findDefinition(name, kind);
  }
  /**
   * Find symbol at position
   */
  getSymbolAtPosition(uri, position) {
    const indexedSym = this.symbolIndex.findAtPosition(uri, position.line + 1, position.character + 1);
    if (indexedSym) return indexedSym;
    const doc = this.documents.get(uri);
    if (!doc) return void 0;
    return void 0;
  }
  /**
   * Get all symbols across all documents
   */
  getAllSymbols() {
    return this.symbolIndex.find({});
  }
  /**
   * Get entity names
   */
  getEntityNames() {
    return this.symbolIndex.getEntityNames();
  }
  /**
   * Get behavior names
   */
  getBehaviorNames() {
    return this.symbolIndex.getBehaviorNames();
  }
  /**
   * Get type names
   */
  getTypeNames() {
    return this.symbolIndex.getTypeNames();
  }
  /**
   * Get fields for a parent symbol
   */
  getFields(parentName) {
    return this.symbolIndex.getFields(parentName);
  }
  // ============================================================================
  // Context Analysis
  // ============================================================================
  /**
   * Get completion context at position
   */
  getCompletionContext(document, position) {
    const text = document.getText();
    const lines = text.split("\n");
    const line = lines[position.line] || "";
    const linePrefix = line.substring(0, position.character);
    const prefixMatch = linePrefix.match(/[\w@.]*$/);
    const prefix = prefixMatch ? prefixMatch[0] : "";
    const triggerChar = prefix.length > 0 ? void 0 : linePrefix.length > 0 ? linePrefix[linePrefix.length - 1] : void 0;
    const contextType = this.determineContextType(lines, position);
    return {
      contextType,
      triggerCharacter: triggerChar,
      prefix,
      line,
      position: { line: position.line, character: position.character },
      parentSymbol: this.findParentSymbol(lines, position),
      inPostcondition: this.isInPostcondition(lines, position.line)
    };
  }
  determineContextType(lines, position) {
    let braceDepth = 0;
    let currentBlock = "";
    let currentSection = "";
    for (let i = 0; i <= position.line; i++) {
      const line = lines[i] || "";
      const trimmed = line.trim();
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (trimmed.match(/^domain\s+\w+/)) {
        currentBlock = "domain";
        currentSection = "";
      } else if (trimmed.match(/^entity\s+\w+/)) {
        currentBlock = "entity";
        currentSection = "";
      } else if (trimmed.match(/^behavior\s+\w+/)) {
        currentBlock = "behavior";
        currentSection = "";
      } else if (trimmed.match(/^invariant\s+\w+/)) {
        currentBlock = "invariant";
        currentSection = "";
      } else if (trimmed.match(/^policy\s+\w+/)) {
        currentBlock = "policy";
        currentSection = "";
      } else if (trimmed.match(/^view\s+\w+/)) {
        currentBlock = "view";
        currentSection = "";
      } else if (trimmed.match(/^scenarios?\s+\w+/)) {
        currentBlock = "scenario";
        currentSection = "";
      } else if (trimmed.match(/^chaos\s+\w+/)) {
        currentBlock = "chaos";
        currentSection = "";
      }
      if (trimmed === "input {") currentSection = "input";
      else if (trimmed === "output {") currentSection = "output";
      else if (trimmed.startsWith("preconditions {") || trimmed === "pre {") currentSection = "pre";
      else if (trimmed.startsWith("postconditions {") || trimmed === "post {") currentSection = "post";
      else if (trimmed === "invariants {") currentSection = "invariant";
      else if (trimmed === "temporal {") currentSection = "temporal";
      else if (trimmed === "security {") currentSection = "security";
      else if (trimmed === "lifecycle {") currentSection = "lifecycle";
    }
    const currentLine = lines[position.line] || "";
    const beforeCursor = currentLine.substring(0, position.character);
    if (beforeCursor.match(/:\s*$/)) {
      return "type-annotation";
    }
    if (braceDepth === 0) return "top-level";
    if (braceDepth === 1 && !currentBlock) return "domain";
    switch (currentBlock) {
      case "entity":
        if (currentSection === "invariant") return "expression";
        if (currentSection === "lifecycle") return "entity-field";
        return "entity-field";
      case "behavior":
        switch (currentSection) {
          case "input":
            return "behavior-input";
          case "output":
            return "behavior-output";
          case "pre":
            return "behavior-pre";
          case "post":
            return "behavior-post";
          case "invariant":
            return "behavior-invariant";
          case "temporal":
            return "behavior-temporal";
          case "security":
            return "behavior-security";
          default:
            return "behavior";
        }
      case "invariant":
        return "invariant";
      case "policy":
        return "policy";
      case "view":
        return "view";
      case "scenario":
        return "scenario";
      case "chaos":
        return "chaos";
      default:
        return "domain";
    }
  }
  findParentSymbol(lines, position) {
    for (let i = position.line; i >= 0; i--) {
      const line = lines[i] || "";
      const trimmed = line.trim();
      const entityMatch = trimmed.match(/^entity\s+(\w+)/);
      if (entityMatch) return entityMatch[1];
      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)/);
      if (behaviorMatch) return behaviorMatch[1];
      const domainMatch = trimmed.match(/^domain\s+(\w+)/);
      if (domainMatch) return domainMatch[1];
    }
    return void 0;
  }
  isInPostcondition(lines, lineNum) {
    let braceDepth = 0;
    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i]?.trim() || "";
      braceDepth += (line.match(/\}/g) || []).length;
      braceDepth -= (line.match(/\{/g) || []).length;
      if ((line.startsWith("postconditions {") || line === "post {") && braceDepth <= 0) {
        return true;
      }
      if ((line.startsWith("preconditions {") || line === "pre {") && braceDepth <= 0) {
        return false;
      }
    }
    return false;
  }
  // ============================================================================
  // Word at Position
  // ============================================================================
  /**
   * Get word at cursor position
   */
  getWordAtPosition(document, position) {
    const text = document.getText();
    const lines = text.split("\n");
    const line = lines[position.line];
    if (!line) return "";
    let start = position.character;
    let end = position.character;
    while (start > 0 && /[\w]/.test(line[start - 1] || "")) {
      start--;
    }
    while (end < line.length && /[\w]/.test(line[end] || "")) {
      end++;
    }
    return line.substring(start, end);
  }
  /**
   * Get word range at position
   */
  getWordRangeAtPosition(document, position) {
    const text = document.getText();
    const lines = text.split("\n");
    const line = lines[position.line];
    if (!line) return void 0;
    let start = position.character;
    let end = position.character;
    while (start > 0 && /[\w]/.test(line[start - 1] || "")) {
      start--;
    }
    while (end < line.length && /[\w]/.test(line[end] || "")) {
      end++;
    }
    if (start === end) return void 0;
    return {
      start: { line: position.line, character: start },
      end: { line: position.line, character: end }
    };
  }
  // ============================================================================
  // Utilities
  // ============================================================================
  /**
   * Convert ISL SourceLocation to LSP Range
   */
  static toRange(loc) {
    return {
      start: { line: loc.line - 1, character: loc.column - 1 },
      end: { line: loc.endLine - 1, character: loc.endColumn - 1 }
    };
  }
  /**
   * Convert LSP Position to ISL line/column (1-based)
   */
  static toISLPosition(position) {
    return {
      line: position.line + 1,
      column: position.character + 1
    };
  }
};

// src/features/completion.ts
var TOP_LEVEL_KEYWORDS = [
  { label: "domain", doc: "Define a new domain" }
];
var DOMAIN_KEYWORDS = [
  { label: "entity", doc: "Define a persistent entity" },
  { label: "behavior", doc: "Define a behavior/operation" },
  { label: "type", doc: "Define a custom type" },
  { label: "enum", doc: "Define an enumeration" },
  { label: "invariants", doc: "Define global invariants" },
  { label: "policy", doc: "Define a policy" },
  { label: "view", doc: "Define a view/projection" },
  { label: "scenarios", doc: "Define test scenarios" },
  { label: "chaos", doc: "Define chaos tests" },
  { label: "version", doc: "Domain version" },
  { label: "owner", doc: "Domain owner" },
  { label: "imports", doc: "Import from other domains" }
];
var ENTITY_KEYWORDS = [
  { label: "invariants", doc: "Entity invariants" },
  { label: "lifecycle", doc: "Entity lifecycle states" }
];
var BEHAVIOR_KEYWORDS = [
  { label: "description", doc: "Behavior description" },
  { label: "actors", doc: "Authorized actors" },
  { label: "input", doc: "Input parameters" },
  { label: "output", doc: "Output specification" },
  { label: "preconditions", doc: "Preconditions" },
  { label: "postconditions", doc: "Postconditions" },
  { label: "invariants", doc: "Behavior invariants" },
  { label: "temporal", doc: "Temporal constraints" },
  { label: "security", doc: "Security requirements" },
  { label: "compliance", doc: "Compliance requirements" },
  { label: "observability", doc: "Observability settings" }
];
var TEMPORAL_KEYWORDS = [
  { label: "response", doc: "Response time constraint" },
  { label: "eventually", doc: "Eventually happens" },
  { label: "always", doc: "Always true" },
  { label: "never", doc: "Never happens" },
  { label: "within", doc: "Within time constraint" },
  { label: "immediately", doc: "Immediate effect" }
];
var SECURITY_KEYWORDS = [
  { label: "requires", doc: "Required permission/capability" },
  { label: "rate_limit", doc: "Rate limiting" },
  { label: "brute_force_protection", doc: "Brute force protection" }
];
var EXPRESSION_KEYWORDS = [
  { label: "forall", doc: "Universal quantifier" },
  { label: "exists", doc: "Existential quantifier" },
  { label: "implies", doc: "Logical implication" },
  { label: "and", doc: "Logical and" },
  { label: "or", doc: "Logical or" },
  { label: "not", doc: "Logical negation" },
  { label: "true", doc: "Boolean true" },
  { label: "false", doc: "Boolean false" },
  { label: "null", doc: "Null value" }
];
var POSTCONDITION_KEYWORDS = [
  { label: "old", doc: "Reference to pre-state value" },
  { label: "result", doc: "Reference to operation result" },
  { label: "success", doc: "Success postcondition block" },
  { label: "failure", doc: "Failure postcondition block" },
  ...EXPRESSION_KEYWORDS
];
var SCENARIO_KEYWORDS = [
  { label: "scenario", doc: "Define a test scenario" },
  { label: "given", doc: "Setup state" },
  { label: "when", doc: "Action to test" },
  { label: "then", doc: "Expected outcome" }
];
var BUILTIN_TYPES = [
  { label: "String", kind: "type", detail: "UTF-8 text value", documentation: "A sequence of Unicode characters" },
  { label: "Int", kind: "type", detail: "Integer value", documentation: "64-bit signed integer" },
  { label: "Decimal", kind: "type", detail: "Decimal number", documentation: "Arbitrary precision decimal" },
  { label: "Boolean", kind: "type", detail: "Boolean value", documentation: "true or false" },
  { label: "UUID", kind: "type", detail: "Universally unique identifier", documentation: "128-bit identifier" },
  { label: "Timestamp", kind: "type", detail: "Date and time with timezone", documentation: "Instant in time" },
  { label: "Duration", kind: "type", detail: "Time duration", documentation: "Length of time (ms, seconds, minutes, hours, days)" },
  { label: "Date", kind: "type", detail: "Calendar date", documentation: "Date without time" },
  { label: "Time", kind: "type", detail: "Time of day", documentation: "Time without date" },
  { label: "List", kind: "type", detail: "Ordered collection", documentation: "List<T> - ordered sequence of elements", insertText: "List<${1:T}>", insertTextFormat: "snippet" },
  { label: "Map", kind: "type", detail: "Key-value collection", documentation: "Map<K, V> - key-value pairs", insertText: "Map<${1:K}, ${2:V}>", insertTextFormat: "snippet" },
  { label: "Set", kind: "type", detail: "Unique collection", documentation: "Set<T> - unique elements", insertText: "Set<${1:T}>", insertTextFormat: "snippet" },
  { label: "Optional", kind: "type", detail: "Nullable value", documentation: "Optional<T> - may be null", insertText: "Optional<${1:T}>", insertTextFormat: "snippet" }
];
var BUILTIN_FUNCTIONS = [
  { label: "old", kind: "function", detail: "Previous value", documentation: "Reference to value before operation", insertText: "old(${1:expr})", insertTextFormat: "snippet" },
  { label: "len", kind: "function", detail: "Length of collection", documentation: "Returns the number of elements", insertText: "len(${1:collection})", insertTextFormat: "snippet" },
  { label: "sum", kind: "function", detail: "Sum of collection", documentation: "Sum all numeric elements", insertText: "sum(${1:collection})", insertTextFormat: "snippet" },
  { label: "count", kind: "function", detail: "Count elements", documentation: "Count matching elements", insertText: "count(${1:collection}, ${2:predicate})", insertTextFormat: "snippet" },
  { label: "filter", kind: "function", detail: "Filter collection", documentation: "Filter elements by predicate", insertText: "filter(${1:collection}, ${2:predicate})", insertTextFormat: "snippet" },
  { label: "all", kind: "function", detail: "All match", documentation: "Check if all elements match predicate", insertText: "all(${1:collection}, ${2:item} => ${3:predicate})", insertTextFormat: "snippet" },
  { label: "any", kind: "function", detail: "Any match", documentation: "Check if any element matches predicate", insertText: "any(${1:collection}, ${2:item} => ${3:predicate})", insertTextFormat: "snippet" },
  { label: "none", kind: "function", detail: "None match", documentation: "Check if no elements match predicate", insertText: "none(${1:collection}, ${2:item} => ${3:predicate})", insertTextFormat: "snippet" },
  { label: "now", kind: "function", detail: "Current timestamp", documentation: "Returns the current timestamp", insertText: "now()" },
  { label: "exists", kind: "function", detail: "Entity exists", documentation: "Check if entity exists", insertText: "exists(${1:id})", insertTextFormat: "snippet" },
  { label: "lookup", kind: "function", detail: "Lookup entity", documentation: "Find entity by ID or field", insertText: "lookup(${1:id})", insertTextFormat: "snippet" }
];
var DOMAIN_SNIPPET = {
  label: "domain",
  kind: "snippet",
  detail: "Create a new domain",
  insertText: `domain \${1:Name} {
  version: "\${2:1.0.0}"

  $0
}`,
  insertTextFormat: "snippet",
  preselect: true
};
var ENTITY_SNIPPET = {
  label: "entity",
  kind: "snippet",
  detail: "Create a new entity",
  insertText: `entity \${1:Name} {
  id: UUID [immutable, unique]
  \${2:field}: \${3:String}

  invariants {
    $0
  }
}`,
  insertTextFormat: "snippet"
};
var BEHAVIOR_SNIPPET = {
  label: "behavior",
  kind: "snippet",
  detail: "Create a new behavior",
  insertText: `behavior \${1:Name} {
  description: "\${2:Description}"

  input {
    \${3:param}: \${4:String}
  }

  output {
    success: \${5:Boolean}

    errors {
      \${6:ERROR_NAME} {
        when: "\${7:Error description}"
        retriable: \${8|true,false|}
      }
    }
  }

  preconditions {
    \${9:input.param != null}
  }

  postconditions {
    success implies {
      $0
    }
  }
}`,
  insertTextFormat: "snippet"
};
var TYPE_SNIPPET = {
  label: "type",
  kind: "snippet",
  detail: "Create a custom type",
  insertText: `type \${1:Name} = \${2:String} {
  \${3:constraint}: \${4:value}
}`,
  insertTextFormat: "snippet"
};
var ENUM_SNIPPET = {
  label: "enum",
  kind: "snippet",
  detail: "Create an enumeration",
  insertText: `enum \${1:Name} {
  \${2:VARIANT1}
  \${3:VARIANT2}
  $0
}`,
  insertTextFormat: "snippet"
};
var INVARIANT_SNIPPET = {
  label: "invariants",
  kind: "snippet",
  detail: "Create an invariant block",
  insertText: `invariants \${1:Name} {
  description: "\${2:Description}"
  scope: \${3|global,transaction|}

  always {
    $0
  }
}`,
  insertTextFormat: "snippet"
};
var SCENARIO_SNIPPET = {
  label: "scenario",
  kind: "snippet",
  detail: "Create a test scenario",
  insertText: `scenario "\${1:Test scenario}" {
  given {
    \${2:setup}
  }

  when {
    \${3:action}
  }

  then {
    $0
  }
}`,
  insertTextFormat: "snippet"
};
var ISLCompletionProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
  }
  provideCompletions(document, position) {
    const context = this.documentManager.getCompletionContext(document, position);
    const items = [];
    switch (context.contextType) {
      case "top-level":
        items.push(DOMAIN_SNIPPET);
        items.push(...TOP_LEVEL_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "domain":
        items.push(ENTITY_SNIPPET);
        items.push(BEHAVIOR_SNIPPET);
        items.push(TYPE_SNIPPET);
        items.push(ENUM_SNIPPET);
        items.push(INVARIANT_SNIPPET);
        items.push(...DOMAIN_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "entity":
      case "entity-field":
        items.push(...ENTITY_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "behavior":
        items.push(...BEHAVIOR_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "behavior-input":
      case "behavior-output":
        break;
      case "behavior-pre":
        items.push(...EXPRESSION_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        items.push(...BUILTIN_FUNCTIONS.filter((f) => f.label !== "old" && f.label !== "result"));
        break;
      case "behavior-post":
        items.push(...POSTCONDITION_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        items.push(...BUILTIN_FUNCTIONS);
        break;
      case "behavior-temporal":
        items.push(...TEMPORAL_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "behavior-security":
        items.push(...SECURITY_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "scenario":
        items.push(SCENARIO_SNIPPET);
        items.push(...SCENARIO_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        break;
      case "type-annotation":
        items.push(...BUILTIN_TYPES);
        items.push(...this.getCustomTypeCompletions());
        items.push(...this.getEntityCompletions());
        break;
      case "expression":
      case "invariant":
      case "policy":
        items.push(...EXPRESSION_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
        items.push(...BUILTIN_FUNCTIONS);
        break;
      default:
        items.push(...EXPRESSION_KEYWORDS.map((k) => ({
          label: k.label,
          kind: "keyword",
          detail: k.doc
        })));
    }
    if (context.triggerCharacter === ":") {
      items.push(...BUILTIN_TYPES);
      items.push(...this.getCustomTypeCompletions());
      items.push(...this.getEntityCompletions());
    }
    if (context.triggerCharacter === ".") {
      items.push(...this.getMemberCompletions(context));
    }
    if (context.triggerCharacter === "@") {
      items.push(...this.getAnnotationCompletions());
    }
    if (["expression", "behavior-pre", "behavior-post", "invariant"].includes(context.contextType)) {
      items.push(...this.getEntityCompletions());
      items.push(...this.getBehaviorCompletions());
    }
    if (context.prefix) {
      const prefix = context.prefix.toLowerCase();
      return items.filter(
        (item) => item.label.toLowerCase().startsWith(prefix) || item.filterText?.toLowerCase().startsWith(prefix)
      );
    }
    return items;
  }
  getCustomTypeCompletions() {
    const types = this.documentManager.getTypeNames();
    return types.map((name) => ({
      label: name,
      kind: "type",
      detail: "Custom type"
    }));
  }
  getEntityCompletions() {
    const entities = this.documentManager.getEntityNames();
    return entities.map((name) => ({
      label: name,
      kind: "entity",
      detail: "Entity"
    }));
  }
  getBehaviorCompletions() {
    const behaviors = this.documentManager.getBehaviorNames();
    return behaviors.map((name) => ({
      label: name,
      kind: "behavior",
      detail: "Behavior"
    }));
  }
  getMemberCompletions(context) {
    const items = [];
    items.push(
      { label: "lookup", kind: "function", detail: "Find by ID", insertText: "lookup(${1:id})", insertTextFormat: "snippet" },
      { label: "exists", kind: "function", detail: "Check existence", insertText: "exists(${1:id})", insertTextFormat: "snippet" },
      { label: "all", kind: "function", detail: "Get all entities" },
      { label: "count", kind: "function", detail: "Count entities" },
      { label: "filter", kind: "function", detail: "Filter entities", insertText: "filter(${1:predicate})", insertTextFormat: "snippet" }
    );
    items.push(
      { label: "ms", kind: "property", detail: "Milliseconds" },
      { label: "seconds", kind: "property", detail: "Seconds" },
      { label: "minutes", kind: "property", detail: "Minutes" },
      { label: "hours", kind: "property", detail: "Hours" },
      { label: "days", kind: "property", detail: "Days" }
    );
    items.push(
      { label: "length", kind: "property", detail: "String length" },
      { label: "is_valid", kind: "function", detail: "Validate format" },
      { label: "is_empty", kind: "function", detail: "Check if empty" }
    );
    if (context.parentSymbol) {
      const fields = this.documentManager.getFields(context.parentSymbol);
      for (const field of fields) {
        items.push({
          label: field.name,
          kind: "field",
          detail: field.detail || field.type
        });
      }
    }
    return items;
  }
  getAnnotationCompletions() {
    return [
      { label: "unique", kind: "keyword", detail: "Field must be unique" },
      { label: "immutable", kind: "keyword", detail: "Field cannot be changed" },
      { label: "indexed", kind: "keyword", detail: "Field is indexed" },
      { label: "sensitive", kind: "keyword", detail: "Contains sensitive data" },
      { label: "secret", kind: "keyword", detail: "Contains secret data" },
      { label: "pii", kind: "keyword", detail: "Personally identifiable information" },
      { label: "computed", kind: "keyword", detail: "Derived from other fields" },
      { label: "deprecated", kind: "keyword", detail: "Mark as deprecated" },
      { label: "default", kind: "keyword", detail: "Default value", insertText: "default: ${1:value}", insertTextFormat: "snippet" }
    ];
  }
};

// src/features/hover.ts
var BUILTIN_DOCS = {
  String: `**String** - UTF-8 text value

A sequence of Unicode characters. Supports common string operations.

\`\`\`isl
username: String
\`\`\``,
  Int: `**Int** - Integer value

A 64-bit signed integer. Range: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807

\`\`\`isl
count: Int
\`\`\``,
  Decimal: `**Decimal** - Arbitrary precision decimal

Use for monetary values and other precise calculations.

\`\`\`isl
price: Decimal
\`\`\``,
  Boolean: `**Boolean** - Logical value

Either \`true\` or \`false\`.

\`\`\`isl
isActive: Boolean
\`\`\``,
  UUID: `**UUID** - Universally Unique Identifier

A 128-bit identifier, typically used for entity IDs.

\`\`\`isl
id: UUID @unique
\`\`\``,
  Timestamp: `**Timestamp** - Date and time with timezone

An instant in time with nanosecond precision.

\`\`\`isl
createdAt: Timestamp
\`\`\``,
  Duration: `**Duration** - Time duration

A length of time. Can be specified in ms, seconds, minutes, hours, days.

\`\`\`isl
timeout: Duration = 30.seconds
\`\`\``,
  Date: `**Date** - Calendar date

A date without time component.

\`\`\`isl
birthDate: Date
\`\`\``,
  Time: `**Time** - Time of day

A time without date component.

\`\`\`isl
startTime: Time
\`\`\``,
  List: `**List<T>** - Ordered collection

An ordered sequence of elements of type T.

\`\`\`isl
tags: List<String>
orders: List<Order>
\`\`\``,
  Map: `**Map<K, V>** - Key-value collection

A collection of key-value pairs with unique keys.

\`\`\`isl
metadata: Map<String, String>
\`\`\``,
  Set: `**Set<T>** - Unique collection

A collection of unique elements.

\`\`\`isl
categories: Set<String>
\`\`\``,
  Optional: `**Optional<T>** - Nullable value

A value that may or may not be present. Can also use \`?\` suffix.

\`\`\`isl
middleName: Optional<String>
// or
middleName: String?
\`\`\``
};
var KEYWORD_DOCS = {
  domain: `**domain** - Root container for ISL specification

A domain defines a bounded context containing entities, behaviors, types, and policies.

\`\`\`isl
domain Ecommerce {
  version: "1.0.0"
  // ... declarations
}
\`\`\``,
  entity: `**entity** - Persistent data model

Entities represent core data structures with identity, state, and behavior.

\`\`\`isl
entity User {
  id: UUID @unique
  email: Email
  status: UserStatus
  
  invariants {
    email.is_valid()
  }
}
\`\`\``,
  behavior: `**behavior** - Operation with contracts

Behaviors define operations with input/output types, preconditions, and postconditions.

\`\`\`isl
behavior CreateUser {
  input {
    email: Email
    username: String
  }
  
  output {
    success: User
    errors { ... }
  }
  
  preconditions {
    not User.exists_by_email(input.email)
  }
  
  postconditions {
    success implies {
      User.exists(result.id)
    }
  }
}
\`\`\``,
  type: `**type** - Custom type definition

Define constrained or aliased types.

\`\`\`isl
type Email = String { format: "email", max_length: 254 }
type Money = Decimal { min: 0 }
\`\`\``,
  enum: `**enum** - Enumeration type

Define a set of named values.

\`\`\`isl
enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
\`\`\``,
  invariants: `**invariants** - Constraints that must always hold

Define business rules that must be maintained across all operations.

\`\`\`isl
invariants PositiveBalance {
  scope: global
  
  always {
    forall account: Account =>
      account.balance >= 0
  }
}
\`\`\``,
  preconditions: `**preconditions** - Conditions before operation

Conditions that must be true before the operation executes.

\`\`\`isl
preconditions {
  User.exists(input.userId)
  input.amount > 0
}
\`\`\``,
  postconditions: `**postconditions** - Conditions after operation

Conditions guaranteed to be true after successful execution.

\`\`\`isl
postconditions {
  success implies {
    result.status == Active
  }
}
\`\`\``,
  old: `**old(expr)** - Previous value

References the value of an expression before the operation. Only valid in postconditions.

\`\`\`isl
postconditions {
  success implies {
    account.balance == old(account.balance) - input.amount
  }
}
\`\`\``,
  result: `**result** - Operation output

References the return value of a successful operation. Only valid in postconditions.

\`\`\`isl
postconditions {
  success implies {
    result.id != null
    result.createdAt <= now()
  }
}
\`\`\``,
  forall: `**forall** - Universal quantifier

Asserts a condition holds for all elements in a collection.

\`\`\`isl
forall user: User => user.email.is_valid()
\`\`\``,
  exists: `**exists** - Existential quantifier

Asserts at least one element satisfies a condition.

\`\`\`isl
exists order: Order => order.status == Pending
\`\`\``,
  implies: `**implies** - Logical implication

If the left side is true, the right side must also be true.

\`\`\`isl
user.isAdmin implies user.verified
\`\`\``,
  temporal: `**temporal** - Timing constraints

Define response time and timing requirements.

\`\`\`isl
temporal {
  response within 200.ms (p50)
  response within 500.ms (p99)
  eventually within 5.minutes: audit_logged
}
\`\`\``,
  security: `**security** - Security requirements

Define access control, rate limiting, and security constraints.

\`\`\`isl
security {
  requires: authenticated
  rate_limit 100 per hour per ip_address
}
\`\`\``,
  scenario: `**scenario** - Test scenario

Define test cases using given/when/then structure.

\`\`\`isl
scenario "Successful login" {
  given {
    user = User.create(email: "test@example.com")
  }
  when {
    result = Login(email: user.email, password: "secret")
  }
  then {
    result.success
    Session.exists(result.sessionId)
  }
}
\`\`\``,
  lifecycle: `**lifecycle** - Entity state machine

Define valid state transitions for an entity.

\`\`\`isl
lifecycle {
  Created -> Active
  Active -> Suspended
  Suspended -> Active
  Active -> Archived
}
\`\`\``
};
var ISLHoverProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
  }
  provideHover(document, position) {
    const word = this.documentManager.getWordAtPosition(document, position);
    if (!word) return null;
    const range = this.documentManager.getWordRangeAtPosition(document, position);
    if (BUILTIN_DOCS[word]) {
      return { contents: BUILTIN_DOCS[word], range };
    }
    if (KEYWORD_DOCS[word]) {
      return { contents: KEYWORD_DOCS[word], range };
    }
    const symbol = this.documentManager.findSymbol(word);
    if (symbol) {
      return { contents: this.formatSymbolHover(symbol), range };
    }
    const docSymbols = this.documentManager.getSymbols(document.uri);
    const foundSymbol = this.findSymbolByName(docSymbols, word);
    if (foundSymbol) {
      return { contents: this.formatSymbolInfoHover(foundSymbol), range };
    }
    return null;
  }
  findSymbolByName(symbols, name) {
    for (const sym of symbols) {
      if (sym.name === name) return sym;
      if (sym.children) {
        const found = this.findSymbolByName(sym.children, name);
        if (found) return found;
      }
    }
    return void 0;
  }
  formatSymbolHover(symbol) {
    let md = `**${symbol.kind}** \`${symbol.name}\`

`;
    if (symbol.type) {
      md += `**Type:** \`${symbol.type}\`

`;
    }
    if (symbol.detail) {
      md += `${symbol.detail}
`;
    }
    return md;
  }
  formatSymbolInfoHover(symbol) {
    let md = `**${symbol.kind}** \`${symbol.name}\`

`;
    if (symbol.detail) {
      md += `${symbol.detail}

`;
    }
    if (symbol.documentation) {
      md += `${symbol.documentation}

`;
    }
    if (symbol.children && symbol.children.length > 0) {
      const childSymbols = symbol.children;
      const fields = childSymbols.filter((c) => c.kind === "field" || c.kind === "input" || c.kind === "output");
      const errors = childSymbols.filter((c) => c.kind === "error");
      const states = childSymbols.filter((c) => c.kind === "lifecycle-state");
      if (fields.length > 0) {
        md += "**Fields:**\n";
        for (const field of fields) {
          const typeInfo = field.detail ? `: ${field.detail}` : "";
          md += `- \`${field.name}\`${typeInfo}
`;
        }
        md += "\n";
      }
      if (errors.length > 0) {
        md += "**Errors:**\n";
        for (const error of errors) {
          md += `- \`${error.name}\`${error.detail ? ` - ${error.detail}` : ""}
`;
        }
        md += "\n";
      }
      if (states.length > 0) {
        md += "**Lifecycle States:**\n";
        md += states.map((s) => `\`${s.name}\``).join(" \u2192 ") + "\n";
      }
    }
    return md;
  }
};
var ISLImportResolver = class {
  /** Cache of exported symbols per file URI */
  exportCache = /* @__PURE__ */ new Map();
  /** File content provider - allows testing without filesystem */
  fileProvider;
  /** Domain cache for resolved files */
  domainCache = /* @__PURE__ */ new Map();
  constructor(fileProvider) {
    this.fileProvider = fileProvider || this.defaultFileProvider;
  }
  /**
   * Resolve all imports in a document
   */
  async resolveImports(documentUri, domain) {
    const result = {
      imports: [],
      diagnostics: [],
      importedSymbols: /* @__PURE__ */ new Map()
    };
    if (!domain.imports || domain.imports.length === 0) {
      return result;
    }
    for (const importStmt of domain.imports) {
      const resolvedImport = await this.resolveImport(documentUri, importStmt);
      result.imports.push(resolvedImport);
      result.diagnostics.push(...resolvedImport.diagnostics);
      for (const item of resolvedImport.items) {
        if (item.exists && item.definitionLocation) {
          const name = item.item.alias?.name || item.item.name.name;
          result.importedSymbols.set(name, {
            name: item.item.name.name,
            kind: item.kind,
            location: item.definitionLocation,
            uri: resolvedImport.resolvedUri
          });
        }
      }
    }
    return result;
  }
  /**
   * Resolve a single import statement
   */
  async resolveImport(documentUri, importStmt) {
    const diagnostics = [];
    const resolvedUri = this.resolveImportPath(documentUri, importStmt.from.value);
    const result = {
      importStatement: importStmt,
      resolvedUri,
      resolved: false,
      items: [],
      diagnostics
    };
    const importedDomain = await this.loadDomain(resolvedUri);
    if (!importedDomain) {
      diagnostics.push({
        message: `Cannot resolve import '${importStmt.from.value}'`,
        severity: DiagnosticSeverity.Error,
        location: importStmt.from.location,
        code: "ISL2001",
        source: "isl-import-resolver",
        data: {
          type: "unresolved-import",
          importPath: importStmt.from.value,
          resolvedUri
        }
      });
      return result;
    }
    result.resolved = true;
    const exports$1 = this.getExports(resolvedUri, importedDomain);
    for (const item of importStmt.items) {
      const exportedSymbol = exports$1.get(item.name.name);
      if (!exportedSymbol) {
        diagnostics.push({
          message: `'${item.name.name}' is not exported from '${importStmt.from.value}'`,
          severity: DiagnosticSeverity.Error,
          location: item.name.location,
          code: "ISL2002",
          source: "isl-import-resolver",
          relatedInfo: [
            {
              message: `File '${importStmt.from.value}' exports: ${Array.from(exports$1.keys()).join(", ") || "nothing"}`,
              location: importStmt.from.location
            }
          ],
          data: {
            type: "unknown-export",
            symbolName: item.name.name,
            availableExports: Array.from(exports$1.keys())
          }
        });
        result.items.push({
          item,
          exists: false
        });
      } else {
        result.items.push({
          item,
          exists: true,
          kind: exportedSymbol.kind,
          definitionLocation: exportedSymbol.location
        });
      }
    }
    return result;
  }
  /**
   * Get all exported symbols from a domain
   */
  getExports(uri, domain) {
    const cached = this.exportCache.get(uri);
    if (cached) return cached;
    const exports$1 = /* @__PURE__ */ new Map();
    for (const entity of domain.entities) {
      exports$1.set(entity.name.name, {
        name: entity.name.name,
        kind: "entity",
        location: entity.name.location,
        uri
      });
    }
    for (const type of domain.types) {
      const kind = type.definition.kind === "EnumType" ? "enum" : "type";
      exports$1.set(type.name.name, {
        name: type.name.name,
        kind,
        location: type.name.location,
        uri
      });
    }
    for (const behavior of domain.behaviors) {
      exports$1.set(behavior.name.name, {
        name: behavior.name.name,
        kind: "behavior",
        location: behavior.name.location,
        uri
      });
    }
    for (const invariant of domain.invariants) {
      exports$1.set(invariant.name.name, {
        name: invariant.name.name,
        kind: "invariant",
        location: invariant.name.location,
        uri
      });
    }
    for (const policy of domain.policies) {
      exports$1.set(policy.name.name, {
        name: policy.name.name,
        kind: "policy",
        location: policy.name.location,
        uri
      });
    }
    for (const view of domain.views) {
      exports$1.set(view.name.name, {
        name: view.name.name,
        kind: "view",
        location: view.name.location,
        uri
      });
    }
    this.exportCache.set(uri, exports$1);
    return exports$1;
  }
  /**
   * Resolve an import path relative to the importing file
   */
  resolveImportPath(documentUri, importPath) {
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      const documentPath = URI.parse(documentUri).fsPath;
      const documentDir = path.dirname(documentPath);
      const resolved = path.resolve(documentDir, importPath);
      const withExtension2 = resolved.endsWith(".isl") ? resolved : `${resolved}.isl`;
      return URI.file(withExtension2).toString();
    }
    const withExtension = importPath.endsWith(".isl") ? importPath : `${importPath}.isl`;
    return URI.file(withExtension).toString();
  }
  /**
   * Load and parse a domain from a URI
   */
  async loadDomain(uri) {
    const cached = this.domainCache.get(uri);
    if (cached !== void 0) return cached;
    try {
      const content = await this.fileProvider(uri);
      if (!content) {
        this.domainCache.set(uri, void 0);
        return void 0;
      }
      const { parse } = await import('@isl-lang/parser');
      const result = parse(content, URI.parse(uri).fsPath);
      if (result.success && result.domain) {
        this.domainCache.set(uri, result.domain);
        return result.domain;
      }
      this.domainCache.set(uri, void 0);
      return void 0;
    } catch {
      this.domainCache.set(uri, void 0);
      return void 0;
    }
  }
  /**
   * Default file provider using filesystem
   */
  async defaultFileProvider(uri) {
    try {
      const fs = await import('fs/promises');
      const filePath = URI.parse(uri).fsPath;
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return void 0;
    }
  }
  /**
   * Clear caches for a specific URI or all URIs
   */
  invalidate(uri) {
    if (uri) {
      this.exportCache.delete(uri);
      this.domainCache.delete(uri);
    } else {
      this.exportCache.clear();
      this.domainCache.clear();
    }
  }
  /**
   * Set a custom file provider (useful for testing)
   */
  setFileProvider(provider) {
    this.fileProvider = provider;
    this.invalidate();
  }
  /**
   * Pre-populate domain cache (useful for testing)
   */
  setDomainCache(uri, domain) {
    this.domainCache.set(uri, domain);
    if (domain) {
      this.getExports(uri, domain);
    }
  }
};
var LINT_RULES = {
  // Correctness rules
  "ISL1001": {
    id: "ISL1001",
    name: "missing-postcondition",
    description: "Behavior should have postconditions to verify outcomes",
    severity: DiagnosticSeverity.Warning,
    category: "correctness"
  },
  "ISL1002": {
    id: "ISL1002",
    name: "precondition-without-error",
    description: "Behavior has preconditions but no error cases defined",
    severity: DiagnosticSeverity.Hint,
    category: "correctness"
  },
  "ISL1003": {
    id: "ISL1003",
    name: "unused-type",
    description: "Type is defined but never used",
    severity: DiagnosticSeverity.Hint,
    category: "style"
  },
  "ISL1004": {
    id: "ISL1004",
    name: "undefined-behavior-reference",
    description: "Scenarios reference undefined behavior",
    severity: DiagnosticSeverity.Error,
    category: "correctness"
  },
  // Best practice rules
  "ISL1010": {
    id: "ISL1010",
    name: "missing-description",
    description: "Behavior should have a description",
    severity: DiagnosticSeverity.Hint,
    category: "best-practice"
  },
  "ISL1011": {
    id: "ISL1011",
    name: "entity-without-id",
    description: "Entity should have an id field for identification",
    severity: DiagnosticSeverity.Warning,
    category: "best-practice"
  },
  "ISL1012": {
    id: "ISL1012",
    name: "mutable-behavior-no-temporal",
    description: "State-modifying behavior should specify temporal constraints",
    severity: DiagnosticSeverity.Hint,
    category: "best-practice"
  },
  "ISL1013": {
    id: "ISL1013",
    name: "no-scenarios",
    description: "Behavior has no test scenarios defined",
    severity: DiagnosticSeverity.Hint,
    category: "best-practice"
  },
  // Security rules
  "ISL1020": {
    id: "ISL1020",
    name: "sensitive-field-unprotected",
    description: "Potentially sensitive field should have constraints",
    severity: DiagnosticSeverity.Warning,
    category: "security"
  },
  "ISL1021": {
    id: "ISL1021",
    name: "no-authentication",
    description: "State-modifying behavior has no security requirements",
    severity: DiagnosticSeverity.Hint,
    category: "security"
  },
  // Performance rules
  "ISL1030": {
    id: "ISL1030",
    name: "unbounded-list",
    description: "List type without size constraint may cause performance issues",
    severity: DiagnosticSeverity.Hint,
    category: "performance"
  },
  "ISL1031": {
    id: "ISL1031",
    name: "missing-pagination",
    description: "Behavior returning a list should consider pagination",
    severity: DiagnosticSeverity.Hint,
    category: "performance"
  }
};
var ISLSemanticLinter = class {
  enabledRules = new Set(Object.keys(LINT_RULES));
  /**
   * Enable/disable specific rules
   */
  configureRules(enabled, disabled) {
    for (const rule of enabled) {
      this.enabledRules.add(rule);
    }
    for (const rule of disabled) {
      this.enabledRules.delete(rule);
    }
  }
  /**
   * Lint a domain and return all diagnostics
   */
  lint(domain, filePath) {
    const diagnostics = [];
    diagnostics.push(...this.lintBehaviors(domain, filePath));
    diagnostics.push(...this.lintEntities(domain, filePath));
    diagnostics.push(...this.lintTypes(domain, filePath));
    diagnostics.push(...this.lintScenarios(domain, filePath));
    diagnostics.push(...this.lintSecurity(domain, filePath));
    return diagnostics.filter((d) => this.enabledRules.has(d.code || ""));
  }
  // ============================================================================
  // Behavior Linting
  // ============================================================================
  lintBehaviors(domain, _filePath) {
    const diagnostics = [];
    const behaviorsWithScenarios = /* @__PURE__ */ new Set();
    for (const scenarioBlock of domain.scenarios) {
      behaviorsWithScenarios.add(scenarioBlock.behaviorName.name);
    }
    for (const behavior of domain.behaviors) {
      if (behavior.postconditions.length === 0) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1001"],
          `Behavior '${behavior.name.name}' has no postconditions`,
          behavior.name.location,
          {
            type: "missing-postcondition",
            behaviorName: behavior.name.name,
            behaviorLocation: behavior.location
          }
        ));
      }
      if (behavior.preconditions.length > 0 && behavior.output.errors.length === 0) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1002"],
          `Behavior '${behavior.name.name}' has preconditions but no error cases defined`,
          behavior.name.location,
          {
            type: "precondition-without-error",
            behaviorName: behavior.name.name,
            preconditionCount: behavior.preconditions.length
          }
        ));
      }
      if (!behavior.description) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1010"],
          `Behavior '${behavior.name.name}' should have a description`,
          behavior.name.location,
          {
            type: "missing-description",
            behaviorName: behavior.name.name
          }
        ));
      }
      if (this.isStateMutating(behavior) && behavior.temporal.length === 0) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1012"],
          `Behavior '${behavior.name.name}' modifies state but has no temporal constraints`,
          behavior.name.location,
          {
            type: "mutable-behavior-no-temporal",
            behaviorName: behavior.name.name
          }
        ));
      }
      if (!behaviorsWithScenarios.has(behavior.name.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1013"],
          `Behavior '${behavior.name.name}' has no test scenarios defined`,
          behavior.name.location,
          {
            type: "no-scenarios",
            behaviorName: behavior.name.name
          }
        ));
      }
      if (this.isStateMutating(behavior) && (!behavior.security || behavior.security.length === 0)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1021"],
          `Behavior '${behavior.name.name}' modifies state but has no security requirements`,
          behavior.name.location,
          {
            type: "no-authentication",
            behaviorName: behavior.name.name
          }
        ));
      }
      if (this.returnsList(behavior) && !this.hasPagination(behavior)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1031"],
          `Behavior '${behavior.name.name}' returns a list - consider adding pagination`,
          behavior.output.location,
          {
            type: "missing-pagination",
            behaviorName: behavior.name.name
          }
        ));
      }
    }
    return diagnostics;
  }
  // ============================================================================
  // Entity Linting
  // ============================================================================
  lintEntities(domain, _filePath) {
    const diagnostics = [];
    for (const entity of domain.entities) {
      const hasId = entity.fields.some(
        (f) => f.name.name === "id" || f.name.name.toLowerCase().endsWith("id")
      );
      if (!hasId) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1011"],
          `Entity '${entity.name.name}' should have an 'id' field for identification`,
          entity.name.location,
          {
            type: "entity-without-id",
            entityName: entity.name.name,
            fields: entity.fields.map((f) => f.name.name)
          }
        ));
      }
      for (const field of entity.fields) {
        if (this.isSensitiveFieldName(field.name.name)) {
          const hasConstraints = this.fieldHasConstraints(field);
          if (!hasConstraints) {
            diagnostics.push(this.createDiagnostic(
              LINT_RULES["ISL1020"],
              `Field '${field.name.name}' appears sensitive and should have constraints`,
              field.name.location,
              {
                type: "sensitive-field-unprotected",
                fieldName: field.name.name,
                entityName: entity.name.name,
                suggestedConstraints: this.suggestConstraints(field.name.name)
              }
            ));
          }
        }
      }
    }
    return diagnostics;
  }
  // ============================================================================
  // Type Linting
  // ============================================================================
  lintTypes(domain, _filePath) {
    const diagnostics = [];
    const usedTypes = this.collectUsedTypes(domain);
    for (const type of domain.types) {
      if (!usedTypes.has(type.name.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1003"],
          `Type '${type.name.name}' is defined but never used`,
          type.name.location,
          {
            type: "unused-type",
            typeName: type.name.name
          }
        ));
      }
      if (this.isUnboundedList(type)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1030"],
          `Type '${type.name.name}' is an unbounded list - consider adding max_size constraint`,
          type.name.location,
          {
            type: "unbounded-list",
            typeName: type.name.name
          }
        ));
      }
    }
    return diagnostics;
  }
  // ============================================================================
  // Scenario Linting
  // ============================================================================
  lintScenarios(domain, _filePath) {
    const diagnostics = [];
    const behaviorNames = new Set(domain.behaviors.map((b) => b.name.name));
    for (const scenarioBlock of domain.scenarios) {
      if (!behaviorNames.has(scenarioBlock.behaviorName.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1004"],
          `Scenarios reference undefined behavior '${scenarioBlock.behaviorName.name}'`,
          scenarioBlock.behaviorName.location,
          {
            type: "undefined-behavior-reference",
            behaviorName: scenarioBlock.behaviorName.name,
            availableBehaviors: Array.from(behaviorNames)
          }
        ));
      }
    }
    for (const chaosBlock of domain.chaos) {
      if (!behaviorNames.has(chaosBlock.behaviorName.name)) {
        diagnostics.push(this.createDiagnostic(
          LINT_RULES["ISL1004"],
          `Chaos tests reference undefined behavior '${chaosBlock.behaviorName.name}'`,
          chaosBlock.behaviorName.location,
          {
            type: "undefined-behavior-reference",
            behaviorName: chaosBlock.behaviorName.name,
            availableBehaviors: Array.from(behaviorNames)
          }
        ));
      }
    }
    return diagnostics;
  }
  // ============================================================================
  // Security Linting
  // ============================================================================
  lintSecurity(domain, _filePath) {
    return [];
  }
  // ============================================================================
  // Helper Methods
  // ============================================================================
  createDiagnostic(rule, message, location, data, relatedInfo) {
    return {
      message,
      severity: rule.severity,
      location,
      code: rule.id,
      source: "isl-semantic-linter",
      data,
      relatedInfo
    };
  }
  isStateMutating(behavior) {
    const name = behavior.name.name.toLowerCase();
    const mutatingPatterns = [
      "create",
      "update",
      "delete",
      "remove",
      "add",
      "set",
      "modify",
      "change",
      "assign",
      "reset",
      "clear"
    ];
    return mutatingPatterns.some((p) => name.includes(p));
  }
  returnsList(behavior) {
    const output = behavior.output.success;
    return output.kind === "ListType";
  }
  hasPagination(behavior) {
    const paginationFields = ["page", "limit", "offset", "cursor", "pagesize", "pagenumber"];
    return behavior.input.fields.some(
      (f) => paginationFields.includes(f.name.name.toLowerCase())
    );
  }
  isSensitiveFieldName(name) {
    const sensitivePatterns = [
      "password",
      "secret",
      "token",
      "key",
      "credential",
      "ssn",
      "social_security",
      "credit_card",
      "cc_number",
      "api_key",
      "auth",
      "private"
    ];
    const lower = name.toLowerCase();
    return sensitivePatterns.some((p) => lower.includes(p));
  }
  fieldHasConstraints(field) {
    const type = field.type;
    return type?.kind === "ConstrainedType";
  }
  suggestConstraints(fieldName) {
    const lower = fieldName.toLowerCase();
    if (lower.includes("password")) {
      return ["min_length: 8", 'pattern: "^(?=.*[A-Za-z])(?=.*\\d).+"'];
    }
    if (lower.includes("email")) {
      return ['format: "email"'];
    }
    if (lower.includes("token") || lower.includes("key")) {
      return ["immutable: true"];
    }
    return ["encrypted: true"];
  }
  collectUsedTypes(domain) {
    const usedTypes = /* @__PURE__ */ new Set();
    const collectFromType = (typeDef) => {
      if (!typeDef || typeof typeDef !== "object") return;
      const t = typeDef;
      if (t.kind === "ReferenceType" && t.name && typeof t.name === "object") {
        const name = t.name;
        if (name.parts && name.parts.length > 0 && name.parts[0]) {
          usedTypes.add(name.parts[0].name);
        }
      }
      if (t.element) collectFromType(t.element);
      if (t.key) collectFromType(t.key);
      if (t.value) collectFromType(t.value);
      if (t.inner) collectFromType(t.inner);
      if (t.base) collectFromType(t.base);
    };
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        collectFromType(field.type);
      }
    }
    for (const behavior of domain.behaviors) {
      for (const field of behavior.input.fields) {
        collectFromType(field.type);
      }
      collectFromType(behavior.output.success);
    }
    for (const type of domain.types) {
      if (type.definition.kind === "StructType") {
        for (const field of type.definition.fields) {
          collectFromType(field.type);
        }
      } else if (type.definition.kind === "ConstrainedType") {
        collectFromType(type.definition.base);
      }
    }
    return usedTypes;
  }
  isUnboundedList(type) {
    const def = type.definition;
    if (def.kind !== "ConstrainedType") return false;
    const base = def.base;
    if (base.kind !== "ListType") return false;
    const hasMaxSize = def.constraints.some(
      (c) => c.name === "max_size" || c.name === "max_length"
    );
    return !hasMaxSize;
  }
};

// src/features/diagnostics.ts
var ISLDiagnosticsProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
    this.importResolver = new ISLImportResolver();
    this.semanticLinter = new ISLSemanticLinter();
  }
  importResolver;
  semanticLinter;
  options = {
    resolveImports: true,
    semanticLinting: true,
    disabledRules: []
  };
  /**
   * Configure diagnostics options
   */
  configure(options) {
    this.options = { ...this.options, ...options };
    if (options.disabledRules) {
      this.semanticLinter.configureRules([], options.disabledRules);
    }
  }
  /**
   * Get disabled rules
   */
  getDisabledRules() {
    return this.options.disabledRules || [];
  }
  /**
   * Get the import resolver (for testing)
   */
  getImportResolver() {
    return this.importResolver;
  }
  /**
   * Get the semantic linter (for testing)
   */
  getSemanticLinter() {
    return this.semanticLinter;
  }
  /**
   * Get diagnostics for a document
   * This method returns LSP-compatible diagnostics
   */
  provideDiagnostics(document) {
    this.documentManager.updateDocument(document, true);
    const islDiagnostics = this.documentManager.getDiagnostics(document.uri);
    let diagnostics = islDiagnostics.map((d) => this.convertDiagnostic(d, document.uri));
    if (this.options.semanticLinting) {
      const parsed = this.documentManager.getDocument(document.uri);
      if (parsed?.domain) {
        const lintDiagnostics = this.semanticLinter.lint(parsed.domain, document.uri);
        const lintConverted = lintDiagnostics.map((d) => this.convertDiagnostic(d, document.uri));
        diagnostics = this.deduplicateDiagnostics([...diagnostics, ...lintConverted]);
      }
    }
    const disabledRules = this.options.disabledRules || [];
    if (disabledRules.length > 0) {
      diagnostics = diagnostics.filter(
        (d) => !d.code || !disabledRules.includes(String(d.code))
      );
    }
    return diagnostics;
  }
  /**
   * Deduplicate diagnostics, preferring ones with data field
   */
  deduplicateDiagnostics(diagnostics) {
    const byKey = /* @__PURE__ */ new Map();
    for (const d of diagnostics) {
      const key = `${d.code}:${d.range.start.line}:${d.range.start.character}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, d);
      } else {
        if (d.data && !existing.data) {
          byKey.set(key, d);
        }
      }
    }
    return Array.from(byKey.values());
  }
  /**
   * Get diagnostics with import resolution (async)
   * Returns both diagnostics and import resolution info
   */
  async provideDiagnosticsWithImports(document) {
    const diagnostics = this.provideDiagnostics(document);
    if (!this.options.resolveImports) {
      return { diagnostics };
    }
    const parsed = this.documentManager.getDocument(document.uri);
    if (!parsed?.domain) {
      return { diagnostics };
    }
    const importResolution = await this.importResolver.resolveImports(
      document.uri,
      parsed.domain
    );
    for (const importDiag of importResolution.diagnostics) {
      diagnostics.push(this.convertDiagnostic(importDiag, document.uri));
    }
    return {
      diagnostics,
      importResolution
    };
  }
  /**
   * Validate type references against imported symbols
   * Returns diagnostics for types that reference imported symbols
   */
  validateImportedReferences(document, importedSymbols) {
    const diagnostics = [];
    const parsed = this.documentManager.getDocument(document.uri);
    if (!parsed?.domain) return diagnostics;
    const usedImports = /* @__PURE__ */ new Set();
    for (const entity of parsed.domain.entities) {
      for (const field of entity.fields) {
        this.checkTypeReference(field.type, importedSymbols, usedImports, diagnostics, document.uri);
      }
    }
    for (const behavior of parsed.domain.behaviors) {
      for (const field of behavior.input.fields) {
        this.checkTypeReference(field.type, importedSymbols, usedImports, diagnostics, document.uri);
      }
      this.checkTypeReference(behavior.output.success, importedSymbols, usedImports, diagnostics, document.uri);
    }
    for (const [name, symbol] of importedSymbols) {
      if (!usedImports.has(name)) {
        const importLocation = this.findImportLocation(parsed.domain, name);
        if (importLocation) {
          diagnostics.push({
            range: ISLDocumentManager.toRange(importLocation),
            message: `Imported '${name}' is never used`,
            severity: DiagnosticSeverity$1.Hint,
            code: "ISL2003",
            source: "isl-import-resolver",
            data: {
              type: "unused-import",
              symbolName: name,
              originalName: symbol.name
            }
          });
        }
      }
    }
    return diagnostics;
  }
  /**
   * Check a type reference for imported symbol usage
   */
  checkTypeReference(typeDef, importedSymbols, usedImports, _diagnostics, _uri) {
    if (!typeDef || typeof typeDef !== "object") return;
    const t = typeDef;
    if (t.kind === "ReferenceType" && t.name && typeof t.name === "object") {
      const name = t.name;
      if (name.parts && name.parts.length > 0) {
        const part = name.parts[0];
        if (part && importedSymbols.has(part.name)) {
          usedImports.add(part.name);
        }
      }
    }
    if (t.element) this.checkTypeReference(t.element, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.key) this.checkTypeReference(t.key, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.value) this.checkTypeReference(t.value, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.inner) this.checkTypeReference(t.inner, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.base) this.checkTypeReference(t.base, importedSymbols, usedImports, _diagnostics, _uri);
  }
  /**
   * Find the import location for a symbol name
   */
  findImportLocation(domain, name) {
    for (const imp of domain.imports) {
      for (const item of imp.items) {
        const importedName = item.alias?.name || item.name.name;
        if (importedName === name) {
          return item.alias?.location || item.name.location;
        }
      }
    }
    return void 0;
  }
  /**
   * Convert ISL diagnostic to LSP diagnostic
   */
  convertDiagnostic(d, documentUri) {
    const relatedInfo = d.relatedInfo?.map((r) => ({
      location: {
        uri: r.location.file !== d.location.file ? this.toFileUri(r.location.file) : documentUri,
        range: ISLDocumentManager.toRange(r.location)
      },
      message: r.message
    }));
    return {
      range: ISLDocumentManager.toRange(d.location),
      message: d.message,
      severity: d.severity,
      code: d.code,
      source: d.source,
      relatedInformation: relatedInfo,
      data: d.data
    };
  }
  /**
   * Convert file path to URI if needed
   */
  toFileUri(filePath) {
    if (filePath.startsWith("file://")) {
      return filePath;
    }
    return `file://${filePath.replace(/\\/g, "/")}`;
  }
};

// src/features/definition.ts
var ISLDefinitionProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
  }
  provideDefinition(document, position) {
    const word = this.documentManager.getWordAtPosition(document, position);
    if (!word) return null;
    if (this.isBuiltinType(word)) {
      return null;
    }
    const symbol = this.documentManager.findSymbol(word);
    if (symbol) {
      return {
        uri: symbol.uri,
        range: {
          start: {
            line: symbol.selectionLocation.line - 1,
            character: symbol.selectionLocation.column - 1
          },
          end: {
            line: symbol.selectionLocation.endLine - 1,
            character: symbol.selectionLocation.endColumn - 1
          }
        }
      };
    }
    const docSymbols = this.documentManager.getSymbols(document.uri);
    const found = this.findSymbolByName(docSymbols, word);
    if (found) {
      return {
        uri: document.uri,
        range: {
          start: {
            line: found.selectionLocation.line - 1,
            character: found.selectionLocation.column - 1
          },
          end: {
            line: found.selectionLocation.endLine - 1,
            character: found.selectionLocation.endColumn - 1
          }
        }
      };
    }
    return null;
  }
  isBuiltinType(name) {
    const builtins = /* @__PURE__ */ new Set([
      "String",
      "Int",
      "Decimal",
      "Boolean",
      "UUID",
      "Timestamp",
      "Duration",
      "Date",
      "Time",
      "List",
      "Map",
      "Set",
      "Optional",
      "Any"
    ]);
    return builtins.has(name);
  }
  findSymbolByName(symbols, name) {
    for (const sym of symbols) {
      if (sym.name === name) return sym;
      if (sym.children) {
        const found = this.findSymbolByName(sym.children, name);
        if (found) return found;
      }
    }
    return void 0;
  }
};

// src/features/symbols.ts
var ISLSymbolProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
  }
  provideSymbols(document) {
    this.documentManager.updateDocument(document, true);
    const symbols = this.documentManager.getSymbols(document.uri);
    return symbols.map((sym) => this.convertSymbol(sym));
  }
  convertSymbol(sym) {
    return {
      name: sym.name,
      kind: sym.kind,
      range: this.toRange(sym.location),
      selectionRange: this.toRange(sym.selectionLocation),
      detail: sym.detail,
      children: sym.children?.map((child) => this.convertSymbol(child))
    };
  }
  toRange(loc) {
    return {
      start: { line: loc.line - 1, character: loc.column - 1 },
      end: { line: loc.endLine - 1, character: loc.endColumn - 1 }
    };
  }
};

// src/features/semantic-tokens.ts
var TOKEN_TYPES = [
  "namespace",
  "type",
  "class",
  "enum",
  "interface",
  "struct",
  "typeParameter",
  "parameter",
  "variable",
  "property",
  "enumMember",
  "function",
  "method",
  "keyword",
  "modifier",
  "comment",
  "string",
  "number",
  "regexp",
  "operator",
  "decorator"
];
var TOKEN_MODIFIERS = [
  "declaration",
  "definition",
  "readonly",
  "static",
  "deprecated",
  "abstract",
  "async",
  "modification",
  "documentation",
  "defaultLibrary"
];
var KEYWORDS = /* @__PURE__ */ new Set([
  "domain",
  "entity",
  "behavior",
  "type",
  "invariant",
  "policy",
  "view",
  "scenario",
  "input",
  "output",
  "pre",
  "post",
  "error",
  "lifecycle",
  "temporal",
  "security",
  "version",
  "description",
  "forall",
  "exists",
  "implies",
  "and",
  "or",
  "not",
  "old",
  "result",
  "true",
  "false",
  "null",
  "given",
  "when",
  "then"
]);
var BUILTIN_TYPES2 = /* @__PURE__ */ new Set([
  "String",
  "Int",
  "Boolean",
  "UUID",
  "Timestamp",
  "Decimal",
  "Duration",
  "Date",
  "Time",
  "List",
  "Map",
  "Set",
  "Optional"
]);
var ISLSemanticTokensProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
  }
  provideTokens(document) {
    const tokens = [];
    const text = document.getText();
    const lines = text.split("\n");
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      this.tokenizeLine(line, lineNum, tokens);
    }
    return tokens;
  }
  tokenizeLine(line, lineNum, tokens) {
    const commentMatch = line.match(/\/\/.*/);
    if (commentMatch) {
      const start = line.indexOf("//");
      tokens.push({
        line: lineNum,
        startChar: start,
        length: line.length - start,
        tokenType: "comment",
        tokenModifiers: []
      });
      return;
    }
    const stringRegex = /"[^"]*"/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(line)) !== null) {
      tokens.push({
        line: lineNum,
        startChar: stringMatch.index,
        length: stringMatch[0].length,
        tokenType: "string",
        tokenModifiers: []
      });
    }
    const numberRegex = /\b\d+(\.\d+)?\b/g;
    let numberMatch;
    while ((numberMatch = numberRegex.exec(line)) !== null) {
      tokens.push({
        line: lineNum,
        startChar: numberMatch.index,
        length: numberMatch[0].length,
        tokenType: "number",
        tokenModifiers: []
      });
    }
    const annotationRegex = /@\w+/g;
    let annotationMatch;
    while ((annotationMatch = annotationRegex.exec(line)) !== null) {
      tokens.push({
        line: lineNum,
        startChar: annotationMatch.index,
        length: annotationMatch[0].length,
        tokenType: "decorator",
        tokenModifiers: []
      });
    }
    const wordRegex = /\b[a-zA-Z_]\w*\b/g;
    let wordMatch;
    while ((wordMatch = wordRegex.exec(line)) !== null) {
      const word = wordMatch[0];
      const startChar = wordMatch.index;
      if (this.isInString(line, startChar)) continue;
      if (KEYWORDS.has(word)) {
        tokens.push({
          line: lineNum,
          startChar,
          length: word.length,
          tokenType: "keyword",
          tokenModifiers: []
        });
      } else if (BUILTIN_TYPES2.has(word)) {
        tokens.push({
          line: lineNum,
          startChar,
          length: word.length,
          tokenType: "type",
          tokenModifiers: ["defaultLibrary"]
        });
      } else if (/^[A-Z]/.test(word)) {
        const beforeWord = line.substring(0, startChar).trim();
        if (beforeWord.endsWith("entity") || beforeWord.endsWith("type")) {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: "class",
            tokenModifiers: ["declaration"]
          });
        } else if (beforeWord.endsWith("behavior")) {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: "function",
            tokenModifiers: ["declaration"]
          });
        } else if (beforeWord.endsWith(":") || beforeWord.endsWith("<") || beforeWord.endsWith(",")) {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: "type",
            tokenModifiers: []
          });
        } else {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: "class",
            tokenModifiers: []
          });
        }
      } else if (line.includes(":") && startChar < line.indexOf(":")) {
        tokens.push({
          line: lineNum,
          startChar,
          length: word.length,
          tokenType: "property",
          tokenModifiers: []
        });
      }
    }
  }
  isInString(line, position) {
    let inString = false;
    for (let i = 0; i < position; i++) {
      if (line[i] === '"' && (i === 0 || line[i - 1] !== "\\")) {
        inString = !inString;
      }
    }
    return inString;
  }
};
var ISLCodeActionProvider = class {
  constructor(documentManager) {
    this.documentManager = documentManager;
  }
  provideCodeActions(document, range, context) {
    const actions = [];
    const text = document.getText();
    const lines = text.split("\n");
    for (const diagnostic of context.diagnostics) {
      const data = diagnostic.data;
      if (diagnostic.code === "ISL1001") {
        const behaviorName = data?.behaviorName || this.extractBehaviorName(lines, diagnostic.range.start.line);
        if (behaviorName) {
          actions.push(this.createAddPostconditionAction(document, diagnostic.range, behaviorName));
        }
      }
      if (diagnostic.code === "ISL1002" && data?.behaviorName) {
        actions.push(this.createAddErrorCaseForPreconditionAction(document, diagnostic.range, data.behaviorName));
      }
      if (diagnostic.code === "ISL1003" && data?.typeName) {
        actions.push(this.createRemoveUnusedTypeAction(document, diagnostic.range, data.typeName));
      }
      if (diagnostic.code === "ISL1004" && data?.availableBehaviors) {
        for (const behavior of data.availableBehaviors.slice(0, 3)) {
          actions.push(this.createRenameToBehaviorAction(document, diagnostic.range, data.behaviorName || "", behavior));
        }
      }
      if (diagnostic.code === "ISL1010" && data?.behaviorName) {
        actions.push(this.createAddDescriptionAction(document, diagnostic.range, data.behaviorName));
      }
      if (diagnostic.code === "ISL1011" && data?.entityName) {
        actions.push(this.createAddIdFieldAction(document, diagnostic.range, data.entityName));
      }
      if (diagnostic.code === "ISL1012" && data?.behaviorName) {
        actions.push(this.createAddTemporalAction(document, diagnostic.range, data.behaviorName));
      }
      if (diagnostic.code === "ISL1013" && data?.behaviorName) {
        actions.push(this.createGenerateScenarioAction(document, data.behaviorName, diagnostic.range));
      }
      if (diagnostic.code === "ISL1020" && data?.suggestedConstraints) {
        actions.push(this.createAddConstraintsAction(document, diagnostic.range, data.fieldName || "", data.suggestedConstraints));
      }
      if (diagnostic.code === "ISL1021" && data?.behaviorName) {
        actions.push(this.createAddSecurityAction(document, diagnostic.range, data.behaviorName));
      }
      if (diagnostic.code === "ISL1030" && data?.typeName) {
        actions.push(this.createAddMaxSizeAction(document, diagnostic.range, data.typeName));
      }
      if (diagnostic.code === "ISL1031" && data?.behaviorName) {
        actions.push(this.createAddPaginationAction(document, diagnostic.range, data.behaviorName));
      }
      if (diagnostic.code === "ISL2001") {
        actions.push(this.createFileAction(document, diagnostic));
      }
      if (diagnostic.code === "ISL2002" && data?.availableExports) {
        for (const exp of data.availableExports.slice(0, 3)) {
          actions.push(this.createReplaceImportAction(document, diagnostic.range, data.symbolName || "", exp));
        }
      }
      if (diagnostic.code === "ISL2003") {
        actions.push(this.createRemoveImportAction(document, diagnostic.range, data?.symbolName || ""));
      }
      if (diagnostic.code === "ISL002" || diagnostic.message.includes("Unknown type")) {
        const typeName = this.extractTypeName(diagnostic.message);
        if (typeName) {
          actions.push(this.createDefineTypeAction(document, typeName));
        }
      }
      if (diagnostic.code === "ISL009") {
        const name = this.getWordAtRange(lines, diagnostic.range);
        if (name) {
          actions.push(this.createRenameToUppercaseAction(document, diagnostic.range, name));
        }
      }
      if (diagnostic.code === "ISL010") {
        const name = this.getWordAtRange(lines, diagnostic.range);
        if (name) {
          actions.push(this.createRenameToLowercaseAction(document, diagnostic.range, name));
        }
      }
    }
    const lineText = lines[range.start.line] || "";
    const trimmed = lineText.trim();
    if (this.isInBehavior(lines, range.start.line)) {
      const behaviorName = this.extractBehaviorName(lines, range.start.line);
      if (behaviorName) {
        actions.push(this.createGenerateScenarioAction(document, behaviorName, range));
      }
    }
    if (trimmed.startsWith("output") || this.isInOutput(lines, range.start.line)) {
      actions.push(this.createAddErrorCaseAction(document, range));
    }
    if (trimmed.match(/^entity\s+\w+/)) {
      const entityName = trimmed.match(/^entity\s+(\w+)/)?.[1];
      if (entityName) {
        actions.push(this.createGenerateCrudBehaviorsAction(document, entityName, range));
      }
    }
    return actions;
  }
  // ============================================================================
  // Quick Fix Actions
  // ============================================================================
  createAddPostconditionAction(document, range, behaviorName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line;
    let braceDepth = 0;
    let foundBehavior = false;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes("behavior " + behaviorName)) foundBehavior = true;
      if (foundBehavior) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && foundBehavior) {
          insertLine = i;
          break;
        }
      }
    }
    const indent = "  ";
    const postconditionBlock = `
${indent}postconditions {
${indent}${indent}success implies {
${indent}${indent}${indent}// Add postcondition assertions here
${indent}${indent}}
${indent}}
`;
    return {
      title: "Add postconditions block",
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: insertLine, character: 0 },
              postconditionBlock
            )
          ]
        }
      }
    };
  }
  createDefineTypeAction(document, typeName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = 2;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.trim().startsWith("entity ") || line.trim().startsWith("behavior ")) {
        insertLine = i;
        break;
      }
      if (line.trim().startsWith("type ") || line.trim().startsWith("enum ")) {
        insertLine = i + 1;
      }
    }
    const typeDefinition = `
  type ${typeName} = String {
    // Add constraints
  }
`;
    return {
      title: `Define type '${typeName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, typeDefinition)
          ]
        }
      }
    };
  }
  createRenameToUppercaseAction(document, range, name) {
    const newName = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      title: `Rename to '${newName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, newName)]
        }
      }
    };
  }
  createRenameToLowercaseAction(document, range, name) {
    const newName = name.charAt(0).toLowerCase() + name.slice(1);
    return {
      title: `Rename to '${newName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, newName)]
        }
      }
    };
  }
  // ============================================================================
  // Refactoring Actions
  // ============================================================================
  createGenerateScenarioAction(document, behaviorName, range) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] || "";
      if (line.trim() === "}") {
        insertLine = i;
        break;
      }
    }
    const scenarioBlock = `
  scenarios ${behaviorName} {
    scenario "Successful ${behaviorName}" {
      given {
        // Setup initial state
      }

      when {
        ${behaviorName}(/* params */)
      }

      then {
        result != null
      }
    }

    scenario "${behaviorName} with invalid input" {
      given {
        // Setup state for error case
      }

      when {
        ${behaviorName}(/* invalid params */)
      }

      then {
        // Error was returned
      }
    }
  }
`;
    return {
      title: `Generate test scenarios for ${behaviorName}`,
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, scenarioBlock)
          ]
        }
      }
    };
  }
  createAddErrorCaseAction(document, range) {
    const errorCase = `
      ERROR_NAME {
        when: "Error description"
        retriable: false
      }`;
    return {
      title: "Add error case",
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: range.start.line + 1, character: 0 },
              errorCase
            )
          ]
        }
      }
    };
  }
  createGenerateCrudBehaviorsAction(document, entityName, range) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] || "";
      if (line.trim() === "}") {
        insertLine = i;
        break;
      }
    }
    const crudBehaviors = `
  behavior Create${entityName} {
    description: "Create a new ${entityName}"

    input {
      // Add input fields from ${entityName}
    }

    output {
      success: ${entityName}

      errors {
        VALIDATION_ERROR {
          when: "Input validation failed"
          retriable: true
        }
      }
    }

    preconditions {
      // Add preconditions
    }

    postconditions {
      success implies {
        ${entityName}.exists(result.id)
      }
    }
  }

  behavior Get${entityName} {
    description: "Get ${entityName} by ID"

    input {
      id: UUID
    }

    output {
      success: ${entityName}

      errors {
        NOT_FOUND {
          when: "${entityName} does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      id != null
    }

    postconditions {
      success implies {
        result.id == input.id
      }
    }
  }

  behavior Update${entityName} {
    description: "Update an existing ${entityName}"

    input {
      id: UUID
      // Add updatable fields
    }

    output {
      success: ${entityName}

      errors {
        NOT_FOUND {
          when: "${entityName} does not exist"
          retriable: false
        }
        VALIDATION_ERROR {
          when: "Input validation failed"
          retriable: true
        }
      }
    }

    preconditions {
      ${entityName}.exists(input.id)
    }

    postconditions {
      success implies {
        ${entityName}.lookup(input.id) == result
      }
    }
  }

  behavior Delete${entityName} {
    description: "Delete a ${entityName}"

    input {
      id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "${entityName} does not exist"
          retriable: false
        }
      }
    }

    preconditions {
      ${entityName}.exists(input.id)
    }

    postconditions {
      success implies {
        not ${entityName}.exists(input.id)
      }
    }
  }
`;
    return {
      title: `Generate CRUD behaviors for ${entityName}`,
      kind: CodeActionKind.Refactor,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, crudBehaviors)
          ]
        }
      }
    };
  }
  // ============================================================================
  // New Quick Fix Actions for Semantic Linter
  // ============================================================================
  createAddErrorCaseForPreconditionAction(document, range, behaviorName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line;
    let inBehavior = false;
    let inOutput = false;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior) {
        if (line.trim() === "output {") inOutput = true;
        if (inOutput) {
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          if (braceDepth === 0) {
            insertLine = i;
            break;
          }
        }
      }
    }
    const errorBlock = `
      errors {
        PRECONDITION_FAILED {
          when: "Precondition not met"
          retriable: false
        }
      }
`;
    return {
      title: "Add error case for precondition failure",
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, errorBlock)
          ]
        }
      }
    };
  }
  createRemoveUnusedTypeAction(document, range, typeName) {
    const text = document.getText();
    const lines = text.split("\n");
    let startLine = range.start.line;
    let endLine = range.start.line;
    let braceDepth = 0;
    let found = false;
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i] || "";
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (braceDepth === 0 && found) {
        endLine = i;
        break;
      }
      if (braceDepth > 0) found = true;
    }
    return {
      title: `Remove unused type '${typeName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.del({
              start: { line: startLine, character: 0 },
              end: { line: endLine + 1, character: 0 }
            })
          ]
        }
      }
    };
  }
  createRenameToBehaviorAction(document, range, currentName, targetName) {
    return {
      title: `Change to '${targetName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, targetName)]
        }
      }
    };
  }
  createAddDescriptionAction(document, range, behaviorName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line + 1;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes(`behavior ${behaviorName}`) && line.includes("{")) {
        insertLine = i + 1;
        break;
      }
    }
    return {
      title: `Add description to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: insertLine, character: 0 },
              `    description: "TODO: Add description for ${behaviorName}"

`
            )
          ]
        }
      }
    };
  }
  createAddIdFieldAction(document, range, entityName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line + 1;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes(`entity ${entityName}`) && line.includes("{")) {
        insertLine = i + 1;
        break;
      }
    }
    return {
      title: `Add 'id' field to '${entityName}'`,
      kind: CodeActionKind.QuickFix,
      isPreferred: true,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert(
              { line: insertLine, character: 0 },
              `    id: UUID
`
            )
          ]
        }
      }
    };
  }
  createAddTemporalAction(document, range, behaviorName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line;
    let braceDepth = 0;
    let inBehavior = false;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && inBehavior) {
          insertLine = i;
          break;
        }
      }
    }
    const temporalBlock = `
    temporal {
      response within 500.ms (p99)
    }
`;
    return {
      title: `Add temporal constraints to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, temporalBlock)
          ]
        }
      }
    };
  }
  createAddConstraintsAction(document, range, fieldName, suggestedConstraints) {
    const text = document.getText();
    const lines = text.split("\n");
    const line = lines[range.start.line] || "";
    const match = line.match(/:\s*(\w+)/);
    if (!match) {
      return {
        title: `Add constraints to '${fieldName}'`,
        kind: CodeActionKind.QuickFix,
        edit: { changes: {} }
      };
    }
    const constraints = suggestedConstraints.join(", ");
    const newLine = line.replace(
      /:\s*(\w+)/,
      `: $1 { ${constraints} }`
    );
    return {
      title: `Add security constraints to '${fieldName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.replace(
              {
                start: { line: range.start.line, character: 0 },
                end: { line: range.start.line, character: line.length }
              },
              newLine
            )
          ]
        }
      }
    };
  }
  createAddSecurityAction(document, range, behaviorName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line;
    let braceDepth = 0;
    let inBehavior = false;
    for (let i = range.start.line; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && inBehavior) {
          insertLine = i;
          break;
        }
      }
    }
    const securityBlock = `
    security {
      requires authentication
    }
`;
    return {
      title: `Add security requirements to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, securityBlock)
          ]
        }
      }
    };
  }
  createAddMaxSizeAction(document, range, typeName) {
    const text = document.getText();
    const lines = text.split("\n");
    const line = lines[range.start.line] || "";
    const newLine = line.replace(
      /List<([^>]+)>/,
      "List<$1> { max_size: 1000 }"
    );
    return {
      title: `Add max_size constraint to '${typeName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.replace(
              {
                start: { line: range.start.line, character: 0 },
                end: { line: range.start.line, character: line.length }
              },
              newLine
            )
          ]
        }
      }
    };
  }
  createAddPaginationAction(document, range, behaviorName) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = range.start.line;
    let inBehavior = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      if (line.includes(`behavior ${behaviorName}`)) inBehavior = true;
      if (inBehavior && line.trim() === "input {") {
        insertLine = i + 1;
        break;
      }
    }
    const paginationFields = `      page: Int { min: 1, default: 1 }
      pageSize: Int { min: 1, max: 100, default: 20 }
`;
    return {
      title: `Add pagination to '${behaviorName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.insert({ line: insertLine, character: 0 }, paginationFields)
          ]
        }
      }
    };
  }
  createFileAction(document, diagnostic) {
    return {
      title: "Create missing file",
      kind: CodeActionKind.QuickFix,
      command: {
        title: "Create ISL File",
        command: "isl.createFile",
        arguments: [diagnostic.data]
      }
    };
  }
  createReplaceImportAction(document, range, currentName, targetName) {
    return {
      title: `Import '${targetName}' instead`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [TextEdit.replace(range, targetName)]
        }
      }
    };
  }
  createRemoveImportAction(document, range, symbolName) {
    const text = document.getText();
    const lines = text.split("\n");
    const line = lines[range.start.line] || "";
    const importMatch = line.match(/imports\s*\{([^}]+)\}/);
    if (importMatch) {
      const items = importMatch[1]?.split(",").map((s) => s.trim()) || [];
      if (items.length === 1) {
        return {
          title: `Remove unused import '${symbolName}'`,
          kind: CodeActionKind.QuickFix,
          edit: {
            changes: {
              [document.uri]: [
                TextEdit.del({
                  start: { line: range.start.line, character: 0 },
                  end: { line: range.start.line + 1, character: 0 }
                })
              ]
            }
          }
        };
      }
    }
    return {
      title: `Remove unused import '${symbolName}'`,
      kind: CodeActionKind.QuickFix,
      edit: {
        changes: {
          [document.uri]: [
            TextEdit.replace(range, "")
          ]
        }
      }
    };
  }
  // ============================================================================
  // Helper Methods
  // ============================================================================
  extractBehaviorName(lines, startLine) {
    for (let i = startLine; i >= 0; i--) {
      const match = lines[i]?.match(/^(\s*)behavior\s+(\w+)/);
      if (match) return match[2];
    }
    return void 0;
  }
  extractTypeName(message) {
    const match = message.match(/Unknown type '(\w+)'/);
    return match?.[1];
  }
  getWordAtRange(lines, range) {
    const line = lines[range.start.line];
    if (!line) return void 0;
    return line.substring(range.start.character, range.end.character);
  }
  isInBehavior(lines, lineNum) {
    let braceDepth = 0;
    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i] || "";
      braceDepth += (line.match(/\}/g) || []).length;
      braceDepth -= (line.match(/\{/g) || []).length;
      if (line.match(/^(\s*)behavior\s+\w+/) && braceDepth <= 0) {
        return true;
      }
      if (line.match(/^(\s*)entity\s+\w+/) && braceDepth <= 0) {
        return false;
      }
    }
    return false;
  }
  isInOutput(lines, lineNum) {
    let braceDepth = 0;
    for (let i = lineNum; i >= 0; i--) {
      const line = lines[i] || "";
      braceDepth += (line.match(/\}/g) || []).length;
      braceDepth -= (line.match(/\{/g) || []).length;
      if (line.trim() === "output {" && braceDepth <= 0) {
        return true;
      }
      if (line.trim() === "input {" && braceDepth <= 0) {
        return false;
      }
    }
    return false;
  }
};
var ISLFormattingProvider = class {
  format(document, options) {
    const text = document.getText();
    const formatted = this.formatSource(text, options);
    if (formatted === text) {
      return [];
    }
    return [
      TextEdit.replace(
        {
          start: { line: 0, character: 0 },
          end: document.positionAt(text.length)
        },
        formatted
      )
    ];
  }
  formatSource(source, options) {
    const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "	";
    const lines = source.split("\n");
    const result = [];
    let indentLevel = 0;
    let inComment = false;
    let prevLineWasEmpty = false;
    let prevLineWasOpenBrace = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      const trimmed = line.trim();
      if (result.length === 0 && trimmed === "") {
        continue;
      }
      if (trimmed.startsWith("/*")) inComment = true;
      if (trimmed.endsWith("*/")) inComment = false;
      if (trimmed.startsWith("#") || trimmed.startsWith("//") || inComment) {
        result.push(indent.repeat(indentLevel) + trimmed);
        prevLineWasEmpty = false;
        prevLineWasOpenBrace = false;
        continue;
      }
      if (trimmed.startsWith("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      if (trimmed === "") {
        if (!prevLineWasEmpty && !prevLineWasOpenBrace && result.length > 0) {
          result.push("");
          prevLineWasEmpty = true;
        }
        continue;
      }
      const isTopLevel = this.isTopLevelDeclaration(trimmed);
      if (isTopLevel && result.length > 0 && !prevLineWasEmpty && indentLevel <= 1) {
        const prevLine = result[result.length - 1]?.trim() || "";
        if (prevLine !== "" && prevLine !== "{" && !prevLine.startsWith("#")) {
          result.push("");
        }
      }
      const formattedLine = this.formatLine(trimmed, indentLevel, indent);
      result.push(formattedLine);
      if (trimmed.endsWith("{")) {
        indentLevel++;
        prevLineWasOpenBrace = true;
      } else {
        prevLineWasOpenBrace = false;
      }
      prevLineWasEmpty = false;
    }
    while (result.length > 0 && result[result.length - 1]?.trim() === "") {
      result.pop();
    }
    return result.join("\n") + "\n";
  }
  isTopLevelDeclaration(line) {
    return line.startsWith("entity ") || line.startsWith("behavior ") || line.startsWith("type ") || line.startsWith("enum ") || line.startsWith("invariants ") || line.startsWith("invariant ") || line.startsWith("policy ") || line.startsWith("view ") || line.startsWith("scenarios ") || line.startsWith("chaos ");
  }
  formatLine(line, indentLevel, indent) {
    let formatted = indent.repeat(indentLevel) + line;
    formatted = this.normalizeOperators(formatted);
    formatted = this.normalizeColons(formatted);
    formatted = this.normalizeBraces(formatted);
    formatted = this.normalizeAnnotations(formatted);
    return formatted;
  }
  normalizeOperators(line) {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : "";
    let content = line.trim();
    content = content.replace(/\s*==\s*/g, " == ");
    content = content.replace(/\s*!=\s*/g, " != ");
    content = content.replace(/\s*<=\s*/g, " <= ");
    content = content.replace(/\s*>=\s*/g, " >= ");
    content = content.replace(/\s*<\s*/g, " < ");
    content = content.replace(/\s*>\s*/g, " > ");
    content = content.replace(/\s+and\s+/g, " and ");
    content = content.replace(/\s+or\s+/g, " or ");
    content = content.replace(/\s+implies\s+/g, " implies ");
    content = content.replace(/\s*\+\s*/g, " + ");
    content = content.replace(/\s*-\s*/g, " - ");
    content = content.replace(/\s*\*\s*/g, " * ");
    content = content.replace(/\s*\/\s*/g, " / ");
    content = content.replace(/< /g, "<");
    content = content.replace(/ >/g, ">");
    content = content.replace(/, /g, ", ");
    content = content.replace(/ - > /g, " -> ");
    content = content.replace(/ - (\d)/g, " -$1");
    return indent + content;
  }
  normalizeColons(line) {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : "";
    let content = line.trim();
    content = content.replace(/(\w+)\s*:\s*/g, "$1: ");
    return indent + content;
  }
  normalizeBraces(line) {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : "";
    let content = line.trim();
    content = content.replace(/\s*\{\s*$/, " {");
    content = content.replace(/(\S)\{/g, "$1 {");
    return indent + content;
  }
  normalizeAnnotations(line) {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : "";
    let content = line.trim();
    content = content.replace(/\[\s+/g, "[");
    content = content.replace(/\s+\]/g, "]");
    content = content.replace(/,\s*/g, ", ");
    content = content.replace(/,\s+\]/g, "]");
    return indent + content;
  }
};
var ISLServer = class {
  connection;
  documents;
  documentManager;
  completionProvider;
  hoverProvider;
  diagnosticsProvider;
  definitionProvider;
  symbolProvider;
  semanticTokensProvider;
  codeActionProvider;
  formattingProvider;
  diagnosticTimers = /* @__PURE__ */ new Map();
  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.documentManager = new ISLDocumentManager();
    this.completionProvider = new ISLCompletionProvider(this.documentManager);
    this.hoverProvider = new ISLHoverProvider(this.documentManager);
    this.diagnosticsProvider = new ISLDiagnosticsProvider(this.documentManager);
    this.definitionProvider = new ISLDefinitionProvider(this.documentManager);
    this.symbolProvider = new ISLSymbolProvider(this.documentManager);
    this.semanticTokensProvider = new ISLSemanticTokensProvider(this.documentManager);
    this.codeActionProvider = new ISLCodeActionProvider(this.documentManager);
    this.formattingProvider = new ISLFormattingProvider();
    this.setupHandlers();
  }
  setupHandlers() {
    this.connection.onInitialize((params) => {
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: {
            triggerCharacters: [".", ":", "@", "{", "<"],
            resolveProvider: true
          },
          hoverProvider: true,
          definitionProvider: true,
          documentSymbolProvider: true,
          documentFormattingProvider: true,
          codeActionProvider: {
            codeActionKinds: [
              CodeActionKind$1.QuickFix,
              CodeActionKind$1.Refactor,
              CodeActionKind$1.Source
            ]
          },
          semanticTokensProvider: {
            legend: {
              tokenTypes: TOKEN_TYPES,
              tokenModifiers: TOKEN_MODIFIERS
            },
            full: true
          },
          workspace: {
            workspaceFolders: {
              supported: true
            }
          }
        }
      };
    });
    this.documents.onDidOpen((event) => {
      this.documentManager.updateDocument(event.document, true);
      this.validateDocument(event.document);
    });
    this.documents.onDidChangeContent((change) => {
      this.documentManager.updateDocument(change.document, false);
      this.scheduleValidation(change.document);
    });
    this.documents.onDidSave((event) => {
      const doc = this.documents.get(event.document.uri);
      if (doc) {
        this.documentManager.updateDocument(doc, true);
        this.validateDocument(doc);
      }
    });
    this.documents.onDidClose((event) => {
      this.documentManager.removeDocument(event.document.uri);
      this.clearDiagnostics(event.document.uri);
    });
    this.connection.onCompletion((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];
      const items = this.completionProvider.provideCompletions(document, params.position);
      return items.map((item, index) => ({
        label: item.label,
        kind: this.mapCompletionKind(item.kind),
        detail: item.detail,
        documentation: item.documentation,
        insertText: item.insertText,
        insertTextFormat: item.insertTextFormat === "snippet" ? 2 : 1,
        sortText: item.sortText,
        filterText: item.filterText,
        preselect: item.preselect,
        deprecated: item.deprecated,
        data: index
      }));
    });
    this.connection.onHover((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return null;
      const hover = this.hoverProvider.provideHover(document, params.position);
      if (!hover) return null;
      return {
        contents: {
          kind: "markdown",
          value: hover.contents
        },
        range: hover.range
      };
    });
    this.connection.onDefinition((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return null;
      return this.definitionProvider.provideDefinition(document, params.position);
    });
    this.connection.onDocumentSymbol((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];
      const symbols = this.symbolProvider.provideSymbols(document);
      return symbols.map((sym) => this.mapSymbol(sym));
    });
    this.connection.onCodeAction((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];
      return this.codeActionProvider.provideCodeActions(document, params.range, params.context);
    });
    this.connection.onDocumentFormatting((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return [];
      return this.formattingProvider.format(document, params.options);
    });
    this.connection.languages.semanticTokens.on((params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (!document) return { data: [] };
      const tokens = this.semanticTokensProvider.provideTokens(document);
      const builder = new SemanticTokensBuilder();
      for (const token of tokens) {
        builder.push(
          token.line,
          token.startChar,
          token.length,
          TOKEN_TYPES.indexOf(token.tokenType),
          this.encodeModifiers(token.tokenModifiers)
        );
      }
      return builder.build();
    });
    this.connection.onRequest("isl/validate", (params) => {
      const document = this.documents.get(params.uri);
      if (!document) {
        return { valid: false, errors: ["Document not found"] };
      }
      this.documentManager.updateDocument(document, true);
      const diagnostics = this.documentManager.getDiagnostics(params.uri);
      const errors = diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error).map((d) => d.message);
      return { valid: errors.length === 0, errors };
    });
    this.documents.listen(this.connection);
  }
  scheduleValidation(document) {
    const uri = document.uri;
    const existing = this.diagnosticTimers.get(uri);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.diagnosticTimers.delete(uri);
      const doc = this.documents.get(uri);
      if (doc) {
        this.validateDocument(doc);
      }
    }, 150);
    this.diagnosticTimers.set(uri, timer);
  }
  validateDocument(document) {
    this.documentManager.updateDocument(document, true);
    const diagnostics = this.documentManager.getDiagnostics(document.uri);
    this.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: diagnostics.map((d) => ({
        range: ISLDocumentManager.toRange(d.location),
        message: d.message,
        severity: d.severity,
        code: d.code,
        source: d.source,
        relatedInformation: d.relatedInfo?.map((r) => ({
          location: {
            uri: document.uri,
            range: ISLDocumentManager.toRange(r.location)
          },
          message: r.message
        }))
      }))
    });
  }
  clearDiagnostics(uri) {
    this.connection.sendDiagnostics({ uri, diagnostics: [] });
  }
  mapCompletionKind(kind) {
    switch (kind) {
      case "keyword":
        return CompletionItemKind.Keyword;
      case "type":
        return CompletionItemKind.TypeParameter;
      case "entity":
        return CompletionItemKind.Class;
      case "behavior":
        return CompletionItemKind.Function;
      case "field":
        return CompletionItemKind.Field;
      case "snippet":
        return CompletionItemKind.Snippet;
      case "function":
        return CompletionItemKind.Function;
      case "variable":
        return CompletionItemKind.Variable;
      case "enum":
        return CompletionItemKind.Enum;
      case "property":
        return CompletionItemKind.Property;
      default:
        return CompletionItemKind.Text;
    }
  }
  mapSymbol(sym) {
    return {
      name: sym.name,
      kind: this.mapSymbolKind(sym.kind),
      range: sym.range,
      selectionRange: sym.selectionRange,
      detail: sym.detail,
      children: sym.children?.map((c) => this.mapSymbol(c))
    };
  }
  mapSymbolKind(kind) {
    switch (kind) {
      case "domain":
        return SymbolKind.Namespace;
      case "entity":
        return SymbolKind.Class;
      case "behavior":
        return SymbolKind.Function;
      case "type":
        return SymbolKind.TypeParameter;
      case "enum":
        return SymbolKind.Enum;
      case "invariant":
        return SymbolKind.Interface;
      case "policy":
        return SymbolKind.Interface;
      case "view":
        return SymbolKind.Struct;
      case "field":
        return SymbolKind.Field;
      case "input":
        return SymbolKind.Variable;
      case "output":
        return SymbolKind.Variable;
      case "error":
        return SymbolKind.EnumMember;
      case "lifecycle-state":
        return SymbolKind.EnumMember;
      case "scenario":
        return SymbolKind.Event;
      case "chaos":
        return SymbolKind.Event;
      case "variant":
        return SymbolKind.EnumMember;
      default:
        return SymbolKind.Variable;
    }
  }
  encodeModifiers(modifiers) {
    let result = 0;
    for (const mod of modifiers) {
      const index = TOKEN_MODIFIERS.indexOf(mod);
      if (index >= 0) {
        result |= 1 << index;
      }
    }
    return result;
  }
  start() {
    this.connection.listen();
  }
};

export { ISLCodeActionProvider, ISLCompletionProvider, ISLDefinitionProvider, ISLDiagnosticsProvider, ISLDocumentManager, ISLFormattingProvider, ISLHoverProvider, ISLImportResolver, ISLSemanticLinter, ISLSemanticTokensProvider, ISLServer, ISLSymbolProvider, LINT_RULES, TOKEN_MODIFIERS, TOKEN_TYPES };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map