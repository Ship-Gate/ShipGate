import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import type { CompletionItem } from '../types';
export declare class ISLCompletionProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideCompletions(document: TextDocument, position: Position): CompletionItem[];
    private getCompletionContext;
    private getTopLevelCompletions;
    private getBlockCompletions;
    private getTypeCompletions;
    private getAnnotationCompletions;
    private getMemberCompletions;
    private getSymbolCompletions;
}
//# sourceMappingURL=completion.d.ts.map