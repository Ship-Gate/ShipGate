/**
 * Dependency Graph Analyzer
 * 
 * Build and analyze dependency graphs from ISL domains.
 */

import { parseISL, type DomainDeclaration } from '@intentos/isl-core';

export interface AnalyzerOptions {
  /** Include entity dependencies */
  includeEntities?: boolean;
  /** Include behavior dependencies */
  includeBehaviors?: boolean;
  /** Include type dependencies */
  includeTypes?: boolean;
  /** Resolve transitive dependencies */
  resolveTransitive?: boolean;
}

export interface DependencyNode {
  /** Unique identifier */
  id: string;
  /** Node type */
  type: 'domain' | 'entity' | 'behavior' | 'type' | 'enum';
  /** Node name */
  name: string;
  /** Parent domain name */
  domain: string;
  /** File path */
  file?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface DependencyEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Edge type */
  type: 'import' | 'reference' | 'extends' | 'uses';
  /** Edge label */
  label?: string;
}

export interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Map<string, DependencyNode>;
  /** All edges in the graph */
  edges: DependencyEdge[];
  /** Domain-level summary */
  domains: Map<string, DomainSummary>;
}

export interface DomainSummary {
  name: string;
  file?: string;
  entities: string[];
  behaviors: string[];
  types: string[];
  enums: string[];
  imports: string[];
  importedBy: string[];
}

/**
 * Dependency Analyzer
 */
export class DependencyAnalyzer {
  private graph: DependencyGraph;
  private options: Required<AnalyzerOptions>;
  private parsedDomains = new Map<string, DomainDeclaration>();

  constructor(options: AnalyzerOptions = {}) {
    this.options = {
      includeEntities: options.includeEntities ?? true,
      includeBehaviors: options.includeBehaviors ?? true,
      includeTypes: options.includeTypes ?? true,
      resolveTransitive: options.resolveTransitive ?? true,
    };

    this.graph = {
      nodes: new Map(),
      edges: [],
      domains: new Map(),
    };
  }

  /**
   * Add a domain from source code
   */
  addDomain(source: string, file?: string): void {
    const result = parseISL(source, file);
    
    if (result.errors.length > 0) {
      throw new Error(`Parse error in ${file ?? 'source'}: ${result.errors[0]?.message}`);
    }

    if (!result.ast) {
      throw new Error(`Failed to parse ${file ?? 'source'}`);
    }

    this.addParsedDomain(result.ast, file);
  }

