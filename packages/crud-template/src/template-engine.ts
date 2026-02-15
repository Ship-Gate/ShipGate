/**
 * TemplateEngine - Generates CRUD files from entity definitions
 */

import type { EntityDefinition, GeneratedFile } from './types.js';
import { toCamelCase } from './utils.js';
import { generateValidators } from './templates/validators.js';
import { generateService } from './templates/service.js';
import { generateApiListRoute } from './templates/api-list-route.js';
import { generateApiDetailRoute } from './templates/api-detail-route.js';
import { generateApiClient } from './templates/api-client.js';
import { generateHooks } from './templates/hooks.js';
import { generateListComponent } from './templates/list-component.js';
import { generateFormComponent } from './templates/form-component.js';
import { generateDetailComponent } from './templates/detail-component.js';
import { generatePrismaModel } from './templates/prisma-model.js';

export interface TemplateEngineOptions {
  /** Base output directory (e.g. "src" or "app") */
  outputDir?: string;
  /** API route prefix (e.g. "api" for app/api) */
  apiPrefix?: string;
  /** Include Prisma model in schema */
  includePrismaModel?: boolean;
}

const DEFAULT_OPTIONS: Required<TemplateEngineOptions> = {
  outputDir: 'src',
  apiPrefix: 'api',
  includePrismaModel: true,
};

export class TemplateEngine {
  private options: Required<TemplateEngineOptions>;

  constructor(options: TemplateEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate all CRUD files for an entity
   */
  generate(entity: EntityDefinition): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const { outputDir, apiPrefix } = this.options;
    const entityCamel = toCamelCase(entity.name);
    const plural = entity.plural ?? entityCamel + 's';

    // Backend
    files.push({
      path: `${outputDir}/lib/validators/${entityCamel}.ts`,
      content: generateValidators(entity),
    });
    files.push({
      path: `${outputDir}/lib/services/${entityCamel}.service.ts`,
      content: generateService(entity),
    });
    files.push({
      path: `${outputDir}/app/${apiPrefix}/${plural}/route.ts`,
      content: generateApiListRoute(entity),
    });
    files.push({
      path: `${outputDir}/app/${apiPrefix}/${plural}/[id]/route.ts`,
      content: generateApiDetailRoute(entity),
    });

    // Frontend
    files.push({
      path: `${outputDir}/lib/api/${entityCamel}.ts`,
      content: generateApiClient(entity),
    });
    files.push({
      path: `${outputDir}/hooks/use${entity.name}.ts`,
      content: generateHooks(entity),
    });
    files.push({
      path: `${outputDir}/components/${plural}/${entity.name}List.tsx`,
      content: generateListComponent(entity),
    });
    files.push({
      path: `${outputDir}/components/${plural}/${entity.name}Form.tsx`,
      content: generateFormComponent(entity),
    });
    files.push({
      path: `${outputDir}/components/${plural}/${entity.name}Detail.tsx`,
      content: generateDetailComponent(entity),
    });

    if (this.options.includePrismaModel) {
      files.push({
        path: `prisma/schema-${entityCamel}.prisma`,
        content: generatePrismaModel(entity),
      });
    }

    return files;
  }

  /**
   * Generate from ISL-like entity definition (flexible input)
   */
  generateFromDefinition(definition: EntityDefinition): GeneratedFile[] {
    const entity: EntityDefinition = {
      ...definition,
      plural: definition.plural ?? definition.name.toLowerCase() + 's',
    };
    return this.generate(entity);
  }
}
