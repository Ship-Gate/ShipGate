#!/usr/bin/env node

/**
 * ISL CLI
 * 
 * Command-line interface for the Intent Specification Language.
 * 
 * Commands:
 *   isl check <files>          - Parse and type check ISL files
 *   isl generate --types       - Generate TypeScript types
 *   isl generate --tests       - Generate test files
 *   isl generate --docs        - Generate documentation
 *   isl verify --impl <file>   - Verify implementation against spec
 *   isl init <name>            - Initialize new ISL project
 *   isl build                  - Full pipeline: check + generate
 */

import { program } from './cli.js';

// Parse command line arguments and execute
program.parse();
