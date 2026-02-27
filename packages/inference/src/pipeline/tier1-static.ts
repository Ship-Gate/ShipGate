/**
 * Tier 1: Static Signature Extraction
 *
 * Uses the TypeScript compiler API to extract:
 * - Exported functions and methods with full type signatures
 * - Input types, return types, thrown errors
 * - Async/Promise types, nullability (union types, optional params)
 * - Doc comments and JSDoc tags
 * - Runtime behavior hints (fetch, DB, fs, crypto, random, Date.now, mutations)
 *
 * This tier MUST always work — no AI, no heuristics, pure static analysis.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import type {
  TypedIntentIR,
  IRSymbol,
  IRFunction,
  IRMethod,
  IRInterface,
  IRTypeAlias,
  IREnum,
  IRClass,
  IRParameter,
  IRTypeRef,
  IRProperty,
  IRThrownError,
  IRGuardClause,
  IRSideEffect,
  IRJSDoc,
  IRRuntimeHint,
  IRDocEntry,
  IRSourceLocation,
} from './ir.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface Tier1Options {
  /** Only extract exported symbols (default true) */
  exportedOnly?: boolean;
  /** Whether to analyze function bodies for side effects (default true) */
  analyzeBodies?: boolean;
}

/**
 * Run Tier 1 static extraction on the given source files.
 * Returns a TypedIntentIR with all statically extractable information.
 */
