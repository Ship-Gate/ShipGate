/**
 * Code Fact Extractor
 *
 * Statically extracts typed function signatures, control flow IR,
 * throw sites, external calls, return shapes, and docstrings from
 * TypeScript/JavaScript source code — without executing it.
 *
 * @module @isl-lang/ai-generator/grounded-spec/fact-extractor
 */

import * as ts from 'typescript';
import type {
  FunctionSignature,
  ParameterInfo,
  ControlFlowIR,
  ThrowSite,
  ExternalCall,
  ReturnShape,
  DocstringInfo,
  SourceSpan,
  CodeFacts,
} from './types.js';
import { detectSchemas } from './schema-detector.js';
import { findCallSites } from './call-site-finder.js';

// ============================================================================
// Main entry
// ============================================================================

export interface FactExtractorOptions {
  filePath: string;
  sourceCode: string;
  projectRoot?: string;
  maxCallSites?: number;
}

/**
 * Extract all code facts from a source file.
 * Returns one CodeFacts bundle per exported function/method.
 */
export async function extractCodeFacts(options: FactExtractorOptions): Promise<CodeFacts[]> {
  const { filePath, sourceCode, projectRoot, maxCallSites = 3 } = options;

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  const functions = extractFunctionSignatures(sourceFile, filePath);
  const schemas = detectSchemas(sourceCode, filePath);
  const results: CodeFacts[] = [];

  for (const sig of functions) {
    const funcBody = extractFunctionBody(sourceCode, sig.location);
    const controlFlow = extractControlFlow(sourceFile, sig);
    const docstring = extractDocstring(sourceFile, sig);

    let callSites: Awaited<ReturnType<typeof findCallSites>> = [];
    if (projectRoot) {
      callSites = await findCallSites({
        functionName: sig.name,
        projectRoot,
        filePath,
        maxResults: maxCallSites,
      });
    }

    results.push({
      signature: sig,
      controlFlow,
      docstring,
      schemas,
      callSites,
      sourceCode: funcBody,
    });
  }

  return results;
}

// ============================================================================
// Function Signature Extraction
// ============================================================================

function extractFunctionSignatures(sourceFile: ts.SourceFile, filePath: string): FunctionSignature[] {
  const signatures: FunctionSignature[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      signatures.push(buildSignature(node, node.name.text, sourceFile, filePath));
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            const isExported = hasExportModifier(node);
            const sig = buildSignatureFromExpression(
              decl.initializer,
              decl.name.text,
              sourceFile,
              filePath,
              isExported,
            );
            signatures.push(sig);
          }
        }
      }
    } else if (ts.isMethodDeclaration(node) && node.name) {
      const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
      signatures.push(buildSignature(node, name, sourceFile, filePath));
    } else if (ts.isExportAssignment(node) && node.expression) {
      if (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression)) {
        const sig = buildSignatureFromExpression(
          node.expression,
          'default',
          sourceFile,
          filePath,
          true,
        );
        signatures.push(sig);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return signatures;
}

function buildSignature(
  node: ts.FunctionDeclaration | ts.MethodDeclaration,
  name: string,
  sourceFile: ts.SourceFile,
  filePath: string,
): FunctionSignature {
  const params = extractParams(node.parameters, sourceFile);
  const returnType = node.type ? node.type.getText(sourceFile) : null;
  const isAsync = hasAsyncModifier(node);
  const isExported = ts.isFunctionDeclaration(node) ? hasExportModifier(node) : false;
  const isGenerator = !!node.asteriskToken;
  const typeParameters = extractTypeParameters(node.typeParameters, sourceFile);
  const location = getSpan(node, sourceFile, filePath);

  return { name, params, returnType, isAsync, isExported, isGenerator, typeParameters, location };
}

