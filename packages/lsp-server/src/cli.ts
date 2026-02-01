#!/usr/bin/env node
// ============================================================================
// ISL Language Server CLI
// ============================================================================

import { ISLServer } from './server';

const server = new ISLServer();
server.start();

console.error('ISL Language Server started');
