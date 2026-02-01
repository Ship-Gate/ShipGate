/**
 * TypeScript Parser
 *
 * Parse TypeScript source files to extract type and function information.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface TypeScriptParseResult {
  language: 'typescript';
  sourceFile: ts.SourceFile;
  program: ts.Program;
  checker: ts.TypeChecker;
  interfaces: ParsedInterface[];
  types: ParsedTypeAlias[];
  enums: ParsedEnum[];
  functions: ParsedFunction[];
  classes: ParsedClass[];
}

export interface ParsedInterface {
  name: string;
  properties: ParsedProperty[];
  extends?: string[];
  location: ParsedLocation;
}

export interface ParsedTypeAlias {
  name: string;
  type: string;
  isUnion: boolean;
  unionMembers?: string[];
  location: ParsedLocation;
}

export interface ParsedEnum {
  name: string;
  members: string[];
  location: ParsedLocation;
}

export interface ParsedProperty {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
  initializer?: string;
}

export interface ParsedFunction {
  name: string;
  async: boolean;
  parameters: ParsedParameter[];
  returnType: string;
  body?: ts.Block;
  location: ParsedLocation;
  jsdoc?: ParsedJSDoc;
}

export interface ParsedParameter {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ParsedClass {
  name: string;
  properties: ParsedProperty[];
  methods: ParsedFunction[];
  extends?: string;
  implements?: string[];
  location: ParsedLocation;
}

export interface ParsedLocation {
  file: string;
  line: number;
  column: number;
}

export interface ParsedJSDoc {
  description?: string;
  params: Map<string, string>;
  returns?: string;
  throws?: string[];
}

/**
 * Parse TypeScript source files
 */
export async function parseTypeScript(files: string[]): Promise<TypeScriptParseResult> {
  // Read file contents
  const fileContents = new Map<string, string>();
  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    fileContents.set(file, content);
  }

  // Create program
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

  const interfaces: ParsedInterface[] = [];
  const types: ParsedTypeAlias[] = [];
  const enums: ParsedEnum[] = [];
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!files.includes(sourceFile.fileName)) continue;

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isInterfaceDeclaration(node)) {
        interfaces.push(parseInterface(node, sourceFile, checker));
      } else if (ts.isTypeAliasDeclaration(node)) {
        types.push(parseTypeAlias(node, sourceFile, checker));
      } else if (ts.isEnumDeclaration(node)) {
        enums.push(parseEnum(node, sourceFile));
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(parseFunction(node, sourceFile, checker));
      } else if (ts.isClassDeclaration(node) && node.name) {
        classes.push(parseClass(node, sourceFile, checker));
      }
    });
  }

  return {
    language: 'typescript',
    sourceFile: program.getSourceFiles().find((f) => files.includes(f.fileName))!,
    program,
    checker,
    interfaces,
    types,
    enums,
    functions,
    classes,
  };
}

function parseInterface(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ParsedInterface {
  const properties: ParsedProperty[] = [];

  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.name) {
      const name = member.name.getText(sourceFile);
      const type = member.type ? typeToString(member.type, checker) : 'unknown';
      properties.push({
        name,
        type,
        optional: !!member.questionToken,
        readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
      });
    }
  }

  const extendsClause = node.heritageClauses?.find(
    (c) => c.token === ts.SyntaxKind.ExtendsKeyword
  );
  const extendsTypes = extendsClause?.types.map((t) => t.expression.getText(sourceFile));

  return {
    name: node.name.text,
    properties,
    extends: extendsTypes,
    location: getLocation(node, sourceFile),
  };
}

function parseTypeAlias(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ParsedTypeAlias {
  const isUnion = ts.isUnionTypeNode(node.type);
  let unionMembers: string[] | undefined;

  if (isUnion && ts.isUnionTypeNode(node.type)) {
    unionMembers = node.type.types.map((t) => {
      if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) {
        return t.literal.text;
      }
      return typeToString(t, checker);
    });
  }

  return {
    name: node.name.text,
    type: typeToString(node.type, checker),
    isUnion,
    unionMembers,
    location: getLocation(node, sourceFile),
  };
}

function parseEnum(node: ts.EnumDeclaration, sourceFile: ts.SourceFile): ParsedEnum {
  const members = node.members.map((m) => m.name.getText(sourceFile));

  return {
    name: node.name.text,
    members,
    location: getLocation(node, sourceFile),
  };
}

function parseFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ParsedFunction {
  const parameters: ParsedParameter[] = node.parameters.map((p) => ({
    name: p.name.getText(sourceFile),
    type: p.type ? typeToString(p.type, checker) : 'unknown',
    optional: !!p.questionToken || !!p.initializer,
    defaultValue: p.initializer?.getText(sourceFile),
  }));

  const returnType = node.type ? typeToString(node.type, checker) : 'void';

  return {
    name: node.name!.text,
    async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
    parameters,
    returnType,
    body: node.body,
    location: getLocation(node, sourceFile),
    jsdoc: parseJSDoc(node, sourceFile),
  };
}

function parseClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ParsedClass {
  const properties: ParsedProperty[] = [];
  const methods: ParsedFunction[] = [];

  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member) && member.name) {
      properties.push({
        name: member.name.getText(sourceFile),
        type: member.type ? typeToString(member.type, checker) : 'unknown',
        optional: !!member.questionToken,
        readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
        initializer: member.initializer?.getText(sourceFile),
      });
    } else if (ts.isMethodDeclaration(member) && member.name) {
      const params: ParsedParameter[] = member.parameters.map((p) => ({
        name: p.name.getText(sourceFile),
        type: p.type ? typeToString(p.type, checker) : 'unknown',
        optional: !!p.questionToken || !!p.initializer,
        defaultValue: p.initializer?.getText(sourceFile),
      }));

      methods.push({
        name: member.name.getText(sourceFile),
        async: hasModifier(member, ts.SyntaxKind.AsyncKeyword),
        parameters: params,
        returnType: member.type ? typeToString(member.type, checker) : 'void',
        body: member.body,
        location: getLocation(member, sourceFile),
        jsdoc: parseJSDoc(member, sourceFile),
      });
    }
  }

  const extendsClause = node.heritageClauses?.find(
    (c) => c.token === ts.SyntaxKind.ExtendsKeyword
  );
  const implementsClause = node.heritageClauses?.find(
    (c) => c.token === ts.SyntaxKind.ImplementsKeyword
  );

  return {
    name: node.name!.text,
    properties,
    methods,
    extends: extendsClause?.types[0]?.expression.getText(sourceFile),
    implements: implementsClause?.types.map((t) => t.expression.getText(sourceFile)),
    location: getLocation(node, sourceFile),
  };
}

function typeToString(node: ts.TypeNode, checker: ts.TypeChecker): string {
  const type = checker.getTypeFromTypeNode(node);
  return checker.typeToString(type);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node)
    ? ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false
    : false;
}

function getLocation(node: ts.Node, sourceFile: ts.SourceFile): ParsedLocation {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
  };
}

function parseJSDoc(node: ts.Node, sourceFile: ts.SourceFile): ParsedJSDoc | undefined {
  const jsdocTags = ts.getJSDocTags(node);
  if (jsdocTags.length === 0) return undefined;

  const params = new Map<string, string>();
  let description: string | undefined;
  let returns: string | undefined;
  const throws: string[] = [];

  const jsdocComments = ts.getJSDocCommentsAndTags(node);
  for (const comment of jsdocComments) {
    if (ts.isJSDoc(comment) && comment.comment) {
      description = typeof comment.comment === 'string' ? comment.comment : undefined;
    }
  }

  for (const tag of jsdocTags) {
    if (ts.isJSDocParameterTag(tag) && tag.name) {
      const paramName = tag.name.getText(sourceFile);
      const paramDesc = typeof tag.comment === 'string' ? tag.comment : '';
      params.set(paramName, paramDesc);
    } else if (ts.isJSDocReturnTag(tag)) {
      returns = typeof tag.comment === 'string' ? tag.comment : undefined;
    } else if (tag.tagName.text === 'throws') {
      throws.push(typeof tag.comment === 'string' ? tag.comment : '');
    }
  }

  return { description, params, returns, throws: throws.length > 0 ? throws : undefined };
}

/**
 * Extract validation patterns from function body
 */
export function extractValidationsFromBody(body: ts.Block, sourceFile: ts.SourceFile): ValidationPattern[] {
  const validations: ValidationPattern[] = [];

  function visit(node: ts.Node) {
    // Look for if statements with throw
    if (ts.isIfStatement(node)) {
      const condition = node.expression;
      let throwStatement: ts.ThrowStatement | undefined;

      // Check if then branch has throw
      if (ts.isBlock(node.thenStatement)) {
        const throwNode = node.thenStatement.statements.find(ts.isThrowStatement);
        if (throwNode) throwStatement = throwNode;
      } else if (ts.isThrowStatement(node.thenStatement)) {
        throwStatement = node.thenStatement;
      }

      if (throwStatement) {
        validations.push({
          condition: condition.getText(sourceFile),
          negated: true, // The condition triggers error, so actual precondition is negated
          errorMessage: extractErrorMessage(throwStatement, sourceFile),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(body, visit);
  return validations;
}

export interface ValidationPattern {
  condition: string;
  negated: boolean;
  errorMessage?: string;
}

function extractErrorMessage(throwStatement: ts.ThrowStatement, sourceFile: ts.SourceFile): string | undefined {
  if (throwStatement.expression && ts.isNewExpression(throwStatement.expression)) {
    const args = throwStatement.expression.arguments;
    if (args && args.length > 0) {
      const firstArg = args[0];
      if (ts.isStringLiteral(firstArg)) {
        return firstArg.text;
      }
    }
  }
  return undefined;
}
