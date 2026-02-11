// Declare workspace modules
declare module '@isl-lang/codegen-python' {
  export const generateFiles: any;
  export const generate: any;
  export interface IslDomain {
    name: string;
    version: string;
    entities: IslEntity[];
    behaviors: IslBehavior[];
    enums: IslEnum[];
    types: IslType[];
  }
  export interface IslEntity {
    name: string;
    fields: IslField[];
    invariants: string[];
    lifecycle?: { from: string; to: string }[];
  }
  export interface IslBehavior {
    name: string;
    description?: string;
    input: IslField[];
    output: {
      success: string;
      errors: { code: string; message?: string }[];
    };
    preconditions: string[];
    postconditions: string[];
  }
  export interface IslField {
    name: string;
    type: string;
    optional: boolean;
    modifiers: string[];
    default?: string;
  }
  export interface IslEnum {
    name: string;
    values: string[];
  }
  export interface IslType {
    name: string;
    baseType: string;
    constraints?: Record<string, unknown>;
  }
}

declare module '@isl-lang/codegen-graphql' {
  export const generateGraphQL: any;
  export const generate: any;
  export interface Domain {
    name: string;
    version?: string;
    description?: string;
    types: TypeDeclaration[];
    entities: Entity[];
    behaviors: Behavior[];
    relations?: Relation[];
  }
  export interface Entity {
    name: string;
    description?: string;
    fields: Field[];
    invariants?: string[];
    lifecycle?: any;
  }
  export interface Behavior {
    name: string;
    description?: string;
    input?: Field[];
    output?: {
      success: string;
      errors: Array<{ code: string; message?: string }>;
    };
    preconditions?: string[];
    postconditions?: string[];
  }
  export interface Field {
    name: string;
    type: string;
    optional?: boolean;
    description?: string;
    modifiers?: string[];
    default?: any;
  }
  export interface TypeDeclaration {
    name: string;
    kind: 'alias' | 'enum' | 'union';
    definition: any;
  }
  export interface Relation {
    name: string;
    from: string;
    to: string;
    kind: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }
}
