// Temporary declaration stub for @isl-lang/isl-core
// This will be removed once isl-core has proper declaration files
// These types are compatible with @isl-lang/parser types
declare module '@isl-lang/isl-core' {
  import type { Domain, Behavior, Expression, Import } from '@isl-lang/parser';
  
  // Re-export parser types as isl-core types for compatibility
  export type DomainDeclaration = Domain;
  export type BehaviorDeclaration = Behavior;
  export type Expression = Expression;
  export type ImportDeclaration = Import;
}
