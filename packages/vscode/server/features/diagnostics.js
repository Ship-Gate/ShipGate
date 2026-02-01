"use strict";
// ============================================================================
// ISL Diagnostics Provider
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLDiagnosticsProvider = void 0;
const BUILTIN_TYPES = new Set([
    'String', 'Int', 'Boolean', 'UUID', 'Timestamp', 'Decimal', 'Duration',
    'Date', 'Time', 'List', 'Map', 'Set', 'Optional', 'Any',
]);
class ISLDiagnosticsProvider {
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    provideDiagnostics(document) {
        const diagnostics = [];
        const text = document.getText();
        const lines = text.split('\n');
        const parsed = this.documentManager.getDocument(document.uri);
        // Track declared symbols
        const declaredTypes = new Set();
        const declaredEntities = new Set();
        const declaredBehaviors = new Set();
        if (parsed) {
            for (const sym of parsed.symbols) {
                if (sym.kind === 'type')
                    declaredTypes.add(sym.name);
                if (sym.kind === 'entity')
                    declaredEntities.add(sym.name);
                if (sym.kind === 'behavior')
                    declaredBehaviors.add(sym.name);
            }
        }
        // Line-by-line analysis
        let braceDepth = 0;
        let currentBlock = '';
        let hasInput = false;
        let hasOutput = false;
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const trimmed = line.trim();
            // Skip comments
            if (trimmed.startsWith('//'))
                continue;
            // Track braces
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            // Check for unclosed strings
            const quotes = (line.match(/"/g) || []).length;
            if (quotes % 2 !== 0) {
                diagnostics.push({
                    range: {
                        start: { line: lineNum, character: 0 },
                        end: { line: lineNum, character: line.length },
                    },
                    message: 'Unclosed string literal',
                    severity: 'error',
                    code: 'ISL001',
                    source: 'isl',
                });
            }
            // Track block type
            if (trimmed.match(/^entity\s+\w+/)) {
                currentBlock = 'entity';
            }
            else if (trimmed.match(/^behavior\s+\w+/)) {
                currentBlock = 'behavior';
                hasInput = false;
                hasOutput = false;
            }
            // Track input/output in behaviors
            if (currentBlock === 'behavior') {
                if (trimmed === 'input {')
                    hasInput = true;
                if (trimmed === 'output {')
                    hasOutput = true;
            }
            // Check for undefined type references
            const typeRefMatch = trimmed.match(/:\s*(\w+)(?:<[^>]+>)?/);
            if (typeRefMatch) {
                const typeName = typeRefMatch[1];
                if (!BUILTIN_TYPES.has(typeName) && !declaredTypes.has(typeName) && !declaredEntities.has(typeName)) {
                    const start = line.indexOf(typeName);
                    diagnostics.push({
                        range: {
                            start: { line: lineNum, character: start },
                            end: { line: lineNum, character: start + typeName.length },
                        },
                        message: `Unknown type '${typeName}'`,
                        severity: 'error',
                        code: 'ISL002',
                        source: 'isl',
                    });
                }
            }
            // Check for duplicate declarations
            const entityMatch = trimmed.match(/^entity\s+(\w+)/);
            if (entityMatch) {
                const name = entityMatch[1];
                if (declaredEntities.has(name) && parsed?.symbols.filter(s => s.name === name).length > 1) {
                    diagnostics.push({
                        range: {
                            start: { line: lineNum, character: trimmed.indexOf(name) },
                            end: { line: lineNum, character: trimmed.indexOf(name) + name.length },
                        },
                        message: `Duplicate entity declaration '${name}'`,
                        severity: 'error',
                        code: 'ISL003',
                        source: 'isl',
                    });
                }
            }
            // Check for missing required sections
            if (trimmed === '}' && braceDepth === 2 && currentBlock === 'behavior') {
                if (!hasInput) {
                    diagnostics.push({
                        range: {
                            start: { line: lineNum, character: 0 },
                            end: { line: lineNum, character: 1 },
                        },
                        message: "Behavior missing 'input' block",
                        severity: 'warning',
                        code: 'ISL004',
                        source: 'isl',
                    });
                }
                if (!hasOutput) {
                    diagnostics.push({
                        range: {
                            start: { line: lineNum, character: 0 },
                            end: { line: lineNum, character: 1 },
                        },
                        message: "Behavior missing 'output' block",
                        severity: 'warning',
                        code: 'ISL005',
                        source: 'isl',
                    });
                }
                currentBlock = '';
            }
            // Check for old() usage outside postconditions
            if (trimmed.includes('old(') && !this.isInPostcondition(lines, lineNum)) {
                const start = line.indexOf('old(');
                diagnostics.push({
                    range: {
                        start: { line: lineNum, character: start },
                        end: { line: lineNum, character: start + 4 },
                    },
                    message: "'old()' can only be used in postconditions",
                    severity: 'error',
                    code: 'ISL006',
                    source: 'isl',
                });
            }
            // Check for result usage outside postconditions
            if (trimmed.match(/\bresult\b/) && !this.isInPostcondition(lines, lineNum)) {
                const start = line.indexOf('result');
                diagnostics.push({
                    range: {
                        start: { line: lineNum, character: start },
                        end: { line: lineNum, character: start + 6 },
                    },
                    message: "'result' can only be used in postconditions",
                    severity: 'error',
                    code: 'ISL007',
                    source: 'isl',
                });
            }
            // Check for input usage outside behavior blocks
            if (trimmed.match(/\binput\.\w+/) && currentBlock !== 'behavior') {
                const start = line.indexOf('input.');
                diagnostics.push({
                    range: {
                        start: { line: lineNum, character: start },
                        end: { line: lineNum, character: start + 6 },
                    },
                    message: "'input' can only be used in behavior blocks",
                    severity: 'error',
                    code: 'ISL008',
                    source: 'isl',
                });
            }
            // Naming conventions
            const typeDefMatch = trimmed.match(/^type\s+(\w+)/);
            if (typeDefMatch && !/^[A-Z]/.test(typeDefMatch[1])) {
                const start = line.indexOf(typeDefMatch[1]);
                diagnostics.push({
                    range: {
                        start: { line: lineNum, character: start },
                        end: { line: lineNum, character: start + typeDefMatch[1].length },
                    },
                    message: 'Type names should start with uppercase letter',
                    severity: 'warning',
                    code: 'ISL009',
                    source: 'isl',
                });
            }
            const fieldMatch = trimmed.match(/^(\w+)\s*:/);
            if (fieldMatch && braceDepth > 1 && /^[A-Z]/.test(fieldMatch[1])) {
                const start = line.indexOf(fieldMatch[1]);
                diagnostics.push({
                    range: {
                        start: { line: lineNum, character: start },
                        end: { line: lineNum, character: start + fieldMatch[1].length },
                    },
                    message: 'Field names should start with lowercase letter',
                    severity: 'hint',
                    code: 'ISL010',
                    source: 'isl',
                });
            }
            braceDepth += openBraces - closeBraces;
        }
        // Check for unbalanced braces at end
        if (braceDepth !== 0) {
            diagnostics.push({
                range: {
                    start: { line: lines.length - 1, character: 0 },
                    end: { line: lines.length - 1, character: lines[lines.length - 1]?.length || 0 },
                },
                message: braceDepth > 0 ? 'Unclosed brace(s)' : 'Extra closing brace(s)',
                severity: 'error',
                code: 'ISL011',
                source: 'isl',
            });
        }
        return diagnostics;
    }
    isInPostcondition(lines, lineNum) {
        // Look backwards for 'post {'
        let braceDepth = 0;
        for (let i = lineNum; i >= 0; i--) {
            const line = lines[i].trim();
            braceDepth += (line.match(/\}/g) || []).length;
            braceDepth -= (line.match(/\{/g) || []).length;
            if (line === 'post {' && braceDepth <= 0) {
                return true;
            }
            if (line === 'pre {' && braceDepth <= 0) {
                return false;
            }
        }
        return false;
    }
}
exports.ISLDiagnosticsProvider = ISLDiagnosticsProvider;
//# sourceMappingURL=diagnostics.js.map