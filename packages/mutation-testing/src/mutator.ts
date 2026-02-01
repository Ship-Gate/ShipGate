/**
 * Main Mutation Engine
 * 
 * Generates mutants from ISL specifications by applying
 * mutation operators to the AST.
 */

import {
  Mutant,
  MutantCandidate,
  MutantLocation,
  MutationType,
  MutationConfig,
  MutationOperator,
} from './types';

import { arithmeticOperators } from './mutations/arithmetic';
import { comparisonOperators } from './mutations/comparison';
import { logicalOperators } from './mutations/logical';
import { boundaryOperators } from './mutations/boundary';
import { nullOperators } from './mutations/null';
import { temporalOperators } from './mutations/temporal';

/** All available mutation operators */
const ALL_OPERATORS: MutationOperator[] = [
  ...arithmeticOperators,
  ...comparisonOperators,
  ...logicalOperators,
  ...boundaryOperators,
  ...nullOperators,
  ...temporalOperators,
];

/**
 * Main mutation engine
 */
export class MutationEngine {
  private operators: MutationOperator[];
  private config: MutationConfig;
  private mutantCounter = 0;

  constructor(config: Partial<MutationConfig> = {}) {
    this.config = {
      files: [],
      mutationTypes: undefined,
      maxMutants: 1000,
      timeout: 30000,
      parallel: true,
      workers: 4,
      threshold: 80,
      reportFormat: 'text',
      ...config,
    };

    // Filter operators by configured mutation types
    if (this.config.mutationTypes) {
      this.operators = ALL_OPERATORS.filter((op) =>
        this.config.mutationTypes!.includes(op.type)
      );
    } else {
      this.operators = ALL_OPERATORS;
    }
  }

  /**
   * Generate all mutants for an AST
   */
  generateMutants(ast: ISLNode, filePath: string): Mutant[] {
    const mutants: Mutant[] = [];
    
    this.traverseAndMutate(ast, filePath, [], mutants);
    
    // Apply max mutants limit
    if (this.config.maxMutants && mutants.length > this.config.maxMutants) {
      // Prioritize diverse mutation types
      return this.selectDiverseMutants(mutants, this.config.maxMutants);
    }
    
    return mutants;
  }

  /**
   * Traverse AST and generate mutants
   */
  private traverseAndMutate(
    node: ISLNode,
    filePath: string,
    path: string[],
    mutants: Mutant[]
  ): void {
    // Try each operator on this node
    for (const operator of this.operators) {
      if (operator.canApply(node)) {
        const candidates = operator.apply(node);
        
        for (const candidate of candidates) {
          const mutant = this.createMutant(candidate, filePath, node, path);
          mutants.push(mutant);
        }
      }
    }

    // Recurse into children
    const children = this.getChildren(node);
    for (const [key, child] of children) {
      if (Array.isArray(child)) {
        child.forEach((item, index) => {
          if (this.isNode(item)) {
            this.traverseAndMutate(item, filePath, [...path, key, String(index)], mutants);
          }
        });
      } else if (this.isNode(child)) {
        this.traverseAndMutate(child, filePath, [...path, key], mutants);
      }
    }
  }

  /**
   * Create a mutant from a candidate
   */
  private createMutant(
    candidate: MutantCandidate,
    filePath: string,
    node: ISLNode,
    path: string[]
  ): Mutant {
    const id = `mutant-${++this.mutantCounter}`;
    
    const location: MutantLocation = {
      file: filePath,
      startLine: node.location?.start?.line ?? 1,
      endLine: node.location?.end?.line ?? 1,
      startColumn: node.location?.start?.column ?? 0,
      endColumn: node.location?.end?.column ?? 0,
      nodePath: path,
      ...candidate.location,
    };

    return {
      id,
      type: candidate.type,
      location,
      original: candidate.original,
      mutated: candidate.mutated,
      description: candidate.description,
      status: 'pending',
    };
  }

  /**
   * Select diverse mutants when over limit
   */
  private selectDiverseMutants(mutants: Mutant[], limit: number): Mutant[] {
    // Group by type
    const byType = new Map<MutationType, Mutant[]>();
    for (const mutant of mutants) {
      const list = byType.get(mutant.type) || [];
      list.push(mutant);
      byType.set(mutant.type, list);
    }

    // Take proportionally from each type
    const selected: Mutant[] = [];
    const types = Array.from(byType.keys());
    const perType = Math.ceil(limit / types.length);

    for (const type of types) {
      const typeMutants = byType.get(type) || [];
      // Shuffle to get random selection
      const shuffled = this.shuffle(typeMutants);
      selected.push(...shuffled.slice(0, perType));
    }

    return selected.slice(0, limit);
  }

  /**
   * Shuffle array
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get child nodes
   */
  private getChildren(node: ISLNode): Array<[string, unknown]> {
    const children: Array<[string, unknown]> = [];
    
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' || key === 'location') continue;
      children.push([key, value]);
    }
    
    return children;
  }

  /**
   * Check if value is a node
   */
  private isNode(value: unknown): value is ISLNode {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value
    );
  }
}

/**
 * ISL AST Node interface
 */
interface ISLNode {
  type: string;
  location?: {
    start?: { line: number; column: number };
    end?: { line: number; column: number };
  };
  [key: string]: unknown;
}

/**
 * Generate mutants from ISL source
 */
export function mutate(
  source: string,
  filePath: string,
  config?: Partial<MutationConfig>
): Mutant[] {
  // Parse source to AST (would use actual parser)
  const ast = parseISL(source);
  
  const engine = new MutationEngine(config);
  return engine.generateMutants(ast, filePath);
}

/**
 * Create mutants from parsed AST
 */
export function createMutants(
  ast: ISLNode,
  filePath: string,
  config?: Partial<MutationConfig>
): Mutant[] {
  const engine = new MutationEngine(config);
  return engine.generateMutants(ast, filePath);
}

/**
 * Parse ISL source (placeholder - would use actual parser)
 */
function parseISL(source: string): ISLNode {
  // This would use the actual ISL parser
  // For now, return a mock structure
  return {
    type: 'Domain',
    name: 'Mock',
    entities: [],
    behaviors: [],
    types: [],
  };
}

/**
 * Apply a mutant to source code
 */
export function applyMutant(source: string, mutant: Mutant): string {
  const lines = source.split('\n');
  const { startLine, endLine, startColumn, endColumn } = mutant.location;
  
  if (startLine === endLine) {
    // Single line mutation
    const line = lines[startLine - 1];
    lines[startLine - 1] = 
      line.slice(0, startColumn) + 
      mutant.mutated + 
      line.slice(endColumn);
  } else {
    // Multi-line mutation
    const firstLine = lines[startLine - 1].slice(0, startColumn);
    const lastLine = lines[endLine - 1].slice(endColumn);
    
    lines.splice(
      startLine - 1,
      endLine - startLine + 1,
      firstLine + mutant.mutated + lastLine
    );
  }
  
  return lines.join('\n');
}

/**
 * Restore original from mutant
 */
export function revertMutant(source: string, mutant: Mutant): string {
  const lines = source.split('\n');
  const { startLine, endLine, startColumn, endColumn } = mutant.location;
  
  if (startLine === endLine) {
    const line = lines[startLine - 1];
    // Find where mutated value is and replace with original
    const mutatedStart = line.indexOf(mutant.mutated, startColumn);
    if (mutatedStart >= 0) {
      lines[startLine - 1] = 
        line.slice(0, mutatedStart) + 
        mutant.original + 
        line.slice(mutatedStart + mutant.mutated.length);
    }
  }
  
  return lines.join('\n');
}
