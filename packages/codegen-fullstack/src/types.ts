/**
 * Codegen Types
 * @module @isl-lang/codegen-fullstack/types
 */

import type { GeneratedSpec } from '@isl-lang/spec-generator';

export interface GeneratedFile {
  path: string;
  content: string;
  language: 'typescript' | 'prisma' | 'json' | 'css' | 'env' | 'markdown';
  description: string;
}

export interface CodegenOptions {
  appName?: string;
  databaseProvider?: 'postgresql' | 'sqlite' | 'mysql';
  authProvider?: 'nextauth' | 'clerk' | 'lucia';
  includeTests?: boolean;
  includeStorybook?: boolean;
  stylingLib?: 'tailwind' | 'shadcn' | 'chakra';
}

export interface CodegenResult {
  success: boolean;
  files: GeneratedFile[];
  spec: GeneratedSpec;
  warnings: string[];
  errors: string[];
  stats: {
    totalFiles: number;
    totalLines: number;
    entities: number;
    behaviors: number;
    apiRoutes: number;
    components: number;
  };
}

export interface StreamChunk {
  type: 'file_start' | 'file_content' | 'file_end' | 'progress' | 'done' | 'error';
  path?: string;
  content?: string;
  message?: string;
  progress?: { current: number; total: number; phase: string };
}
