/**
 * Type Definition Parser
 * 
 * Parses TypeScript .d.ts files to extract available methods.
 */

import { Project, SyntaxKind, Node, type SourceFile } from 'ts-morph';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { MethodSignature } from './types.js';

export class TypeDefinitionParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: false,
        noEmit: true,
      },
    });
  }

  /**
   * Parse package type definitions from node_modules
   */
  async parsePackageTypes(
    packageName: string,
    projectRoot: string
  ): Promise<MethodSignature[]> {
    const methods: MethodSignature[] = [];

    // Try to find type definitions
    const typesPath = await this.findTypesPath(packageName, projectRoot);
    if (!typesPath) {
      return methods;
    }

    try {
      const content = await readFile(typesPath, 'utf-8');
      const sourceFile = this.project.createSourceFile(`${packageName}.d.ts`, content, { overwrite: true });

      // Extract methods from interfaces, classes, and type aliases
      this.extractFromInterfaces(sourceFile, methods);
      this.extractFromClasses(sourceFile, methods);
      this.extractFromNamespaces(sourceFile, methods);

    } catch (error) {
      // Silently fail if we can't read types
    }

    return methods;
  }

  /**
   * Find the path to package type definitions
   */
  private async findTypesPath(packageName: string, projectRoot: string): Promise<string | null> {
    // Try direct package types
    const directPath = join(projectRoot, 'node_modules', packageName, 'index.d.ts');
    if (existsSync(directPath)) {
      return directPath;
    }

    // Try package.json types field
    const packageJsonPath = join(projectRoot, 'node_modules', packageName, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
        if (packageJson.types || packageJson.typings) {
          const typesFile = packageJson.types || packageJson.typings;
          const typesPath = join(dirname(packageJsonPath), typesFile);
          if (existsSync(typesPath)) {
            return typesPath;
          }
        }
      } catch {
        // Ignore
      }
    }

    // Try @types package
    const typesPackageName = packageName.startsWith('@') 
      ? `@types/${packageName.split('/')[1]}`
      : `@types/${packageName}`;
    
    const typesPath = join(projectRoot, 'node_modules', typesPackageName, 'index.d.ts');
    if (existsSync(typesPath)) {
      return typesPath;
    }

    return null;
  }

  /**
   * Extract methods from interfaces
   */
  private extractFromInterfaces(sourceFile: SourceFile, methods: MethodSignature[]): void {
    sourceFile.getInterfaces().forEach((interfaceDecl) => {
      const interfaceName = interfaceDecl.getName();

      interfaceDecl.getMethods().forEach((method) => {
        methods.push({
          name: method.getName(),
          path: [interfaceName],
          parameters: method.getParameters().map(param => ({
            name: param.getName(),
            type: param.getType().getText(),
            optional: param.isOptional(),
          })),
          returnType: method.getReturnType().getText(),
        });
      });

      interfaceDecl.getProperties().forEach((prop) => {
        const type = prop.getType();
        if (type.getCallSignatures().length > 0) {
          methods.push({
            name: prop.getName(),
            path: [interfaceName],
          });
        }
      });
    });
  }

  /**
   * Extract methods from classes
   */
  private extractFromClasses(sourceFile: SourceFile, methods: MethodSignature[]): void {
    sourceFile.getClasses().forEach((classDecl) => {
      const className = classDecl.getName();
      if (!className) return;

      classDecl.getMethods().forEach((method) => {
        if (!method.isPrivate()) {
          methods.push({
            name: method.getName(),
            path: [className],
            parameters: method.getParameters().map(param => ({
              name: param.getName(),
              type: param.getType().getText(),
              optional: param.isOptional(),
            })),
            returnType: method.getReturnType().getText(),
          });
        }
      });

      classDecl.getProperties().forEach((prop) => {
        if (!prop.isPrivate()) {
          const type = prop.getType();
          if (type.getCallSignatures().length > 0) {
            methods.push({
              name: prop.getName(),
              path: [className],
            });
          }
        }
      });
    });
  }

  /**
   * Extract methods from namespaces
   */
  private extractFromNamespaces(sourceFile: SourceFile, methods: MethodSignature[]): void {
    const processNamespace = (ns: Node, path: string[] = []) => {
      if (Node.isModuleDeclaration(ns)) {
        const name = ns.getName();
        const newPath = [...path, name];

        ns.forEachDescendant((child) => {
          if (Node.isFunctionDeclaration(child)) {
            const funcName = child.getName();
            if (funcName) {
              methods.push({
                name: funcName,
                path: newPath,
                parameters: child.getParameters().map(param => ({
                  name: param.getName(),
                  type: param.getType().getText(),
                  optional: param.isOptional(),
                })),
                returnType: child.getReturnType().getText(),
              });
            }
          } else if (Node.isModuleDeclaration(child)) {
            processNamespace(child, newPath);
          }
        });
      }
    };

    sourceFile.getModules().forEach((module) => {
      processNamespace(module);
    });
  }

  /**
   * Get package version from package.json
   */
  async getPackageVersion(packageName: string, projectRoot: string): Promise<string | null> {
    const packageJsonPath = join(projectRoot, 'node_modules', packageName, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
        return packageJson.version || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
