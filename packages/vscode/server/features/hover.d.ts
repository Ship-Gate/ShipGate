import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import type { HoverInfo } from '../types';
export declare class ISLHoverProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideHover(document: TextDocument, position: Position): HoverInfo | null;
    private formatSymbolHover;
}
//# sourceMappingURL=hover.d.ts.map