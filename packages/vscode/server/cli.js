#!/usr/bin/env node
"use strict";
// ============================================================================
// ISL Language Server CLI
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const server = new server_1.ISLServer();
server.start();
console.error('ISL Language Server started');
//# sourceMappingURL=cli.js.map