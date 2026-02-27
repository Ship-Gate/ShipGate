#!/usr/bin/env node
/**
 * CLI to generate CRUD from entity definitions
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { TemplateEngine } from './template-engine.js';
import type { EntityDefinition } from './types.js';

const EXAMPLES: Record<string, EntityDefinition> = {
  Post: {
    name: 'Post',
    plural: 'posts',
    fields: [
      { name: 'id', type: 'String', required: true },
      { name: 'title', type: 'String', required: true, searchable: true, sortable: true, listDisplay: true, editable: true },
      { name: 'content', type: 'String', required: false, searchable: true, listDisplay: true, editable: true },
      { name: 'published', type: 'Boolean', required: true, filterable: true, sortable: true, listDisplay: true, editable: true },
      { name: 'createdAt', type: 'DateTime', required: true },
      { name: 'updatedAt', type: 'DateTime', required: true },
    ],
    auth: 'public',
    softDelete: false,
  },
  Product: {
    name: 'Product',
    plural: 'products',
    fields: [
      { name: 'id', type: 'String', required: true },
      { name: 'name', type: 'String', required: true, searchable: true, sortable: true, listDisplay: true, editable: true },
      { name: 'sku', type: 'String', required: true, searchable: true, sortable: true, listDisplay: true, editable: true },
      { name: 'price', type: 'Float', required: true, sortable: true, filterable: true, listDisplay: true, editable: true },
      { name: 'stock', type: 'Int', required: true, sortable: true, listDisplay: true, editable: true },
      { name: 'createdAt', type: 'DateTime', required: true },
      { name: 'updatedAt', type: 'DateTime', required: true },
    ],
    auth: 'authenticated',
    softDelete: false,
  },
  Invoice: {
    name: 'Invoice',
    plural: 'invoices',
    fields: [
      { name: 'id', type: 'String', required: true },
      { name: 'invoiceNumber', type: 'String', required: true, searchable: true, sortable: true, listDisplay: true, editable: true },
      { name: 'customerName', type: 'String', required: true, searchable: true, listDisplay: true, editable: true },
      { name: 'amount', type: 'Float', required: true, sortable: true, listDisplay: true, editable: true },
      { name: 'status', type: 'String', required: true, filterable: true, sortable: true, listDisplay: true, editable: true },
      { name: 'createdAt', type: 'DateTime', required: true },
      { name: 'updatedAt', type: 'DateTime', required: true },
      { name: 'deletedAt', type: 'DateTime', required: false },
    ],
    auth: 'authenticated',
    softDelete: true,
  },
};

const OUTPUT_BASE = process.env.CRUD_OUTPUT ?? process.cwd();

function main() {
  const engine = new TemplateEngine({
    outputDir: 'src',
    apiPrefix: 'api',
    includePrismaModel: true,
  });

  const prismaModels: string[] = [];

  for (const [, entity] of Object.entries(EXAMPLES)) {
    const files = engine.generate(entity);

    for (const file of files) {
      if (file.path.startsWith('prisma/')) {
        prismaModels.push(file.content);
        continue;
      }
      const fullPath = join(OUTPUT_BASE, file.path);
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, file.content, 'utf-8');
      console.log(`Generated: ${fullPath}`);
    }
  }

  if (prismaModels.length > 0) {
    const prismaDir = join(OUTPUT_BASE, 'prisma');
    if (!existsSync(prismaDir)) mkdirSync(prismaDir, { recursive: true });
    const schemaContent = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

${prismaModels.join('\n\n')}
`;
    writeFileSync(join(prismaDir, 'schema.prisma'), schemaContent, 'utf-8');
    console.log(`Generated: ${join(prismaDir, 'schema.prisma')}`);
  }

  console.log(`\nGenerated ${Object.keys(EXAMPLES).length} entity CRUDs to ${OUTPUT_BASE}`);
}

main();
