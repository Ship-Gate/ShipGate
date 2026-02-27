/**
 * Java Import Parser - Uses java-parser for real CST-based import extraction
 *
 * @module @isl-lang/java-resolver
 */

import { parse, BaseJavaCstVisitorWithDefaults } from 'java-parser';
import type { JavaImport } from './types.js';

/** Visitor that extracts import declarations from Java CST */
class ImportExtractorVisitor extends BaseJavaCstVisitorWithDefaults {
  imports: JavaImport[] = [];

  importDeclaration(ctx: Record<string, unknown>): void {
    const importCtx = ctx as {
      singleTypeImportDeclaration?: Array<{ children: Record<string, unknown> }>;
      typeImportOnDemandDeclaration?: Array<{ children: Record<string, unknown> }>;
      singleStaticImportDeclaration?: Array<{ children: Record<string, unknown> }>;
      staticImportOnDemandDeclaration?: Array<{ children: Record<string, unknown> }>;
    };

    const extractFrom = (
      decl: { children: Record<string, unknown> } | undefined
    ): { fqn: string; isStar: boolean } | null => {
      if (!decl?.children) return null;

      const typeName = decl.children.typeName as Array<{ children: Record<string, unknown> }> | undefined;
      const packageOrTypeName = decl.children.packageOrTypeName as Array<{ children: Record<string, unknown> }> | undefined;
      const hasStar = !!decl.children.Star;

      const parts = this.collectQualifiedName(typeName?.[0] ?? packageOrTypeName?.[0]);
      if (parts.length === 0) return null;

      return {
        fqn: parts.join('.'),
        isStar: !!hasStar,
      };
    };

    const single = importCtx.singleTypeImportDeclaration?.[0];
    const onDemand = importCtx.typeImportOnDemandDeclaration?.[0];
    const staticSingle = importCtx.singleStaticImportDeclaration?.[0];
    const staticOnDemand = importCtx.staticImportOnDemandDeclaration?.[0];

    const decl = single ?? onDemand ?? staticSingle ?? staticOnDemand;
    const result = decl ? extractFrom(decl) : null;

    if (result) {
      const loc = this.getFirstTokenLocation(ctx);
      this.imports.push({
        fqn: result.fqn,
        line: loc.line,
        column: loc.column,
        isStarImport: result.isStar,
      });
    }
  }

  private collectQualifiedName(node: { children: Record<string, unknown> } | undefined): string[] {
    if (!node?.children) return [];

    const identifiers = node.children.Identifier as Array<{ image: string }> | undefined;
    if (identifiers?.length) {
      return identifiers.map((t) => t.image);
    }

    const packageOrTypeName = node.children.packageOrTypeName as Array<{ children: Record<string, unknown> }> | undefined;
    const typeName = node.children.typeName as Array<{ children: Record<string, unknown> }> | undefined;
    const inner = packageOrTypeName?.[0] ?? typeName?.[0];
    if (inner) {
      return this.collectQualifiedName(inner);
    }

    return [];
  }

  private getFirstTokenLocation(ctx: Record<string, unknown>): { line: number; column: number } {
    const tokens = this.collectAllTokens(ctx);
    const first = tokens[0];
    return first
      ? { line: first.startLine ?? 1, column: first.startColumn ?? 0 }
      : { line: 1, column: 0 };
  }

  private collectAllTokens(ctx: Record<string, unknown>): Array<{ image: string; startLine?: number; startColumn?: number }> {
    const tokens: Array<{ image: string; startLine?: number; startColumn?: number }> = [];
    const visit = (obj: unknown): void => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(visit);
        return;
      }
      if (typeof obj === 'object') {
        const o = obj as Record<string, unknown>;
        if ('image' in o && 'startOffset' in o) {
          tokens.push(o as { image: string; startLine?: number; startColumn?: number });
          return;
        }
        Object.values(o).forEach(visit);
      }
    };
    visit(ctx);
    return tokens;
  }
}

/**
 * Parse Java source and extract imports using the java-parser CST
 */
export function parseJavaImports(source: string, filePath = 'unknown'): JavaImport[] {
  try {
    const cst = parse(source);
    if (!cst || !cst.children) return [];

    const visitor = new ImportExtractorVisitor();
    visitor.visit(cst);

    return visitor.imports;
  } catch {
    return [];
  }
}
