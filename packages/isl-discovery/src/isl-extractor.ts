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
      const domainName = domain.name?.value || 'Unknown';

      // Extract behaviors
      if (domain.behaviors) {
        for (const behavior of domain.behaviors) {
          if (behavior.name?.value) {
            symbols.push({
              type: 'behavior',
              name: behavior.name.value,
              domain: domainName,
              specFile,
              location: {
                start: {
                  line: behavior.location?.start?.line || 1,
                  column: behavior.location?.start?.column || 1,
                },
                end: {
                  line: behavior.location?.end?.line || 1,
                  column: behavior.location?.end?.column || 1,
                },
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
          if (entity.name?.value) {
            symbols.push({
              type: 'entity',
              name: entity.name.value,
              domain: domainName,
              specFile,
              location: {
                start: {
                  line: entity.location?.start?.line || 1,
                  column: entity.location?.start?.column || 1,
                },
                end: {
                  line: entity.location?.end?.line || 1,
                  column: entity.location?.end?.column || 1,
                },
              },
              metadata: {
                fieldCount: entity.fields?.length || 0,
              },
            });
          }
        }
      }

      // Extract types
      if (domain.types) {
        for (const type of domain.types) {
          if (type.name?.value) {
            symbols.push({
              type: 'type',
              name: type.name.value,
              domain: domainName,
              specFile,
              location: {
                start: {
                  line: type.location?.start?.line || 1,
                  column: type.location?.start?.column || 1,
                },
                end: {
                  line: type.location?.end?.line || 1,
                  column: type.location?.end?.column || 1,
                },
              },
            });
          }
        }
      }

      // Extract enums
      if (domain.enums) {
        for (const enumDef of domain.enums) {
          if (enumDef.name?.value) {
            symbols.push({
              type: 'enum',
              name: enumDef.name.value,
              domain: domainName,
              specFile,
              location: {
                start: {
                  line: enumDef.location?.start?.line || 1,
                  column: enumDef.location?.start?.column || 1,
                },
                end: {
                  line: enumDef.location?.end?.line || 1,
                  column: enumDef.location?.end?.column || 1,
                },
              },
              metadata: {
                valueCount: enumDef.values?.length || 0,
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
