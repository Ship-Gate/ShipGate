/**
 * Error Catalog Generator
 *
 * Extracts error definitions from ISL files and generates
 * comprehensive error documentation in multiple formats.
 */

export * from './types.js';
export * from './extractor.js';
export * from './catalog.js';
export * from './generators/markdown.js';
export * from './generators/json.js';
export * from './generators/typescript.js';
export * from './generators/openapi.js';
export * from './website/generator.js';

import { ErrorCatalog } from './catalog.js';
import { ErrorExtractor } from './extractor.js';
import { MarkdownGenerator } from './generators/markdown.js';
import { JsonGenerator } from './generators/json.js';
import { TypeScriptGenerator } from './generators/typescript.js';
import { OpenAPIGenerator } from './generators/openapi.js';
import { WebsiteGenerator } from './website/generator.js';
import type { CatalogConfig, GeneratorOutput } from './types.js';

/**
 * Generate error catalog from ISL files
 */
export async function generateErrorCatalog(
  config: CatalogConfig
): Promise<GeneratorOutput[]> {
  const extractor = new ErrorExtractor();
  const result = await extractor.extractFromGlob(config.inputGlob);

  const catalog = new ErrorCatalog(result.errors, {
    groupBy: config.groupBy ?? 'domain',
    sortBy: config.sortBy ?? 'code',
  });

  const outputs: GeneratorOutput[] = [];

  if (config.outputs.markdown) {
    const generator = new MarkdownGenerator(config.outputs.markdown);
    outputs.push(...(await generator.generate(catalog)));
  }

  if (config.outputs.json) {
    const generator = new JsonGenerator(config.outputs.json);
    outputs.push(...(await generator.generate(catalog)));
  }

  if (config.outputs.typescript) {
    const generator = new TypeScriptGenerator(config.outputs.typescript);
    outputs.push(...(await generator.generate(catalog)));
  }

  if (config.outputs.openapi) {
    const generator = new OpenAPIGenerator(config.outputs.openapi);
    outputs.push(...(await generator.generate(catalog)));
  }

  if (config.outputs.website) {
    const generator = new WebsiteGenerator(config.outputs.website);
    outputs.push(...(await generator.generate(catalog)));
  }

  return outputs;
}
