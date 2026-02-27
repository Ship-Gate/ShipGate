import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ISLDocumentManager } from '../documents';
import type { ISLSymbol } from '../types';
export declare class ISLSymbolProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideSymbols(document: TextDocument): ISLSymbol[];
}
//# sourceMappingURL=symbols.d.ts.map