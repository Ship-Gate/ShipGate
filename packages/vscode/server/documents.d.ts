import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position } from 'vscode-languageserver';
import type { ParsedDocument, ISLSymbol, ISLSymbolKind } from './types';
export declare class ISLDocumentManager {
    private documents;
    updateDocument(document: TextDocument): ParsedDocument;
    getDocument(uri: string): ParsedDocument | undefined;
    removeDocument(uri: string): void;
    getAllSymbols(): ISLSymbol[];
    findSymbol(name: string, kind?: ISLSymbolKind): ISLSymbol | undefined;
    private findSymbolInList;
    private parseDocument;
    private createRange;
    private createSelectionRange;
    private extractTypeReferences;
    getSymbolAtPosition(document: TextDocument, position: Position): ISLSymbol | undefined;
    private findSymbolAtPosition;
    private positionInRange;
    getWordAtPosition(document: TextDocument, position: Position): string;
}
//# sourceMappingURL=documents.d.ts.map