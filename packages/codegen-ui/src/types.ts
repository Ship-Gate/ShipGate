/**
 * UI Code Generation Types
 * 
 * Types for generating Next.js landing pages from ISL UI blueprints.
 */

import type * as AST from '@isl-lang/isl-core/ast/types';

export interface UIGeneratorOptions {
  /** Output directory for generated files */
  outputDir: string;
  /** Use TypeScript (default: true) */
  typescript?: boolean;
  /** Include Tailwind CSS classes (default: true) */
  tailwind?: boolean;
  /** Generate app router or pages router */
  routerType?: 'app' | 'pages';
  /** Include default styles */
  includeStyles?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'page' | 'component' | 'style' | 'config';
}

export interface UIGenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors: UIGenerationError[];
  warnings: UIGenerationWarning[];
}

export interface UIGenerationError {
  code: string;
  message: string;
  node?: AST.ASTNode;
  line?: number;
}

export interface UIGenerationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

/**
 * Safety check result for generated UI
 */
export interface SafetyCheckResult {
  passed: boolean;
  checks: SafetyCheck[];
}

export interface SafetyCheck {
  name: string;
  category: 'a11y' | 'seo' | 'security' | 'perf';
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Design token resolved value
 */
export interface ResolvedToken {
  name: string;
  category: string;
  cssValue: string;
  cssVariable: string;
}
