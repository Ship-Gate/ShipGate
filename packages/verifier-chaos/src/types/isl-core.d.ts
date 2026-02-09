/**
 * Temporary type declarations for @isl-lang/isl-core
 * This will be replaced once isl-core generates proper declaration files
 */
declare module '@isl-lang/isl-core' {
  export interface DomainDeclaration {
    name?: { name: string };
    behaviors: Array<BehaviorDeclaration>;
    [key: string]: unknown;
  }
  
  export interface BehaviorDeclaration {
    name: { name: string };
    [key: string]: unknown;
  }
  
  // Re-export from ast subpath
  export * from '@isl-lang/isl-core/ast';
}

declare module '@isl-lang/isl-core/ast' {
  export interface DomainDeclaration {
    name?: { name: string };
    behaviors: Array<BehaviorDeclaration>;
    [key: string]: unknown;
  }
  
  export interface BehaviorDeclaration {
    name: { name: string };
    [key: string]: unknown;
  }
  
  export type DomainDeclaration = DomainDeclaration;
}
