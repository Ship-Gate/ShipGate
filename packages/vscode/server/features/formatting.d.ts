import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextEdit } from 'vscode-languageserver';
export declare class ISLFormattingProvider {
    provideFormatting(document: TextDocument): TextEdit[];
    private formatISL;
}
//# sourceMappingURL=formatting.d.ts.map