  /**
   * Add a pre-parsed domain
   */
  addParsedDomain(domain: DomainDeclaration, file?: string): void {
    const domainName = domain.name.name;
    this.parsedDomains.set(domainName, domain);

    // Create domain node
    const domainId = `domain:${domainName}`;
    this.graph.nodes.set(domainId, {
      id: domainId,
      type: 'domain',
      name: domainName,
      domain: domainName,
      file,
    });

    // Create domain summary
    const summary: DomainSummary = {
      name: domainName,
      file,
      entities: [],
      behaviors: [],
      types: [],
      enums: [],
      imports: [],
      importedBy: [],
    };

    // Process imports
    for (const imp of domain.imports) {
      const importedFrom = imp.from.value;
      summary.imports.push(importedFrom);

      // Add edge for domain import
      this.graph.edges.push({
        from: domainId,
        to: `domain:${importedFrom}`,
        type: 'import',
        label: imp.names.map((n) => n.name).join(', '),
      });

      // Add imported items
      for (const name of imp.names) {
        this.graph.edges.push({
          from: domainId,
          to: `${importedFrom}:${name.name}`,
          type: 'import',
        });
      }
    }

    // Process entities
    if (this.options.includeEntities) {
      for (const entity of domain.entities) {
        const entityId = `${domainName}:entity:${entity.name.name}`;
        summary.entities.push(entity.name.name);

        this.graph.nodes.set(entityId, {
          id: entityId,
          type: 'entity',
          name: entity.name.name,
          domain: domainName,
          file,
          metadata: {
            fieldCount: entity.fields.length,
            hasLifecycle: !!entity.lifecycle,
            hasInvariants: !!(entity.invariants && entity.invariants.length > 0),
          },
        });

        // Track type references in fields
        for (const field of entity.fields) {
          const typeName = this.extractTypeName(field.type);
          if (typeName && !this.isPrimitiveType(typeName)) {
            this.graph.edges.push({
              from: entityId,
              to: this.resolveTypeId(domainName, typeName),
              type: 'reference',
              label: field.name.name,
            });
          }
        }
      }
    }

    // Process behaviors
    if (this.options.includeBehaviors) {
      for (const behavior of domain.behaviors) {
        const behaviorId = `${domainName}:behavior:${behavior.name.name}`;
        summary.behaviors.push(behavior.name.name);

        this.graph.nodes.set(behaviorId, {
          id: behaviorId,
          type: 'behavior',
          name: behavior.name.name,
          domain: domainName,
          file,
          metadata: {
            hasInput: !!behavior.input,
            hasOutput: !!behavior.output,
            hasPreconditions: !!(behavior.preconditions?.conditions.length),
            hasPostconditions: !!(behavior.postconditions?.conditions.length),
            hasTemporal: !!(behavior.temporal?.requirements.length),
            hasSecurity: !!(behavior.security?.requirements.length),
            hasCompliance: !!(behavior.compliance?.standards.length),
          },
        });

        // Track input type references
        if (behavior.input) {
          for (const field of behavior.input.fields) {
            const typeName = this.extractTypeName(field.type);
            if (typeName && !this.isPrimitiveType(typeName)) {
              this.graph.edges.push({
                from: behaviorId,
                to: this.resolveTypeId(domainName, typeName),
                type: 'uses',
                label: `input:${field.name.name}`,
              });
            }
          }
        }

        // Track output type references
        if (behavior.output) {
          const successType = this.extractTypeName(behavior.output.success);
          if (successType && !this.isPrimitiveType(successType)) {
            this.graph.edges.push({
              from: behaviorId,
              to: this.resolveTypeId(domainName, successType),
              type: 'uses',
              label: 'output:success',
            });
          }
        }
      }
    }

    // Process types
    if (this.options.includeTypes) {
      for (const type of domain.types) {
        const typeId = `${domainName}:type:${type.name.name}`;
        summary.types.push(type.name.name);

        this.graph.nodes.set(typeId, {
          id: typeId,
          type: 'type',
          name: type.name.name,
          domain: domainName,
          file,
        });

        // Track base type reference
        const baseName = this.extractTypeName(type.baseType);
        if (baseName && !this.isPrimitiveType(baseName)) {
          this.graph.edges.push({
            from: typeId,
            to: this.resolveTypeId(domainName, baseName),
            type: 'extends',
          });
        }
      }

      for (const enumDecl of domain.enums) {
        const enumId = `${domainName}:enum:${enumDecl.name.name}`;
        summary.enums.push(enumDecl.name.name);

        this.graph.nodes.set(enumId, {
          id: enumId,
          type: 'enum',
          name: enumDecl.name.name,
          domain: domainName,
          file,
          metadata: {
            variants: enumDecl.variants.map((v) => v.name),
          },
        });
      }
    }

    this.graph.domains.set(domainName, summary);

    // Update importedBy for existing domains
    for (const importedDomain of summary.imports) {
      const importedSummary = this.graph.domains.get(importedDomain);
      if (importedSummary) {
        importedSummary.importedBy.push(domainName);
      }
    }
  }

  /**
   * Get the dependency graph
   */
  getGraph(): DependencyGraph {
    return this.graph;
  }

  /**
   * Get dependencies of a specific node
   */
  getDependencies(nodeId: string): DependencyNode[] {
    const deps: DependencyNode[] = [];
    
    for (const edge of this.graph.edges) {
      if (edge.from === nodeId) {
        const node = this.graph.nodes.get(edge.to);
        if (node) {
          deps.push(node);
        }
      }
    }

    return deps;
  }

