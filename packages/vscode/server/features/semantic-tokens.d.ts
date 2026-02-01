import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ISLDocumentManager } from '../documents';
import type { SemanticToken, SemanticTokenType, SemanticTokenModifier } from '../types';
export declare const TOKEN_TYPES: SemanticTokenType[];
export declare const TOKEN_MODIFIERS: SemanticTokenModifier[];
export declare class ISLSemanticTokensProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideTokens(document: TextDocument): SemanticToken[];
    private tokenizeLine;
    private isInString;
}
//# sourceMappingURL=semantic-tokens.d.ts.map