function buildSignatureFromExpression(
  node: ts.ArrowFunction | ts.FunctionExpression,
  name: string,
  sourceFile: ts.SourceFile,
  filePath: string,
  isExported: boolean,
): FunctionSignature {
  const params = extractParams(node.parameters, sourceFile);
  const returnType = node.type ? node.type.getText(sourceFile) : null;
  const isAsync = hasAsyncModifier(node);
  const isGenerator = ts.isFunctionExpression(node) ? !!node.asteriskToken : false;
  const typeParameters = extractTypeParameters(node.typeParameters, sourceFile);
  const location = getSpan(node, sourceFile, filePath);

  return { name, params, returnType, isAsync, isExported, isGenerator, typeParameters, location };
}

function extractParams(
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile,
): ParameterInfo[] {
  return parameters.map((p) => ({
    name: p.name.getText(sourceFile),
    type: p.type ? p.type.getText(sourceFile) : null,
    optional: !!p.questionToken || !!p.initializer,
    defaultValue: p.initializer ? p.initializer.getText(sourceFile) : null,
    rest: !!p.dotDotDotToken,
  }));
}

function extractTypeParameters(
  typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
  sourceFile: ts.SourceFile,
): string[] {
  if (!typeParams) return [];
  return typeParams.map((tp) => tp.getText(sourceFile));
}

// ============================================================================
// Control Flow IR Extraction
// ============================================================================

function extractControlFlow(sourceFile: ts.SourceFile, sig: FunctionSignature): ControlFlowIR {
  const throwSites: ThrowSite[] = [];
  const externalCalls: ExternalCall[] = [];
  const returnShapes: ReturnShape[] = [];
  let branches = 0;
  let loops = 0;
  let earlyReturns = 0;
  let awaitPoints = 0;
  let returnCount = 0;

  function visit(node: ts.Node) {
    // Throw sites
    if (ts.isThrowStatement(node) && node.expression) {
      throwSites.push(parseThrowSite(node, sourceFile));
    }

    // Branches
    if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node)) {
      branches++;
    }

    // Loops
    if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      loops++;
    }

    // Return statements
    if (ts.isReturnStatement(node)) {
      returnCount++;
      if (node.expression) {
        returnShapes.push(parseReturnShape(node, sourceFile));
      }
    }

    // Await expressions
    if (ts.isAwaitExpression(node)) {
      awaitPoints++;
    }

    // External calls (function calls and method calls)
    if (ts.isCallExpression(node)) {
      externalCalls.push(parseExternalCall(node, sourceFile));
    }

    ts.forEachChild(node, visit);
  }

  // Walk the function body only
  const funcNode = findFunctionNode(sourceFile, sig.location.startLine);
  if (funcNode) {
    const body = getFunctionBody(funcNode);
    if (body) {
      ts.forEachChild(body, visit);
    }
  }

  // Early returns = all returns minus 1 (the final return)
  earlyReturns = Math.max(0, returnCount - 1);

  return {
    functionName: sig.name,
    throwSites,
    externalCalls,
    returnShapes,
    branches,
    loops,
    earlyReturns,
    awaitPoints,
  };
}

function parseThrowSite(node: ts.ThrowStatement, sourceFile: ts.SourceFile): ThrowSite {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  let errorType = 'Error';
  let message: string | null = null;

  if (node.expression && ts.isNewExpression(node.expression)) {
    const expr = node.expression;
    errorType = expr.expression.getText(sourceFile);
    if (expr.arguments && expr.arguments.length > 0) {
      const firstArg = expr.arguments[0]!;
      if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
        message = firstArg.text;
      } else {
        message = firstArg.getText(sourceFile);
      }
    }
  } else if (node.expression) {
    errorType = node.expression.getText(sourceFile);
  }

  // Try to find enclosing if-condition
  let condition: string | null = null;
  let parent = node.parent;
  while (parent) {
    if (ts.isIfStatement(parent)) {
      condition = parent.expression.getText(sourceFile);
      break;
    }
    parent = parent.parent;
  }

  return { errorType, message, line, condition };
}