  /**
   * Get dependents of a specific node (reverse dependencies)
   */
  getDependents(nodeId: string): DependencyNode[] {
    const dependents: DependencyNode[] = [];
    
    for (const edge of this.graph.edges) {
      if (edge.to === nodeId) {
        const node = this.graph.nodes.get(edge.from);
        if (node) {
          dependents.push(node);
        }
      }
    }

    return dependents;
  }

  /**
   * Get all transitive dependencies
   */
  getTransitiveDependencies(nodeId: string): Set<string> {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of this.graph.edges) {
        if (edge.from === current && !visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    visited.delete(nodeId); // Remove self
    return visited;
  }

  /**
   * Get all transitive dependents
   */
  getTransitiveDependents(nodeId: string): Set<string> {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of this.graph.edges) {
        if (edge.to === current && !visited.has(edge.from)) {
          queue.push(edge.from);
        }
      }
    }

    visited.delete(nodeId); // Remove self
    return visited;
  }

  /**
   * Get domain-level dependencies
   */
  getDomainDependencies(domainName: string): string[] {
    const summary = this.graph.domains.get(domainName);
    return summary?.imports ?? [];
  }

  /**
   * Get domains that depend on a specific domain
   */
  getDomainDependents(domainName: string): string[] {
    const summary = this.graph.domains.get(domainName);
    return summary?.importedBy ?? [];
  }

  /**
   * Extract type name from type expression
   */
  private extractTypeName(type: unknown): string | null {
    if (!type || typeof type !== 'object') return null;
    
    const t = type as { kind: string; name?: { name: string }; typeArguments?: unknown[] };
    
    if (t.kind === 'SimpleType' && t.name) {
      return t.name.name;
    }
    
    if (t.kind === 'GenericType' && t.name) {
      return t.name.name;
    }

    return null;
  }

  /**
   * Check if a type is a primitive
   */
  private isPrimitiveType(name: string): boolean {
    const primitives = ['String', 'Int', 'Decimal', 'Boolean', 'Timestamp', 'UUID', 'Duration', 'void'];
    const generics = ['List', 'Map', 'Optional'];
    return primitives.includes(name) || generics.includes(name);
  }

  /**
   * Resolve a type reference to a node ID
   */
  private resolveTypeId(currentDomain: string, typeName: string): string {
    // Check if it's a qualified name (Domain.Type)
    if (typeName.includes('.')) {
      const [domain, name] = typeName.split('.');
      return `${domain}:type:${name}`;
    }

    // Check current domain first
    const summary = this.graph.domains.get(currentDomain);
    if (summary) {
      if (summary.entities.includes(typeName)) {
        return `${currentDomain}:entity:${typeName}`;
      }
      if (summary.types.includes(typeName)) {
        return `${currentDomain}:type:${typeName}`;
      }
      if (summary.enums.includes(typeName)) {
        return `${currentDomain}:enum:${typeName}`;
      }
    }

    // Check imports
    if (summary) {
      for (const importedDomain of summary.imports) {
        const importedSummary = this.graph.domains.get(importedDomain);
        if (importedSummary) {
          if (importedSummary.entities.includes(typeName)) {
            return `${importedDomain}:entity:${typeName}`;
          }
          if (importedSummary.types.includes(typeName)) {
            return `${importedDomain}:type:${typeName}`;
          }
          if (importedSummary.enums.includes(typeName)) {
            return `${importedDomain}:enum:${typeName}`;
          }
        }
      }
    }

    // Default: assume it's in current domain
    return `${currentDomain}:type:${typeName}`;
  }
}

/**
 * Convenience function to analyze dependencies
 */
export function analyzeDependencies(
  sources: Array<{ source: string; file?: string }>,
  options?: AnalyzerOptions
): DependencyGraph {
  const analyzer = new DependencyAnalyzer(options);
  
  for (const { source, file } of sources) {
    analyzer.addDomain(source, file);
  }
  
  return analyzer.getGraph();
}
