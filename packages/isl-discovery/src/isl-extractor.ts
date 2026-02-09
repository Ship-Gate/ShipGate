// ============================================================================
// ISL Symbol Extractor
// ============================================================================

import { parse, type ParseResult } from '@isl-lang/parser';
import { readFile } from 'node:fs/promises';
import type { ISLSymbol } from './types.js';

/**
 * Extract ISL symbols from spec files
 */
export async function extractISLSymbols(specFiles: string[]): Promise<ISLSymbol[]> {
  const symbols: ISLSymbol[] = [];

  for (const specFile of specFiles) {
    try {
      const content = await readFile(specFile, 'utf-8');
      const parseResult = parse(content, specFile);

      if (!parseResult.success || !parseResult.domain) {
        continue;
      }

      const domain = parseResult.domain;
      const domainName = domain.name?.name ?? 'Unknown';

      // Extract behaviors
      if (domain.behaviors) {
        for (const behavior of domain.behaviors) {
          if (behavior.name?.name) {
            const loc = behavior.location;
            symbols.push({
              type: 'behavior',
              name: behavior.name.name,
              domain: domainName,
              specFile,
              location: {
                start: { line: loc?.line ?? 1, column: loc?.column ?? 1 },
                end: { line: loc?.endLine ?? 1, column: loc?.endColumn ?? 1 },
              },
              metadata: {
                hasInput: !!behavior.input,
                hasOutput: !!behavior.output,
                hasPreconditions: !!behavior.preconditions && behavior.preconditions.length > 0,
                hasPostconditions: !!behavior.postconditions && behavior.postconditions.length > 0,
              },
            });
          }
        }
      }

      // Extract entities
      if (domain.entities) {
        for (const entity of domain.entities) {
          if (entity.name?.name) {
            const loc = entity.location;
            symbols.push({
              type: 'entity',
              name: entity.name.name,
              domain: domainName,
              specFile,
              location: {
                start: { line: loc?.line ?? 1, column: loc?.column ?? 1 },
                end: { line: loc?.endLine ?? 1, column: loc?.endColumn ?? 1 },
              },
              metadata: {
                fieldCount: entity.fields?.length || 0,
              },
            });
          }
        }
      }

      // Extract types and enums (enums are TypeDeclaration with definition.kind === 'EnumType')
      if (domain.types) {
        for (const type of domain.types) {
          if (type.name?.name) {
            const loc = type.location;
            symbols.push({
              type: 'type',
              name: type.name.name,
              domain: domainName,
              specFile,
              location: {
                start: { line: loc?.line ?? 1, column: loc?.column ?? 1 },
                end: { line: loc?.endLine ?? 1, column: loc?.endColumn ?? 1 },
              },
            });
          }
          if (type.definition?.kind === 'EnumType' && type.name?.name) {
            const loc = type.location;
            const enumDef = type.definition as { values?: unknown[] };
            symbols.push({
              type: 'enum',
              name: type.name.name,
              domain: domainName,
              specFile,
              location: {
                start: { line: loc?.line ?? 1, column: loc?.column ?? 1 },
                end: { line: loc?.endLine ?? 1, column: loc?.endColumn ?? 1 },
              },
              metadata: {
                valueCount: enumDef.values?.length ?? 0,
              },
            });
          }
        }
      }
    } catch (error) {
      // Skip files that can't be read or parsed
      continue;
    }
  }

  return symbols;
}
