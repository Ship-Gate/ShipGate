/**
 * ORM Adapter Interface
 * Abstract interface for entity inference from different ORMs.
 */

import type { InferredEntity, InferredEnum } from '../types.js';

export interface OrmAdapter {
  /** ORM identifier */
  readonly name: string;

  /** Whether this adapter can handle the given project (e.g. schema file exists) */
  canHandle(projectRoot: string, sourceFiles: string[]): boolean;

  /** Infer entities and enums from the codebase */
  inferEntities(
    projectRoot: string,
    sourceFiles: string[],
    getSource: (path: string) => Promise<string>
  ): Promise<{ entities: InferredEntity[]; enums: InferredEnum[] }>;
}
