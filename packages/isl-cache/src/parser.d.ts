declare module '@isl-lang/parser' {
  export interface DomainDeclaration {
    name?: { name?: string };
    entities?: Array<{ name?: { name?: string } }>;
    behaviors?: Array<{ name?: { name?: string } }>;
    apis?: Array<{ endpoints?: Array<{ path?: { value?: string } | string }> }>;
  }
  export interface ParseResult {
    success: boolean;
    domain?: DomainDeclaration;
    errors?: unknown[];
  }
  export function parse(source: string, filename?: string): ParseResult;
}
