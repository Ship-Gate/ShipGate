import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position, Location } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
export declare class ISLDefinitionProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideDefinition(document: TextDocument, position: Position): Location | null;
}
//# sourceMappingURL=definition.d.ts.map