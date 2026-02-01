// ============================================================================
// Property Test Generator Types
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

export interface GenerateOptions {
  iterations?: number;
  seed?: number;
  verbose?: boolean;
  includeInvariants?: boolean;
  includePostconditions?: boolean;
  includeEntityTests?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'test' | 'arbitrary' | 'helper';
}

export interface ArbitraryDefinition {
  name: string;
  code: string;
  dependencies: string[];
}

export interface PropertyDefinition {
  name: string;
  description: string;
  arbitraries: string[];
  assertion: string;
  async: boolean;
}

export interface ConstraintInfo {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'format' | 'precision';
  value: unknown;
}

export interface TypeMapping {
  islType: string;
  fcArbitrary: string;
  constraints: ConstraintInfo[];
}

export interface ShrinkerDefinition {
  name: string;
  targetType: string;
  code: string;
}
