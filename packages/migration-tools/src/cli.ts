#!/usr/bin/env node
/**
 * ISL Migration CLI
 * 
 * Command-line tool for converting API specifications to ISL.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { MigrationEngine, detectFormat, type DetectedFormat } from './engine.js';

interface CLIOptions {
  input: string;
  output?: string;
  format?: DetectedFormat;
  domain?: string;
  pretty?: boolean;
  quiet?: boolean;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.input) {
    console.error('Error: Input file is required');
    process.exit(1);
  }

  try {
    // Read input file
    const inputPath = path.resolve(options.input);
    
    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(inputPath, 'utf-8');

    // Create migration engine
    const engine = new MigrationEngine({
      format: options.format,
      domainName: options.domain,
      generatePreconditions: true,
      generatePostconditions: true,
      output: {
        pretty: options.pretty ?? true,
        includeComments: true,
      },
    });

    // Perform migration
    if (!options.quiet) {
      console.log(`Converting ${options.input}...`);
    }

    const result = await engine.migrate(content);

    // Output result
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, result.isl);
      
      if (!options.quiet) {
        console.log(`Output written to ${outputPath}`);
      }
    } else {
      console.log(result.isl);
    }

    // Print stats
    if (!options.quiet) {
      console.log('');
      console.log('Migration complete:');
      console.log(`  Format:    ${result.format}`);
      console.log(`  Entities:  ${result.stats.entities}`);
      console.log(`  Behaviors: ${result.stats.behaviors}`);
      console.log(`  Types:     ${result.stats.types}`);
      console.log(`  Enums:     ${result.stats.enums}`);
      console.log(`  Duration:  ${result.stats.duration}ms`);

      if (result.warnings.length > 0) {
        console.log('');
        console.log('Warnings:');
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    input: '',
    pretty: true,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-o':
      case '--output':
        options.output = args[++i];
        break;

      case '-f':
      case '--format':
        options.format = args[++i] as DetectedFormat;
        break;

      case '-d':
      case '--domain':
        options.domain = args[++i];
        break;

      case '--no-pretty':
        options.pretty = false;
        break;

      case '-q':
      case '--quiet':
        options.quiet = true;
        break;

      default:
        if (!arg.startsWith('-')) {
          options.input = arg;
        }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
ISL Migration Tool

Convert API specifications to ISL (Intent Specification Language).

Usage:
  isl-migrate <input-file> [options]

Options:
  -o, --output <file>   Output file (stdout if not specified)
  -f, --format <fmt>    Source format (auto-detected if not specified)
                        Options: openapi, graphql, protobuf, json-schema, asyncapi
  -d, --domain <name>   Domain name for generated ISL
  --no-pretty           Disable pretty printing
  -q, --quiet           Suppress informational output
  -h, --help            Show this help message

Examples:
  isl-migrate openapi.json -o api.isl
  isl-migrate schema.graphql -f graphql -d MyAPI
  isl-migrate service.proto --format protobuf

Supported Formats:
  - OpenAPI 3.x (JSON/YAML)
  - GraphQL Schema (SDL)
  - Protocol Buffers (proto3)
  - JSON Schema
  - AsyncAPI 2.x
`);
}

main().catch(console.error);
