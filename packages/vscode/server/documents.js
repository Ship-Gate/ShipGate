"use strict";
// ============================================================================
// ISL Document Manager
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLDocumentManager = void 0;
class ISLDocumentManager {
    documents = new Map();
    updateDocument(document) {
        const parsed = this.parseDocument(document);
        this.documents.set(document.uri, parsed);
        return parsed;
    }
    getDocument(uri) {
        return this.documents.get(uri);
    }
    removeDocument(uri) {
        this.documents.delete(uri);
    }
    getAllSymbols() {
        const symbols = [];
        for (const doc of this.documents.values()) {
            symbols.push(...doc.symbols);
        }
        return symbols;
    }
    findSymbol(name, kind) {
        for (const doc of this.documents.values()) {
            const found = this.findSymbolInList(doc.symbols, name, kind);
            if (found)
                return found;
        }
        return undefined;
    }
    findSymbolInList(symbols, name, kind) {
        for (const sym of symbols) {
            if (sym.name === name && (!kind || sym.kind === kind)) {
                return sym;
            }
            if (sym.children) {
                const found = this.findSymbolInList(sym.children, name, kind);
                if (found)
                    return found;
            }
        }
        return undefined;
    }
    parseDocument(document) {
        const text = document.getText();
        const lines = text.split('\n');
        const symbols = [];
        const references = [];
        let domain;
        let currentSymbol;
        let braceDepth = 0;
        let currentSection = '';
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const trimmed = line.trim();
            // Count braces
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            // Domain declaration
            const domainMatch = trimmed.match(/^domain\s+(\w+)\s*\{?$/);
            if (domainMatch) {
                domain = {
                    name: domainMatch[1],
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                };
                braceDepth += openBraces;
                continue;
            }
            // Version
            const versionMatch = trimmed.match(/version:\s*"([^"]+)"/);
            if (versionMatch && domain) {
                domain.version = versionMatch[1];
                continue;
            }
            // Entity
            const entityMatch = trimmed.match(/^entity\s+(\w+)\s*\{$/);
            if (entityMatch) {
                currentSymbol = {
                    name: entityMatch[1],
                    kind: 'entity',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, entityMatch[1], lineNum),
                    children: [],
                };
                braceDepth += openBraces;
                continue;
            }
            // Behavior
            const behaviorMatch = trimmed.match(/^behavior\s+(\w+)\s*\{$/);
            if (behaviorMatch) {
                currentSymbol = {
                    name: behaviorMatch[1],
                    kind: 'behavior',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, behaviorMatch[1], lineNum),
                    children: [],
                };
                braceDepth += openBraces;
                continue;
            }
            // Type
            const typeMatch = trimmed.match(/^type\s+(\w+)\s*=\s*(.+)$/);
            if (typeMatch) {
                symbols.push({
                    name: typeMatch[1],
                    kind: 'type',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, typeMatch[1], lineNum),
                    detail: typeMatch[2],
                });
                // Track type references
                this.extractTypeReferences(typeMatch[2], lineNum, line, references);
                continue;
            }
            // Invariant
            const invariantMatch = trimmed.match(/^invariant\s+(\w+)\s*\{$/);
            if (invariantMatch) {
                currentSymbol = {
                    name: invariantMatch[1],
                    kind: 'invariant',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, invariantMatch[1], lineNum),
                    children: [],
                };
                braceDepth += openBraces;
                continue;
            }
            // Policy
            const policyMatch = trimmed.match(/^policy\s+(\w+)\s*\{$/);
            if (policyMatch) {
                currentSymbol = {
                    name: policyMatch[1],
                    kind: 'policy',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, policyMatch[1], lineNum),
                    children: [],
                };
                braceDepth += openBraces;
                continue;
            }
            // View
            const viewMatch = trimmed.match(/^view\s+(\w+)\s*\{$/);
            if (viewMatch) {
                currentSymbol = {
                    name: viewMatch[1],
                    kind: 'view',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, viewMatch[1], lineNum),
                    children: [],
                };
                braceDepth += openBraces;
                continue;
            }
            // Scenario
            const scenarioMatch = trimmed.match(/^scenario\s+"([^"]+)"\s*\{$/);
            if (scenarioMatch) {
                currentSymbol = {
                    name: scenarioMatch[1],
                    kind: 'scenario',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, scenarioMatch[1], lineNum),
                    children: [],
                };
                braceDepth += openBraces;
                continue;
            }
            // Sections within blocks
            if (trimmed === 'input {') {
                currentSection = 'input';
                braceDepth += openBraces;
                continue;
            }
            if (trimmed === 'output {') {
                currentSection = 'output';
                braceDepth += openBraces;
                continue;
            }
            if (trimmed === 'pre {' || trimmed === 'post {' || trimmed === 'lifecycle {') {
                currentSection = trimmed.split(' ')[0];
                braceDepth += openBraces;
                continue;
            }
            // Field in entity or input
            if (currentSymbol && trimmed.includes(':') && !trimmed.startsWith('//')) {
                const fieldMatch = trimmed.match(/^(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\??/);
                if (fieldMatch) {
                    const fieldKind = currentSection === 'input' ? 'input' :
                        currentSection === 'output' ? 'output' : 'field';
                    currentSymbol.children?.push({
                        name: fieldMatch[1],
                        kind: fieldKind,
                        range: this.createRange(lineNum, 0, lineNum, line.length),
                        selectionRange: this.createSelectionRange(line, fieldMatch[1], lineNum),
                        detail: fieldMatch[2],
                    });
                    // Track type reference
                    references.push({
                        name: fieldMatch[2].replace(/<.*>/, ''),
                        range: this.createSelectionRange(line, fieldMatch[2], lineNum),
                        kind: 'type',
                    });
                }
            }
            // Error in behavior
            const errorMatch = trimmed.match(/^error\s+(\w+)/);
            if (errorMatch && currentSymbol?.kind === 'behavior') {
                currentSymbol.children?.push({
                    name: errorMatch[1],
                    kind: 'error',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, errorMatch[1], lineNum),
                });
            }
            // State in lifecycle
            const stateMatch = trimmed.match(/^(\w+)\s*->/);
            if (stateMatch && currentSection === 'lifecycle') {
                currentSymbol?.children?.push({
                    name: stateMatch[1],
                    kind: 'state',
                    range: this.createRange(lineNum, 0, lineNum, line.length),
                    selectionRange: this.createSelectionRange(line, stateMatch[1], lineNum),
                });
            }
            // Closing brace
            if (trimmed === '}') {
                braceDepth -= 1;
                if (braceDepth === 1 && currentSymbol) {
                    // Update range to include closing brace
                    currentSymbol.range = this.createRange(currentSymbol.range.start.line, 0, lineNum, line.length);
                    symbols.push(currentSymbol);
                    currentSymbol = undefined;
                    currentSection = '';
                }
            }
            braceDepth += openBraces - closeBraces;
        }
        return {
            uri: document.uri,
            version: document.version,
            domain,
            symbols,
            references,
            diagnostics: [],
        };
    }
    createRange(startLine, startChar, endLine, endChar) {
        return {
            start: { line: startLine, character: startChar },
            end: { line: endLine, character: endChar },
        };
    }
    createSelectionRange(line, name, lineNum) {
        const start = line.indexOf(name);
        return this.createRange(lineNum, start, lineNum, start + name.length);
    }
    extractTypeReferences(typeExpr, lineNum, line, references) {
        // Extract type names from expressions like "List<User>" or "Map<String, Order>"
        const typePattern = /\b([A-Z][a-zA-Z0-9]*)\b/g;
        let match;
        while ((match = typePattern.exec(typeExpr)) !== null) {
            const typeName = match[1];
            if (!['String', 'Int', 'Boolean', 'UUID', 'Timestamp', 'Decimal', 'Duration', 'List', 'Map', 'Optional'].includes(typeName)) {
                const start = line.indexOf(typeName);
                if (start >= 0) {
                    references.push({
                        name: typeName,
                        range: this.createRange(lineNum, start, lineNum, start + typeName.length),
                        kind: 'type',
                    });
                }
            }
        }
    }
    getSymbolAtPosition(document, position) {
        const parsed = this.documents.get(document.uri);
        if (!parsed)
            return undefined;
        return this.findSymbolAtPosition(parsed.symbols, position);
    }
    findSymbolAtPosition(symbols, position) {
        for (const sym of symbols) {
            if (this.positionInRange(position, sym.range)) {
                // Check children first for more specific match
                if (sym.children) {
                    const child = this.findSymbolAtPosition(sym.children, position);
                    if (child)
                        return child;
                }
                return sym;
            }
        }
        return undefined;
    }
    positionInRange(position, range) {
        if (position.line < range.start.line || position.line > range.end.line) {
            return false;
        }
        if (position.line === range.start.line && position.character < range.start.character) {
            return false;
        }
        if (position.line === range.end.line && position.character > range.end.character) {
            return false;
        }
        return true;
    }
    getWordAtPosition(document, position) {
        const text = document.getText();
        const lines = text.split('\n');
        const line = lines[position.line];
        if (!line)
            return '';
        // Find word boundaries
        let start = position.character;
        let end = position.character;
        while (start > 0 && /[\w]/.test(line[start - 1])) {
            start--;
        }
        while (end < line.length && /[\w]/.test(line[end])) {
            end++;
        }
        return line.substring(start, end);
    }
}
exports.ISLDocumentManager = ISLDocumentManager;
//# sourceMappingURL=documents.js.map