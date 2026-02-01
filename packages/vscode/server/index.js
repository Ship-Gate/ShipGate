"use strict";
// ============================================================================
// ISL Language Server - Main Entry
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLSemanticTokensProvider = exports.ISLFormattingProvider = exports.ISLSymbolProvider = exports.ISLDefinitionProvider = exports.ISLDiagnosticsProvider = exports.ISLHoverProvider = exports.ISLCompletionProvider = exports.ISLDocumentManager = exports.ISLServer = void 0;
var server_1 = require("./server");
Object.defineProperty(exports, "ISLServer", { enumerable: true, get: function () { return server_1.ISLServer; } });
var documents_1 = require("./documents");
Object.defineProperty(exports, "ISLDocumentManager", { enumerable: true, get: function () { return documents_1.ISLDocumentManager; } });
var completion_1 = require("./features/completion");
Object.defineProperty(exports, "ISLCompletionProvider", { enumerable: true, get: function () { return completion_1.ISLCompletionProvider; } });
var hover_1 = require("./features/hover");
Object.defineProperty(exports, "ISLHoverProvider", { enumerable: true, get: function () { return hover_1.ISLHoverProvider; } });
var diagnostics_1 = require("./features/diagnostics");
Object.defineProperty(exports, "ISLDiagnosticsProvider", { enumerable: true, get: function () { return diagnostics_1.ISLDiagnosticsProvider; } });
var definition_1 = require("./features/definition");
Object.defineProperty(exports, "ISLDefinitionProvider", { enumerable: true, get: function () { return definition_1.ISLDefinitionProvider; } });
var symbols_1 = require("./features/symbols");
Object.defineProperty(exports, "ISLSymbolProvider", { enumerable: true, get: function () { return symbols_1.ISLSymbolProvider; } });
var formatting_1 = require("./features/formatting");
Object.defineProperty(exports, "ISLFormattingProvider", { enumerable: true, get: function () { return formatting_1.ISLFormattingProvider; } });
var semantic_tokens_1 = require("./features/semantic-tokens");
Object.defineProperty(exports, "ISLSemanticTokensProvider", { enumerable: true, get: function () { return semantic_tokens_1.ISLSemanticTokensProvider; } });
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map