export async function extractStaticIR(
  files: string[],
  options: Tier1Options = {},
): Promise<TypedIntentIR> {
  const exportedOnly = options.exportedOnly ?? true;
  const analyzeBodyOpt = options.analyzeBodies ?? true;

  // Read files
  const fileContents = new Map<string, string>();
  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    fileContents.set(file, content);
  }

  // Create TS program
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile;
  host.readFile = (fileName: string) => {
    return fileContents.get(fileName) ?? originalReadFile(fileName);
  };

  const program = ts.createProgram(files, compilerOptions, host);
  const checker = program.getTypeChecker();

  const symbols: IRSymbol[] = [];
  const runtimeHints: IRRuntimeHint[] = [];
  const documentation: IRDocEntry[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!files.includes(sourceFile.fileName)) continue;

    ts.forEachChild(sourceFile, (node) => {
      const isExported = hasExportModifier(node);
      if (exportedOnly && !isExported) return;

      if (ts.isFunctionDeclaration(node) && node.name) {
        const fn = extractFunction(node, sourceFile, checker, isExported, analyzeBodyOpt);
        symbols.push(fn);
        collectRuntimeHints(fn, runtimeHints);
        collectDocEntry(fn.name, fn.jsdoc, documentation);
      } else if (ts.isClassDeclaration(node) && node.name) {
        const cls = extractClass(node, sourceFile, checker, isExported, exportedOnly, analyzeBodyOpt);
        symbols.push(cls);
        for (const method of cls.methods) {
          collectRuntimeHints(method, runtimeHints);
          collectDocEntry(`${cls.name}.${method.name}`, method.jsdoc, documentation);
        }
      } else if (ts.isInterfaceDeclaration(node)) {
        symbols.push(extractInterface(node, sourceFile, checker, isExported));
      } else if (ts.isTypeAliasDeclaration(node)) {
        symbols.push(extractTypeAlias(node, sourceFile, checker, isExported));
      } else if (ts.isEnumDeclaration(node)) {
        symbols.push(extractEnum(node, sourceFile, isExported));
      }
    });
  }

  // Detect language from file extensions
  const lang = files.some((f) => f.endsWith('.js') || f.endsWith('.jsx'))
    ? 'javascript'
    : 'typescript';

  return {
    sourceFiles: files,
    language: lang,
    symbols,
    runtimeHints,
    documentation,
    provenance: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Function extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  exported: boolean,
  analyzeBody: boolean,
): IRFunction {
  const params = extractParameters(node.parameters, sourceFile, checker, node.body, analyzeBody);
  const returnType = resolveReturnType(node, checker);
  const jsdoc = parseJSDoc(node, sourceFile);

  let throwsErrors: IRThrownError[] = [];
  let guardClauses: IRGuardClause[] = [];
  let sideEffects: IRSideEffect[] = [];

  if (analyzeBody && node.body) {
    throwsErrors = extractThrows(node.body, sourceFile);
    guardClauses = extractGuardClauses(node.body, sourceFile, params);
    sideEffects = extractSideEffects(node.body, sourceFile);
  }

  // Merge JSDoc @throws
  if (jsdoc?.throws) {
    for (const t of jsdoc.throws) {
      const name = extractErrorClassName(t);
      if (!throwsErrors.some((e) => e.errorClass === name)) {
        throwsErrors.push({ errorClass: name, message: t });
      }
    }
  }

  return {
    kind: 'function',
    name: node.name!.text,
    exported,
    location: getLocation(node, sourceFile),
    async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
    parameters: params,
    returnType,
    throwsErrors,
    guardClauses,
    sideEffects,
    jsdoc,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Class extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  exported: boolean,
  exportedOnly: boolean,
  analyzeBody: boolean,
): IRClass {
  const properties: IRProperty[] = [];
  const methods: IRMethod[] = [];
  const className = node.name!.text;

  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member) && member.name) {
      properties.push(extractProperty(member, sourceFile, checker));
    } else if (ts.isMethodDeclaration(member) && member.name) {
      const vis = getVisibility(member);
      if (exportedOnly && vis === 'private') continue;

      const methodName = member.name.getText(sourceFile);
      if (methodName === 'constructor') continue;

      const params = extractParameters(member.parameters, sourceFile, checker, member.body, analyzeBody);
      const returnType = resolveReturnType(member, checker);
      const jsdoc = parseJSDoc(member, sourceFile);

      let throwsErrors: IRThrownError[] = [];
      let guardClauses: IRGuardClause[] = [];
      let sideEffects: IRSideEffect[] = [];

      if (analyzeBody && member.body) {
        throwsErrors = extractThrows(member.body, sourceFile);
        guardClauses = extractGuardClauses(member.body, sourceFile, params);
        sideEffects = extractSideEffects(member.body, sourceFile);
      }

      if (jsdoc?.throws) {
        for (const t of jsdoc.throws) {
          const name = extractErrorClassName(t);
          if (!throwsErrors.some((e) => e.errorClass === name)) {
            throwsErrors.push({ errorClass: name, message: t });
          }
        }
      }

      methods.push({
        kind: 'method',
        name: methodName,
        className,
        exported,
        location: getLocation(member, sourceFile),
        async: hasModifier(member, ts.SyntaxKind.AsyncKeyword),
        visibility: vis,
        static: hasModifier(member, ts.SyntaxKind.StaticKeyword),
        parameters: params,
        returnType,
        throwsErrors,
        guardClauses,
        sideEffects,
        jsdoc,
      });
    }
  }

  const extendsClause = node.heritageClauses?.find(
    (c) => c.token === ts.SyntaxKind.ExtendsKeyword,
  );
  const implementsClause = node.heritageClauses?.find(
    (c) => c.token === ts.SyntaxKind.ImplementsKeyword,
  );

  return {
    kind: 'class',
    name: className,
    exported,
    location: getLocation(node, sourceFile),
    properties,
    methods,
    extends: extendsClause?.types[0]?.expression.getText(sourceFile),
    implements: implementsClause?.types.map((t) => t.expression.getText(sourceFile)) ?? [],
    isAbstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractInterface(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  exported: boolean,
): IRInterface {
  const properties: IRProperty[] = [];

  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.name) {
      const name = member.name.getText(sourceFile);
      const typeRef = member.type
        ? resolveTypeRef(member.type, checker)
        : makeUnknownTypeRef();

      properties.push({
        name,
        type: typeRef,
        optional: !!member.questionToken,
        readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
      });
    }
  }

  const extendsClause = node.heritageClauses?.find(
    (c) => c.token === ts.SyntaxKind.ExtendsKeyword,
  );

  return {
    kind: 'interface',
    name: node.name.text,
    exported,
    location: getLocation(node, sourceFile),
    properties,
    extends: extendsClause?.types.map((t) => t.expression.getText(sourceFile)) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type alias extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractTypeAlias(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  exported: boolean,
): IRTypeAlias {
  const isUnion = ts.isUnionTypeNode(node.type);
  let unionMembers: string[] | undefined;
  let isStringLiteralUnion = false;

  if (isUnion && ts.isUnionTypeNode(node.type)) {
    unionMembers = node.type.types.map((t) => {
      if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) {
        return t.literal.text;
      }
      return typeNodeToString(t, checker);
    });
    isStringLiteralUnion = node.type.types.every(
      (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal),
    );
  }

  return {
    kind: 'typeAlias',
    name: node.name.text,
    exported,
    location: getLocation(node, sourceFile),
    typeString: typeNodeToString(node.type, checker),
    unionMembers,
    isUnion,
    isStringLiteralUnion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractEnum(
  node: ts.EnumDeclaration,
  sourceFile: ts.SourceFile,
  exported: boolean,
): IREnum {
  return {
    kind: 'enum',
    name: node.name.text,
    exported,
    location: getLocation(node, sourceFile),
    members: node.members.map((m) => m.name.getText(sourceFile)),
    isConst: hasModifier(node, ts.SyntaxKind.ConstKeyword),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameter extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractParameters(
  params: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  body: ts.Block | undefined,
  analyzeBody: boolean,
): IRParameter[] {
  const result: IRParameter[] = [];

  for (const p of params) {
    const name = p.name.getText(sourceFile);
    const typeRef = p.type
      ? resolveTypeRef(p.type, checker)
      : makeUnknownTypeRef();

    // Check if the parameter is mutated in the body
    let mutated = false;
    if (analyzeBody && body) {
      mutated = isParamMutated(name, body, sourceFile);
    }

    result.push({
      name,
      type: typeRef,
      optional: !!p.questionToken || !!p.initializer,
      defaultValue: p.initializer?.getText(sourceFile),
      mutated,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type resolution
// ─────────────────────────────────────────────────────────────────────────────

function resolveTypeRef(typeNode: ts.TypeNode, checker: ts.TypeChecker): IRTypeRef {
  const type = checker.getTypeFromTypeNode(typeNode);
  const text = checker.typeToString(type);

  const nullable =
    (type.getFlags() & ts.TypeFlags.Null) !== 0 ||
    (type.getFlags() & ts.TypeFlags.Undefined) !== 0 ||
    (type.isUnion() && type.types.some((t) =>
      (t.getFlags() & ts.TypeFlags.Null) !== 0 ||
      (t.getFlags() & ts.TypeFlags.Undefined) !== 0,
    ));

  const isPromise = text.startsWith('Promise<');
  const promiseInner = isPromise
    ? text.slice('Promise<'.length, -1)
    : undefined;

  const isArray =
    text.endsWith('[]') ||
    text.startsWith('Array<') ||
    text.startsWith('ReadonlyArray<');

  let unionParts: string[] | undefined;
  if (type.isUnion()) {
    unionParts = type.types.map((t) => checker.typeToString(t));
  }

  return { text, nullable, isPromise, promiseInner, isArray, unionParts };
}

function resolveReturnType(
  node: ts.FunctionDeclaration | ts.MethodDeclaration,
  checker: ts.TypeChecker,
): IRTypeRef {
  if (node.type) {
    return resolveTypeRef(node.type, checker);
  }
  // Infer from checker
  const sig = checker.getSignatureFromDeclaration(node);
  if (sig) {
    const returnType = checker.getReturnTypeOfSignature(sig);
    const text = checker.typeToString(returnType);
    const nullable =
      (returnType.getFlags() & ts.TypeFlags.Null) !== 0 ||
      (returnType.getFlags() & ts.TypeFlags.Undefined) !== 0;
    const isPromise = text.startsWith('Promise<');
    const promiseInner = isPromise ? text.slice('Promise<'.length, -1) : undefined;
    const isArray = text.endsWith('[]') || text.startsWith('Array<');
    return { text, nullable, isPromise, promiseInner, isArray };
  }
  return { text: 'void', nullable: false, isPromise: false, isArray: false };
}

function makeUnknownTypeRef(): IRTypeRef {
  return { text: 'unknown', nullable: false, isPromise: false, isArray: false };
}

function typeNodeToString(typeNode: ts.TypeNode, checker: ts.TypeChecker): string {
  const type = checker.getTypeFromTypeNode(typeNode);
  return checker.typeToString(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Body analysis: throws, guard clauses, side effects
// ─────────────────────────────────────────────────────────────────────────────

function extractThrows(body: ts.Block, sourceFile: ts.SourceFile): IRThrownError[] {
  const errors: IRThrownError[] = [];

  function visit(node: ts.Node) {
    if (ts.isThrowStatement(node) && node.expression) {
      if (ts.isNewExpression(node.expression)) {
        const errorClass = node.expression.expression.getText(sourceFile);
        let message: string | undefined;
        const firstArg = node.expression.arguments?.[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          message = firstArg.text;
        }

        // Try to find the enclosing if-condition
        let guardCondition: string | undefined;
        let parent = node.parent;
        while (parent) {
          if (ts.isIfStatement(parent)) {
            guardCondition = parent.expression.getText(sourceFile);
            break;
          }
          if (ts.isBlock(parent) && ts.isIfStatement(parent.parent)) {
            guardCondition = parent.parent.expression.getText(sourceFile);
            break;
          }
          parent = parent.parent;
        }

        if (!errors.some((e) => e.errorClass === errorClass && e.message === message)) {
          errors.push({ errorClass, message, guardCondition });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(body, visit);
  return errors;
}

function extractGuardClauses(
  body: ts.Block,
  sourceFile: ts.SourceFile,
  params: IRParameter[],
): IRGuardClause[] {
  const guards: IRGuardClause[] = [];
  const paramNames = new Set(params.map((p) => p.name));

  // Only look at top-level statements in the body (guard clauses are at the top)
  for (const stmt of body.statements) {
    if (!ts.isIfStatement(stmt)) {
      // Once we hit a non-if statement, stop looking for guards
      // (unless the first non-if is a variable declaration)
      if (!ts.isVariableStatement(stmt)) break;
      continue;
    }

    // Check if the then-branch throws or returns early
    const thenBranch = stmt.thenStatement;
    let throwInfo: IRThrownError | undefined;
    let isEarlyReturn = false;

    if (ts.isBlock(thenBranch)) {
      for (const s of thenBranch.statements) {
        if (ts.isThrowStatement(s) && s.expression && ts.isNewExpression(s.expression)) {
          const errorClass = s.expression.expression.getText(sourceFile);
          let message: string | undefined;
          const firstArg = s.expression.arguments?.[0];
          if (firstArg && ts.isStringLiteral(firstArg)) {
            message = firstArg.text;
          }
          throwInfo = { errorClass, message };
        }
        if (ts.isReturnStatement(s)) {
          isEarlyReturn = true;
        }
      }
    } else if (ts.isThrowStatement(thenBranch)) {
      if (thenBranch.expression && ts.isNewExpression(thenBranch.expression)) {
        const errorClass = thenBranch.expression.expression.getText(sourceFile);
        let message: string | undefined;
        const firstArg = thenBranch.expression.arguments?.[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          message = firstArg.text;
        }
        throwInfo = { errorClass, message };
      }
    } else if (ts.isReturnStatement(thenBranch)) {
      isEarlyReturn = true;
    }

    if (!throwInfo && !isEarlyReturn) continue;

    const condition = stmt.expression.getText(sourceFile);
    const positiveCondition = negateCondition(condition);

    // Determine which params are referenced
    const referencedParams: string[] = [];
    for (const pName of paramNames) {
      if (condition.includes(pName)) {
        referencedParams.push(pName);
      }
    }

    guards.push({
      condition,
      positiveCondition,
      error: throwInfo,
      referencedParams,
    });
  }

  return guards;
}

/** Side-effect detection patterns */
const SIDE_EFFECT_PATTERNS: Array<{
  pattern: RegExp;
  type: IRSideEffect['type'];
  targetExtractor?: (match: string) => string;
}> = [
  // DB reads
  { pattern: /\.find\w*\(/, type: 'db-read' },
  { pattern: /\.get\w*\(/, type: 'db-read' },
  { pattern: /\.query\(/, type: 'db-read' },
  { pattern: /\.select\(/, type: 'db-read' },
  { pattern: /\.count\(/, type: 'db-read' },
  // DB writes
  { pattern: /\.create\(/, type: 'db-write' },
  { pattern: /\.insert\(/, type: 'db-write' },
  { pattern: /\.save\(/, type: 'db-write' },
  { pattern: /\.update\(/, type: 'db-write' },
  { pattern: /\.upsert\(/, type: 'db-write' },
  // DB deletes
  { pattern: /\.delete\(/, type: 'db-delete' },
  { pattern: /\.remove\(/, type: 'db-delete' },
  { pattern: /\.destroy\(/, type: 'db-delete' },
  // HTTP
  { pattern: /\bfetch\(/, type: 'http' },
  { pattern: /axios[.(]/, type: 'http' },
  { pattern: /\.request\(/, type: 'http' },
  { pattern: /http\.get\(/, type: 'http' },
  { pattern: /http\.post\(/, type: 'http' },
  // Filesystem
  { pattern: /fs\.\w+/, type: 'fs' },
  { pattern: /readFile/, type: 'fs' },
  { pattern: /writeFile/, type: 'fs' },
  // Crypto
  { pattern: /crypto\./, type: 'crypto' },
  { pattern: /bcrypt\./, type: 'crypto' },
  { pattern: /\.hash\(/, type: 'crypto' },
  { pattern: /\.encrypt\(/, type: 'crypto' },
  { pattern: /\.decrypt\(/, type: 'crypto' },
  // Randomness
  { pattern: /Math\.random\(/, type: 'random' },
  { pattern: /uuid\(/, type: 'random' },
  { pattern: /randomBytes\(/, type: 'random' },
  // Time
  { pattern: /Date\.now\(/, type: 'time' },
  { pattern: /new Date\(/, type: 'time' },
  // Global writes
  { pattern: /process\.env/, type: 'global-write' },
  { pattern: /globalThis\./, type: 'global-write' },
];

function extractSideEffects(body: ts.Block, sourceFile: ts.SourceFile): IRSideEffect[] {
  const effects: IRSideEffect[] = [];
  const seen = new Set<string>();

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
      const callText = node.getText(sourceFile);

      for (const { pattern, type } of SIDE_EFFECT_PATTERNS) {
        if (pattern.test(callText)) {
          const target = extractCallTarget(callText);
          const key = `${type}:${target}`;
          if (!seen.has(key)) {
            seen.add(key);
            effects.push({ type, target, callText: truncate(callText, 120) });
          }
          break;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(body, visit);
  return effects;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameter mutation detection
// ─────────────────────────────────────────────────────────────────────────────

function isParamMutated(paramName: string, body: ts.Block, sourceFile: ts.SourceFile): boolean {
  let mutated = false;

  function visit(node: ts.Node) {
    if (mutated) return;

    // Assignment to param property: param.x = ...
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const leftText = node.left.getText(sourceFile);
      if (leftText.startsWith(paramName + '.') || leftText === paramName) {
        mutated = true;
        return;
      }
    }

    // Method calls that mutate: param.push(), param.splice(), etc.
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sourceFile);
      const mutatingMethods = ['.push(', '.pop(', '.splice(', '.shift(', '.unshift(', '.sort(', '.reverse(', '.fill(', '.set('];
      if (callText.startsWith(paramName + '.') && mutatingMethods.some((m) => callText.includes(m))) {
        mutated = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(body, visit);
  return mutated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractProperty(
  member: ts.PropertyDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): IRProperty {
  const name = member.name.getText(sourceFile);
  const typeRef = member.type
    ? resolveTypeRef(member.type, checker)
    : makeUnknownTypeRef();

  return {
    name,
    type: typeRef,
    optional: !!member.questionToken,
    readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
    initializer: member.initializer?.getText(sourceFile),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSDoc parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseJSDoc(node: ts.Node, sourceFile: ts.SourceFile): IRJSDoc | undefined {
  const jsdocTags = ts.getJSDocTags(node);
  if (jsdocTags.length === 0) {
    // Check for bare JSDoc comment without tags
    const jsdocComments = ts.getJSDocCommentsAndTags(node);
    if (jsdocComments.length === 0) return undefined;

    let description: string | undefined;
    for (const comment of jsdocComments) {
      if (ts.isJSDoc(comment) && comment.comment) {
        description = typeof comment.comment === 'string' ? comment.comment : undefined;
      }
    }
    if (!description) return undefined;

    return {
      description,
      params: new Map(),
      throws: [],
      tags: new Map(),
    };
  }

  const params = new Map<string, string>();
  let description: string | undefined;
  let returns: string | undefined;
  const throws: string[] = [];
  const tags = new Map<string, string>();

  const jsdocComments = ts.getJSDocCommentsAndTags(node);
  for (const comment of jsdocComments) {
    if (ts.isJSDoc(comment) && comment.comment) {
      description = typeof comment.comment === 'string' ? comment.comment : undefined;
    }
  }

  for (const tag of jsdocTags) {
    const tagComment = typeof tag.comment === 'string' ? tag.comment : '';

    if (ts.isJSDocParameterTag(tag) && tag.name) {
      const paramName = tag.name.getText(sourceFile);
      params.set(paramName, tagComment);
    } else if (ts.isJSDocReturnTag(tag)) {
      returns = tagComment || undefined;
    } else if (tag.tagName.text === 'throws' || tag.tagName.text === 'exception') {
      throws.push(tagComment);
    } else {
      tags.set(tag.tagName.text, tagComment);
    }
  }

  return {
    description,
    params,
    returns,
    throws,
    tags,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime hint collection
// ─────────────────────────────────────────────────────────────────────────────

function collectRuntimeHints(
  fn: IRFunction | IRMethod,
  hints: IRRuntimeHint[],
): void {
  const symbolName = fn.kind === 'method' ? `${fn.className}.${fn.name}` : fn.name;

  for (const effect of fn.sideEffects) {
    let category: IRRuntimeHint['category'];
    let detail: string;

    switch (effect.type) {
      case 'http':
        category = 'io';
        detail = `HTTP call: ${effect.target}`;
        break;
      case 'fs':
        category = 'io';
        detail = `Filesystem access: ${effect.target}`;
        break;
      case 'db-read':
      case 'db-write':
      case 'db-delete':
        category = 'side-effect';
        detail = `Database ${effect.type.replace('db-', '')}: ${effect.target}`;
        break;
      case 'crypto':
        category = 'security';
        detail = `Crypto operation: ${effect.target}`;
        break;
      case 'random':
        category = 'nondeterminism';
        detail = `Random/UUID generation: ${effect.target}`;
        break;
      case 'time':
        category = 'nondeterminism';
        detail = `Time-dependent: ${effect.target}`;
        break;
      case 'global-write':
        category = 'mutation';
        detail = `Global state write: ${effect.target}`;
        break;
      case 'param-mutation':
        category = 'mutation';
        detail = `Parameter mutation: ${effect.target}`;
        break;
      case 'external':
        category = 'io';
        detail = `External call: ${effect.target}`;
        break;
    }

    hints.push({ symbolName, category, detail, location: fn.location });
  }

  // Also flag mutated parameters
  for (const param of fn.parameters) {
    if (param.mutated) {
      hints.push({
        symbolName,
        category: 'mutation',
        detail: `Mutates parameter "${param.name}"`,
        location: fn.location,
      });
    }
  }
}

function collectDocEntry(
  symbolName: string,
  jsdoc: IRJSDoc | undefined,
  docs: IRDocEntry[],
): void {
  if (jsdoc) {
    docs.push({ symbolName, jsdoc });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false;
}

function getVisibility(member: ts.MethodDeclaration): 'public' | 'protected' | 'private' {
  if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) return 'private';
  if (hasModifier(member, ts.SyntaxKind.ProtectedKeyword)) return 'protected';
  return 'public';
}

function getLocation(node: ts.Node, sourceFile: ts.SourceFile): IRSourceLocation {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { file: sourceFile.fileName, line: line + 1, column: character + 1 };
}

function negateCondition(condition: string): string {
  const trimmed = condition.trim();
  if (trimmed.startsWith('!') && !trimmed.startsWith('!=')) {
    // !x → x, !(expr) → expr
    if (trimmed.startsWith('!(') && trimmed.endsWith(')')) {
      return trimmed.slice(2, -1);
    }
    return trimmed.slice(1);
  }
  return `!(${trimmed})`;
}

function extractCallTarget(callText: string): string {
  // "db.users.create({ ... })" → "db.users"
  const match = callText.match(/^([\w.]+)\.\w+\(/);
  if (match) return match[1]!;
  // "fetch('...')" → "fetch"
  const fnMatch = callText.match(/^(\w+)\(/);
  if (fnMatch) return fnMatch[1]!;
  return callText.slice(0, 40);
}

function extractErrorClassName(text: string): string {
  const match = text.match(/^(\w+Error|\w+Exception)/);
  return match ? match[1]! : 'Error';
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