function parseExternalCall(node: ts.CallExpression, sourceFile: ts.SourceFile): ExternalCall {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  let callee: string;
  let method: string | null = null;

  if (ts.isPropertyAccessExpression(node.expression)) {
    const propAccess = node.expression;
    callee = propAccess.expression.getText(sourceFile);
    method = propAccess.name.text;
  } else {
    callee = node.expression.getText(sourceFile);
  }

  // Check if wrapped in await
  const isAwait = node.parent && ts.isAwaitExpression(node.parent);

  return { callee, method, line, isAwait: !!isAwait };
}

function parseReturnShape(node: ts.ReturnStatement, sourceFile: ts.SourceFile): ReturnShape {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const expression = node.expression ? node.expression.getText(sourceFile) : 'undefined';
  const fields: string[] = [];

  if (node.expression && ts.isObjectLiteralExpression(node.expression)) {
    for (const prop of node.expression.properties) {
      if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
        fields.push(prop.name?.getText(sourceFile) ?? '');
      }
    }
  }

  return { expression, line, fields };
}

// ============================================================================
// Docstring Extraction
// ============================================================================

function extractDocstring(sourceFile: ts.SourceFile, sig: FunctionSignature): DocstringInfo | null {
  const funcNode = findFunctionNode(sourceFile, sig.location.startLine);
  if (!funcNode) return null;

  const jsDocNodes = ts.getJSDocCommentsAndTags(funcNode);
  if (jsDocNodes.length === 0) return null;

  const info: DocstringInfo = {
    summary: '',
    params: [],
    returns: null,
    throws: [],
    tags: [],
  };

  for (const jsdoc of jsDocNodes) {
    if (ts.isJSDoc(jsdoc)) {
      if (jsdoc.comment) {
        info.summary = typeof jsdoc.comment === 'string'
          ? jsdoc.comment
          : jsdoc.comment.map((c) => c.getText()).join('');
      }
      if (jsdoc.tags) {
        for (const tag of jsdoc.tags) {
          const tagName = tag.tagName.text;
          const tagComment = tag.comment
            ? (typeof tag.comment === 'string' ? tag.comment : tag.comment.map((c) => c.getText()).join(''))
            : '';

          if (tagName === 'param' && ts.isJSDocParameterTag(tag)) {
            info.params.push({
              name: tag.name.getText(),
              description: tagComment,
            });
          } else if (tagName === 'returns' || tagName === 'return') {
            info.returns = tagComment;
          } else if (tagName === 'throws' || tagName === 'exception') {
            const match = tagComment.match(/^\{?(\w+)\}?\s*(.*)/);
            if (match) {
              info.throws.push({ type: match[1]!, description: match[2] ?? '' });
            } else {
              info.throws.push({ type: 'Error', description: tagComment });
            }
          } else {
            info.tags.push({ tag: tagName, value: tagComment });
          }
        }
      }
    }
  }

  return info.summary || info.params.length > 0 || info.returns || info.throws.length > 0
    ? info
    : null;
}

// ============================================================================
// Helpers
// ============================================================================

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasAsyncModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}

function getSpan(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): SourceSpan {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return { file: filePath, startLine: start.line + 1, endLine: end.line + 1 };
}

function extractFunctionBody(sourceCode: string, span: SourceSpan): string {
  const lines = sourceCode.split('\n');
  return lines.slice(span.startLine - 1, span.endLine).join('\n');
}

function findFunctionNode(sourceFile: ts.SourceFile, startLine: number): ts.Node | null {
  let result: ts.Node | null = null;

  function visit(node: ts.Node) {
    if (result) return;
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    if (line === startLine) {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
          ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        result = node;
        return;
      }
    }

    // For variable declarations wrapping arrow functions
    if (ts.isVariableStatement(node)) {
      const stmtLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (stmtLine === startLine) {
        for (const decl of node.declarationList.declarations) {
          if (decl.initializer &&
              (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            result = decl.initializer;
            return;
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

function getFunctionBody(node: ts.Node): ts.Node | null {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.body ?? null;
  }
  if (ts.isArrowFunction(node)) {
    return node.body;
  }
  return null;
}
