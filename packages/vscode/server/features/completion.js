"use strict";
// ============================================================================
// ISL Completion Provider
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLCompletionProvider = void 0;
// ISL Keywords
const KEYWORDS = [
    'domain', 'entity', 'behavior', 'type', 'invariant', 'policy', 'view', 'scenario',
    'input', 'output', 'pre', 'post', 'error', 'lifecycle', 'temporal', 'security',
    'version', 'description', 'forall', 'exists', 'implies', 'and', 'or', 'not',
    'old', 'result', 'true', 'false', 'null',
];
// Built-in types
const BUILTIN_TYPES = [
    { name: 'String', doc: 'UTF-8 string value' },
    { name: 'Int', doc: 'Integer value (64-bit)' },
    { name: 'Boolean', doc: 'true or false' },
    { name: 'UUID', doc: 'Universally unique identifier' },
    { name: 'Timestamp', doc: 'Date and time with timezone' },
    { name: 'Decimal', doc: 'Arbitrary precision decimal' },
    { name: 'Duration', doc: 'Time duration' },
    { name: 'Date', doc: 'Calendar date without time' },
    { name: 'Time', doc: 'Time of day without date' },
    { name: 'List', doc: 'Ordered collection: List<T>' },
    { name: 'Map', doc: 'Key-value collection: Map<K, V>' },
    { name: 'Set', doc: 'Unique collection: Set<T>' },
    { name: 'Optional', doc: 'Nullable value: Optional<T>' },
];
// Common annotations
const ANNOTATIONS = [
    { name: '@unique', doc: 'Field must be unique across all instances' },
    { name: '@immutable', doc: 'Field cannot be changed after creation' },
    { name: '@indexed', doc: 'Field should be indexed for fast lookups' },
    { name: '@sensitive', doc: 'Field contains sensitive data' },
    { name: '@deprecated', doc: 'Mark as deprecated' },
    { name: '@computed', doc: 'Field is derived from other fields' },
];
// Snippets
const SNIPPETS = [
    {
        label: 'entity',
        insertText: 'entity ${1:Name} {\n  id: UUID @unique\n  $0\n}',
        doc: 'Create a new entity',
    },
    {
        label: 'behavior',
        insertText: 'behavior ${1:Name} {\n  input {\n    $2\n  }\n\n  output {\n    success: ${3:Boolean}\n  }\n\n  pre {\n    $4\n  }\n\n  post {\n    $0\n  }\n}',
        doc: 'Create a new behavior',
    },
    {
        label: 'type',
        insertText: 'type ${1:Name} = ${2:String} {\n  $0\n}',
        doc: 'Create a custom type',
    },
    {
        label: 'invariant',
        insertText: 'invariant ${1:Name} {\n  scope: ${2|global,transaction|}\n  $0\n}',
        doc: 'Create an invariant',
    },
    {
        label: 'policy',
        insertText: 'policy ${1:Name} {\n  applies_to: ${2:all}\n\n  rules {\n    $0\n  }\n}',
        doc: 'Create a policy',
    },
    {
        label: 'lifecycle',
        insertText: 'lifecycle {\n  ${1:Created} -> ${2:Active} -> ${3:Archived}\n}',
        doc: 'Add lifecycle states',
    },
    {
        label: 'temporal',
        insertText: 'temporal {\n  response within ${1:200}.ms (p${2:50})\n  response within ${3:500}.ms (p${4:95})\n}',
        doc: 'Add temporal constraints',
    },
    {
        label: 'scenario',
        insertText: 'scenario "${1:Test scenario}" {\n  given {\n    $2\n  }\n\n  when {\n    $3\n  }\n\n  then {\n    $0\n  }\n}',
        doc: 'Create a test scenario',
    },
];
class ISLCompletionProvider {
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    provideCompletions(document, position) {
        const context = this.getCompletionContext(document, position);
        const items = [];
        // At start of line or after keywords
        if (context.prefix === '' || context.line.trim() === context.prefix) {
            // Top-level completions
            if (!context.isInBlock) {
                items.push(...this.getTopLevelCompletions());
            }
            else {
                items.push(...this.getBlockCompletions(context));
            }
        }
        // After colon (type context)
        if (context.triggerCharacter === ':' || context.line.includes(':') && !context.line.includes('{')) {
            items.push(...this.getTypeCompletions());
        }
        // After @ (annotations)
        if (context.triggerCharacter === '@' || context.prefix.startsWith('@')) {
            items.push(...this.getAnnotationCompletions());
        }
        // After dot (member access)
        if (context.triggerCharacter === '.') {
            items.push(...this.getMemberCompletions(context));
        }
        // Inside angle brackets (generic type)
        if (context.line.includes('<') && !context.line.includes('>')) {
            items.push(...this.getTypeCompletions());
        }
        // Entity/type references
        items.push(...this.getSymbolCompletions());
        return items;
    }
    getCompletionContext(document, position) {
        const text = document.getText();
        const lines = text.split('\n');
        const line = lines[position.line] || '';
        const linePrefix = line.substring(0, position.character);
        // Find word prefix
        const prefixMatch = linePrefix.match(/[\w@]*$/);
        const prefix = prefixMatch ? prefixMatch[0] : '';
        // Find trigger character
        const triggerChar = linePrefix.length > 0 ? linePrefix[linePrefix.length - 1] : undefined;
        // Determine if we're inside a block
        let braceDepth = 0;
        let blockType;
        let parentName;
        for (let i = 0; i <= position.line; i++) {
            const currentLine = lines[i];
            braceDepth += (currentLine.match(/\{/g) || []).length;
            braceDepth -= (currentLine.match(/\}/g) || []).length;
            // Track current block type
            const entityMatch = currentLine.match(/^entity\s+(\w+)/);
            if (entityMatch) {
                blockType = 'entity';
                parentName = entityMatch[1];
            }
            const behaviorMatch = currentLine.match(/^behavior\s+(\w+)/);
            if (behaviorMatch) {
                blockType = 'behavior';
                parentName = behaviorMatch[1];
            }
        }
        return {
            position,
            line,
            prefix,
            triggerCharacter: triggerChar !== ' ' ? triggerChar : undefined,
            isInBlock: braceDepth > 1,
            blockType,
            parentName,
        };
    }
    getTopLevelCompletions() {
        const items = [];
        // Snippets
        for (const snippet of SNIPPETS) {
            items.push({
                label: snippet.label,
                kind: 'snippet',
                detail: snippet.doc,
                insertText: snippet.insertText,
                insertTextFormat: 'snippet',
            });
        }
        // Keywords
        for (const kw of ['entity', 'behavior', 'type', 'invariant', 'policy', 'view', 'scenario']) {
            items.push({
                label: kw,
                kind: 'keyword',
                detail: `ISL ${kw} declaration`,
            });
        }
        return items;
    }
    getBlockCompletions(context) {
        const items = [];
        if (context.blockType === 'entity') {
            items.push({ label: 'invariant', kind: 'keyword', detail: 'Entity invariant block' }, { label: 'lifecycle', kind: 'keyword', detail: 'Entity lifecycle states' });
        }
        if (context.blockType === 'behavior') {
            items.push({ label: 'input', kind: 'keyword', detail: 'Input parameters block' }, { label: 'output', kind: 'keyword', detail: 'Output definition block' }, { label: 'pre', kind: 'keyword', detail: 'Preconditions block' }, { label: 'post', kind: 'keyword', detail: 'Postconditions block' }, { label: 'error', kind: 'keyword', detail: 'Error case definition' }, { label: 'temporal', kind: 'keyword', detail: 'Temporal constraints' }, { label: 'security', kind: 'keyword', detail: 'Security constraints' });
        }
        return items;
    }
    getTypeCompletions() {
        return BUILTIN_TYPES.map((t) => ({
            label: t.name,
            kind: 'type',
            detail: t.doc,
            documentation: `Built-in ISL type: ${t.name}`,
        }));
    }
    getAnnotationCompletions() {
        return ANNOTATIONS.map((a) => ({
            label: a.name,
            kind: 'keyword',
            detail: a.doc,
            insertText: a.name.substring(1), // Remove @ if already typed
        }));
    }
    getMemberCompletions(context) {
        const items = [];
        // Common entity methods
        items.push({ label: 'lookup', kind: 'function', detail: 'Find entity by ID', insertText: 'lookup(${1:id})' }, { label: 'exists', kind: 'function', detail: 'Check if entity exists', insertText: 'exists(${1:id})' }, { label: 'all', kind: 'function', detail: 'Get all entities' }, { label: 'count', kind: 'function', detail: 'Count entities' }, { label: 'filter', kind: 'function', detail: 'Filter entities', insertText: 'filter(${1:predicate})' });
        // Time/duration methods
        items.push({ label: 'ms', kind: 'keyword', detail: 'Milliseconds' }, { label: 'seconds', kind: 'keyword', detail: 'Seconds' }, { label: 'minutes', kind: 'keyword', detail: 'Minutes' }, { label: 'hours', kind: 'keyword', detail: 'Hours' }, { label: 'days', kind: 'keyword', detail: 'Days' });
        return items;
    }
    getSymbolCompletions() {
        const items = [];
        const symbols = this.documentManager.getAllSymbols();
        for (const sym of symbols) {
            if (sym.kind === 'entity' || sym.kind === 'type') {
                items.push({
                    label: sym.name,
                    kind: sym.kind,
                    detail: `${sym.kind}: ${sym.name}`,
                });
            }
        }
        return items;
    }
}
exports.ISLCompletionProvider = ISLCompletionProvider;
//# sourceMappingURL=completion.js.map