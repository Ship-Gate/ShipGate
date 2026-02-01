// ============================================================================
// Spec Federation Core
// ============================================================================

import type {
  FederatedSource,
  FederatedSpec,
  FederationOptions,
  FederationResult,
  CombinedSchema,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  Conflict,
  Warning,
  FederationStatistics,
  SpecAST,
  DomainAST,
  TypeAST,
  SpecExport,
  SpecMetadata,
} from './types';
import { DEFAULT_OPTIONS } from './types';

/**
 * ISL Spec Federation - Compose specs from multiple sources
 */
export class SpecFederation {
  private options: FederationOptions;
  private sources: FederatedSource[] = [];
  private specs: Map<string, FederatedSpec> = new Map();
  private cache: Map<string, FederatedSpec> = new Map();

  constructor(options: Partial<FederationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  addSource(source: FederatedSource): this {
    this.sources.push(source);
    return this;
  }

  addSources(sources: FederatedSource[]): this {
    this.sources.push(...sources);
    return this;
  }

  async federate(): Promise<FederationResult> {
    const warnings: Warning[] = [];
    const conflicts: Conflict[] = [];
    const fetchStart = Date.now();

    const fetchedSpecs = await this.fetchAllSpecs();
    const fetchTime = Date.now() - fetchStart;

    const parseStart = Date.now();
    for (const spec of fetchedSpecs) {
      this.specs.set(spec.source.id, spec);
    }
    const parseTime = Date.now() - parseStart;

    const dependencyGraph = this.buildDependencyGraph();

    const validationStart = Date.now();
    const { combinedSchema, newConflicts, newWarnings } = this.mergeSpecs(
      Array.from(this.specs.values())
    );
    conflicts.push(...newConflicts);
    warnings.push(...newWarnings);
    const validationTime = Date.now() - validationStart;

    const statistics = this.calculateStatistics(
      Array.from(this.specs.values()),
      combinedSchema,
      fetchTime,
      parseTime,
      validationTime
    );

    return {
      specs: Array.from(this.specs.values()),
      combinedSchema,
      dependencyGraph,
      conflicts,
      warnings,
      statistics,
    };
  }

  private async fetchAllSpecs(): Promise<FederatedSpec[]> {
    if (this.options.parallelFetch) {
      return Promise.all(this.sources.map((s) => this.fetchSpec(s)));
    }
    const specs: FederatedSpec[] = [];
    for (const source of this.sources) {
      specs.push(await this.fetchSpec(source));
    }
    return specs;
  }

  private async fetchSpec(source: FederatedSource): Promise<FederatedSpec> {
    if (source.cache?.enabled) {
      const cached = this.cache.get(source.id);
      if (cached) return cached;
    }

    let raw: string;
    switch (source.type) {
      case 'inline':
        raw = source.location;
        break;
      case 'url':
        raw = await this.fetchUrl(source.location, source.token);
        break;
      default:
        raw = source.location;
    }

    const ast = this.parseSpec(raw);
    const metadata = this.extractMetadata(raw);
    const exports = this.extractExports(ast);
    const dependencies = this.extractDependencies(ast);

    const spec: FederatedSpec = {
      source,
      ast,
      version: source.version || metadata.version || '0.0.0',
      hash: this.hashContent(raw),
      dependencies,
      exports,
      metadata,
      raw,
    };

    if (source.cache?.enabled) {
      this.cache.set(source.id, spec);
    }

    return spec;
  }

  private async fetchUrl(url: string, token?: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return response.text();
  }

  private parseSpec(raw: string): SpecAST {
    return { domains: [], types: [], imports: [] };
  }

  private extractMetadata(raw: string): SpecMetadata {
    return { name: 'unknown', version: '0.0.0' };
  }

  private extractExports(ast: SpecAST): SpecExport[] {
    const exports: SpecExport[] = [];
    for (const domain of ast.domains) {
      exports.push({ name: domain.name, kind: 'domain', path: domain.name });
    }
    return exports;
  }

  private extractDependencies(ast: SpecAST): string[] {
    return ast.imports.map((i) => i.source);
  }

  private buildDependencyGraph(): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];
    for (const [id, spec] of this.specs) {
      nodes.set(id, { id, spec, depth: 0 });
    }
    return { nodes, edges };
  }

  private mergeSpecs(specs: FederatedSpec[]): {
    combinedSchema: CombinedSchema;
    newConflicts: Conflict[];
    newWarnings: Warning[];
  } {
    const domains: DomainAST[] = [];
    const types: TypeAST[] = [];
    const exports = new Map<string, SpecExport>();

    for (const spec of specs) {
      domains.push(...spec.ast.domains);
      types.push(...spec.ast.types);
      for (const exp of spec.exports) {
        exports.set(exp.name, exp);
      }
    }

    return {
      combinedSchema: { domains, types, exports },
      newConflicts: [],
      newWarnings: [],
    };
  }

  private calculateStatistics(
    specs: FederatedSpec[],
    schema: CombinedSchema,
    fetchTime: number,
    parseTime: number,
    validationTime: number
  ): FederationStatistics {
    return {
      totalSpecs: specs.length,
      totalDomains: schema.domains.length,
      totalEntities: 0,
      totalBehaviors: 0,
      totalTypes: schema.types.length,
      fetchTime,
      parseTime,
      validationTime,
    };
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
    }
    return Math.abs(hash).toString(16);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export function createFederation(options?: Partial<FederationOptions>): SpecFederation {
  return new SpecFederation(options);
}

export async function federate(
  sources: FederatedSource[],
  options?: Partial<FederationOptions>
): Promise<FederationResult> {
  const federation = createFederation(options);
  federation.addSources(sources);
  return federation.federate();
}

export function fileSource(path: string, options?: Partial<FederatedSource>): FederatedSource {
  return { id: path, name: path, type: 'file', location: path, ...options };
}

export function urlSource(url: string, options?: Partial<FederatedSource>): FederatedSource {
  return { id: url, name: url, type: 'url', location: url, ...options };
}

export function inlineSource(content: string, options?: Partial<FederatedSource>): FederatedSource {
  return { id: `inline-${Date.now()}`, name: 'inline', type: 'inline', location: content, ...options };
}
