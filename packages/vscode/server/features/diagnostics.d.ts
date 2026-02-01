import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ISLDocumentManager } from '../documents';
import type { Diagnostic } from '../types';
export declare class ISLDiagnosticsProvider {
    private documentManager;
    constructor(documentManager: ISLDocumentManager);
    provideDiagnostics(document: TextDocument): Diagnostic[];
    private isInPostcondition;
}
//# sourceMappingURL=diagnostics.d.ts.map