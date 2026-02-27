/**
 * Entity inferrers - aggregate all entity inference strategies.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InferredEntity, InferredEnum } from '../../types.js';
import { inferFromPrisma } from './prisma-inferrer.js';
import { inferFromZod } from './zod-inferrer.js';
import { inferFromTypeScript } from './typescript-inferrer.js';

export async function inferEntities(
  projectRoot: string,
  sourceFiles: string[],
  ormType: string
): Promise<{ entities: InferredEntity[]; enums: InferredEnum[] }> {
  const entityMap = new Map<string, InferredEntity>();
  const enumMap = new Map<string, InferredEnum>();

  const getSource = async (p: string) => {
    return fs.promises.readFile(p, 'utf-8');
  };

  // 1. Prisma (highest confidence)
  if (ormType === 'prisma') {
    const prismaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
    if (fs.existsSync(prismaPath)) {
      const { entities, enums } = await inferFromPrisma(projectRoot, getSource);
      for (const e of entities) entityMap.set(e.name, e);
      for (const e of enums) enumMap.set(e.name, e);
    }
  }

  // 2. Zod schemas (high confidence)
  const tsFiles = sourceFiles.filter(
    (f) => f.endsWith('.ts') || f.endsWith('.tsx')
  );
  const zodEntities = await inferFromZod(tsFiles, projectRoot);
  for (const e of zodEntities) {
    if (!entityMap.has(e.name) || (entityMap.get(e.name)?.confidence === 'low')) {
      entityMap.set(e.name, e);
    }
  }

  // 3. TypeScript interfaces (medium/low confidence, fill gaps)
  const tsEntities = await inferFromTypeScript(tsFiles);
  for (const e of tsEntities) {
    if (!entityMap.has(e.name)) {
      entityMap.set(e.name, e);
    }
  }

  return {
    entities: Array.from(entityMap.values()),
    enums: Array.from(enumMap.values()),
  };
}

export { inferFromPrisma } from './prisma-inferrer.js';
export { inferFromZod } from './zod-inferrer.js';
export { inferFromTypeScript } from './typescript-inferrer.js';
