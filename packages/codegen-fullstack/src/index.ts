/**
 * @isl-lang/codegen-fullstack
 *
 * ISL domain spec → Next.js 14 full-stack TypeScript app generator.
 *
 * @example
 * ```ts
 * import { generateCode, generateCodeStream } from '@isl-lang/codegen-fullstack';
 *
 * const result = await generateCode(spec, { databaseProvider: 'postgresql' });
 * for (const file of result.files) {
 *   await fs.writeFile(file.path, file.content);
 * }
 * ```
 */

export { generateCode, generateCodeStream } from './generator.js';
export { generatePrismaSchema } from './prisma-generator.js';
export { generateApiRoutes } from './api-generator.js';
export type {
  GeneratedFile,
  CodegenOptions,
  CodegenResult,
  StreamChunk,
} from './types.js';
