/**
 * Python Contract Generator
 * 
 * Generates Python contract checking code from ISL behavior specifications.
 * This module adds precondition, postcondition, and invariant checking to
 * generated Python code.
 */

import type {
  DomainDeclaration,
  BehaviorDeclaration,
  EntityDeclaration,
  ConditionBlock,
  ConditionStatement,
  InvariantStatement,
  Expression,
} from '@isl-lang/isl-core';

import {
  compilePythonExpression,
  compilePreconditionCheck,
  compilePostconditionCheck,
  compileInvariantCheck,
  createPythonCompilerContext,
  type PythonCompilerContext,
} from './python-expression-compiler.js';

// ============================================================================
// CONTRACT GENERATION OPTIONS
// ============================================================================

export interface ContractGenerationOptions {
  /** Include contract checks at runtime */
  runtimeChecks: boolean;
  /** Generate test assertions */
  testAssertions: boolean;
  /** Generate documentation for contracts */
  documentation: boolean;
  /** Contract enforcement mode: 'strict' | 'warn' | 'skip' */
  mode: 'strict' | 'warn' | 'skip';
}

const DEFAULT_OPTIONS: ContractGenerationOptions = {
  runtimeChecks: true,
  testAssertions: true,
  documentation: true,
  mode: 'strict',
};

// ============================================================================
// MAIN CONTRACT GENERATOR
// ============================================================================

export class PythonContractGenerator {
  private options: ContractGenerationOptions;
  private indent = 0;
  private output: string[] = [];

  constructor(options: Partial<ContractGenerationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate contract checking module for a domain
   */
  generate(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    // Get entity names for context
    const entityNames = domain.entities.map(e => e.name.name);
    const ctx = createPythonCompilerContext(entityNames);

    // Header and imports
    this.writeHeader(domain);
    this.writeImports();

    // Runtime library (error types, decorators)
    this.writeRuntimeLibrary();

    // Entity invariant checkers
    for (const entity of domain.entities) {
      this.generateEntityInvariantChecker(entity, ctx);
    }

    // Behavior contract decorators
    for (const behavior of domain.behaviors) {
      this.generateBehaviorContracts(behavior, ctx);
    }

    // Contract wrapper factory
    this.generateContractWrapperFactory(domain);

    return this.output.join('\n');
  }

  // ============================================================================
  // Header and Imports
  // ============================================================================

  private writeHeader(domain: DomainDeclaration): void {
    this.writeLine('"""');
    this.writeLine(`ISL Contract Checking for ${domain.name.name} domain`);
    if (domain.version) {
      this.writeLine(`Version: ${domain.version.value}`);
    }
    this.writeLine('');
    this.writeLine('This module provides runtime contract checking including:');
    this.writeLine('- Precondition validation');
    this.writeLine('- Postcondition verification');
    this.writeLine('- Entity invariant checking');
    this.writeLine('');
    this.writeLine('DO NOT EDIT - This file is auto-generated from ISL');
    this.writeLine(`Generated at: ${new Date().toISOString()}`);
    this.writeLine('"""');
    this.writeLine('');
  }

  private writeImports(): void {
    this.writeLine('from __future__ import annotations');
    this.writeLine('');
    this.writeLine('import functools');
    this.writeLine('import re');
    this.writeLine('from copy import deepcopy');
    this.writeLine('from dataclasses import dataclass');
    this.writeLine('from datetime import datetime');
    this.writeLine('from typing import (');
    this.indent++;
    this.writeLine('Any,');
    this.writeLine('Callable,');
    this.writeLine('Dict,');
    this.writeLine('Generic,');
    this.writeLine('List,');
    this.writeLine('Optional,');
    this.writeLine('Protocol,');
    this.writeLine('TypeVar,');
    this.writeLine('Union,');
    this.writeLine('cast,');
    this.indent--;
    this.writeLine(')');
    this.writeLine('from uuid import uuid4');
    this.writeLine('');
    this.writeLine('');
  }

  // ============================================================================
  // Runtime Library
  // ============================================================================

  private writeRuntimeLibrary(): void {
    this.writeLine('# ============================================================================');
    this.writeLine('# Contract Exception Types');
    this.writeLine('# ============================================================================');
    this.writeLine('');

    // Base contract error
    this.writeLine('class ContractError(Exception):');
    this.indent++;
    this.writeLine('"""Base class for all contract violations."""');
    this.writeLine('');
    this.writeLine('def __init__(self, message: str, expression: Optional[str] = None):');
    this.indent++;
    this.writeLine('super().__init__(message)');
    this.writeLine('self.message = message');
    this.writeLine('self.expression = expression');
    this.writeLine('self.timestamp = datetime.now()');
    this.indent--;
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Specific error types
    this.writeLine('class PreconditionError(ContractError):');
    this.indent++;
    this.writeLine('"""Raised when a precondition is violated."""');
    this.writeLine('pass');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    this.writeLine('class PostconditionError(ContractError):');
    this.indent++;
    this.writeLine('"""Raised when a postcondition is violated."""');
    this.writeLine('pass');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    this.writeLine('class InvariantError(ContractError):');
    this.indent++;
    this.writeLine('"""Raised when an invariant is violated."""');
    this.writeLine('pass');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Contract mode enum
    this.writeLine('class ContractMode:');
    this.indent++;
    this.writeLine('"""Contract enforcement mode."""');
    this.writeLine('STRICT = "strict"    # Raise exceptions on violation');
    this.writeLine('WARN = "warn"        # Log warnings, continue execution');
    this.writeLine('SKIP = "skip"        # Skip contract checking entirely');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Contract context
    this.writeLine('@dataclass');
    this.writeLine('class ContractContext:');
    this.indent++;
    this.writeLine('"""Context for contract evaluation."""');
    this.writeLine('mode: str = ContractMode.STRICT');
    this.writeLine('entities: Dict[str, Any] = None  # type: ignore');
    this.writeLine('');
    this.writeLine('def __post_init__(self):');
    this.indent++;
    this.writeLine('if self.entities is None:');
    this.indent++;
    this.writeLine('self.entities = {}');
    this.indent--;
    this.indent--;
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Old state tracker
    this.writeLine('class OldState:');
    this.indent++;
    this.writeLine('"""Captures old state for postcondition checking."""');
    this.writeLine('');
    this.writeLine('def __init__(self, values: Dict[str, Any] = None):');
    this.indent++;
    this.writeLine('self._values = values or {}');
    this.indent--;
    this.writeLine('');
    this.writeLine('def get(self, name: str) -> Any:');
    this.indent++;
    this.writeLine('"""Get old value by name."""');
    this.writeLine('return self._values.get(name)');
    this.indent--;
    this.writeLine('');
    this.writeLine('def entity(self, name: str) -> Any:');
    this.indent++;
    this.writeLine('"""Get old entity state."""');
    this.writeLine('return self._values.get(f"__entity_{name}")');
    this.indent--;
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Global contract context
    this.writeLine('# Global contract context (can be overridden per-call)');
    this.writeLine('_contract_context = ContractContext()');
    this.writeLine('');
    this.writeLine('');

    this.writeLine('def set_contract_mode(mode: str) -> None:');
    this.indent++;
    this.writeLine('"""Set the global contract enforcement mode."""');
    this.writeLine('global _contract_context');
    this.writeLine('_contract_context.mode = mode');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    this.writeLine('def register_entity_store(name: str, store: Any) -> None:');
    this.indent++;
    this.writeLine('"""Register an entity store for contract checking."""');
    this.writeLine('global _contract_context');
    this.writeLine('_contract_context.entities[name] = store');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  // ============================================================================
  // Entity Invariant Checkers
  // ============================================================================

  private generateEntityInvariantChecker(entity: EntityDeclaration, ctx: PythonCompilerContext): void {
    if (!entity.invariants || entity.invariants.length === 0) {
      return;
    }

    const entityName = entity.name.name;
    const snakeName = this.toSnakeCase(entityName);

    this.writeLine('# ============================================================================');
    this.writeLine(`# ${entityName} Invariants`);
    this.writeLine('# ============================================================================');
    this.writeLine('');

    this.writeLine(`def check_${snakeName}_invariants(entity: Any) -> None:`);
    this.indent++;
    this.writeLine(`"""Check all invariants for ${entityName}."""`);
    this.writeLine('if _contract_context.mode == ContractMode.SKIP:');
    this.indent++;
    this.writeLine('return');
    this.indent--;
    this.writeLine('');

    for (const invariant of entity.invariants) {
      const check = compileInvariantCheck(
        invariant.expression,
        invariant.description?.value,
        ctx
      );
      // Replace 'entity' with 'this' reference patterns
      const adjustedCheck = check.replace(/_result_/g, 'entity');
      this.writeLine(adjustedCheck.replace(/\n/g, '\n' + '    '.repeat(this.indent)));
      this.writeLine('');
    }

    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  // ============================================================================
  // Behavior Contract Generators
  // ============================================================================

  private generateBehaviorContracts(behavior: BehaviorDeclaration, ctx: PythonCompilerContext): void {
    const behaviorName = behavior.name.name;
    const snakeName = this.toSnakeCase(behaviorName);

    this.writeLine('# ============================================================================');
    this.writeLine(`# ${behaviorName} Contracts`);
    this.writeLine('# ============================================================================');
    this.writeLine('');

    // Build input param set for context
    const inputParams = new Set<string>();
    if (behavior.input) {
      for (const field of behavior.input.fields) {
        inputParams.add(field.name.name);
      }
    }
    const behaviorCtx: PythonCompilerContext = {
      ...ctx,
      inputParams,
    };

    // Generate precondition checker
    if (behavior.preconditions) {
      this.generatePreconditionChecker(behaviorName, behavior.preconditions, behaviorCtx);
    }

    // Generate postcondition checker
    if (behavior.postconditions) {
      this.generatePostconditionChecker(behaviorName, behavior.postconditions, behaviorCtx);
    }

    // Generate contract decorator
    this.generateContractDecorator(behavior, behaviorCtx);
  }

  private generatePreconditionChecker(
    behaviorName: string,
    conditions: ConditionBlock,
    ctx: PythonCompilerContext
  ): void {
    const snakeName = this.toSnakeCase(behaviorName);

    this.writeLine(`def _check_${snakeName}_preconditions(_input_: Any, _entities_: Dict[str, Any] = None) -> None:`);
    this.indent++;
    this.writeLine(`"""Check preconditions for ${behaviorName}."""`);
    this.writeLine('if _contract_context.mode == ContractMode.SKIP:');
    this.indent++;
    this.writeLine('return');
    this.indent--;
    this.writeLine('if _entities_ is None:');
    this.indent++;
    this.writeLine('_entities_ = _contract_context.entities');
    this.indent--;
    this.writeLine('');

    for (const condition of conditions.conditions) {
      // Handle guarded conditions (success/failure implies)
      if (condition.guard) {
        // For preconditions, we typically only check unguarded ones
        continue;
      }

      for (const stmt of condition.statements) {
        const check = this.generateConditionCheck(stmt, 'precondition', ctx);
        this.writeLine(check);
        this.writeLine('');
      }
    }

    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  private generatePostconditionChecker(
    behaviorName: string,
    conditions: ConditionBlock,
    ctx: PythonCompilerContext
  ): void {
    const snakeName = this.toSnakeCase(behaviorName);

    this.writeLine(`def _check_${snakeName}_postconditions(`);
    this.indent++;
    this.writeLine('_input_: Any,');
    this.writeLine('_result_: Any,');
    this.writeLine('_old_state_: OldState,');
    this.writeLine('_entities_: Dict[str, Any] = None');
    this.indent--;
    this.writeLine(') -> None:');
    this.indent++;
    this.writeLine(`"""Check postconditions for ${behaviorName}."""`);
    this.writeLine('if _contract_context.mode == ContractMode.SKIP:');
    this.indent++;
    this.writeLine('return');
    this.indent--;
    this.writeLine('if _entities_ is None:');
    this.indent++;
    this.writeLine('_entities_ = _contract_context.entities');
    this.indent--;
    this.writeLine('');

    for (const condition of conditions.conditions) {
      // Handle guarded conditions
      if (condition.guard === 'success') {
        this.writeLine('# Check only on success');
        this.writeLine('if getattr(_result_, "success", True):');
        this.indent++;
        for (const stmt of condition.statements) {
          const check = this.generateConditionCheck(stmt, 'postcondition', ctx);
          this.writeLine(check);
        }
        this.indent--;
        this.writeLine('');
      } else if (condition.guard === 'failure') {
        this.writeLine('# Check only on failure');
        this.writeLine('if not getattr(_result_, "success", True):');
        this.indent++;
        for (const stmt of condition.statements) {
          const check = this.generateConditionCheck(stmt, 'postcondition', ctx);
          this.writeLine(check);
        }
        this.indent--;
        this.writeLine('');
      } else if (!condition.guard) {
        // Unguarded postconditions
        for (const stmt of condition.statements) {
          const check = this.generateConditionCheck(stmt, 'postcondition', ctx);
          this.writeLine(check);
          this.writeLine('');
        }
      }
    }

    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  private generateConditionCheck(
    stmt: ConditionStatement,
    type: 'precondition' | 'postcondition' | 'invariant',
    ctx: PythonCompilerContext
  ): string {
    const description = stmt.description?.value;
    
    switch (type) {
      case 'precondition':
        return compilePreconditionCheck(stmt.expression, description, ctx);
      case 'postcondition':
        return compilePostconditionCheck(stmt.expression, description, ctx);
      case 'invariant':
        return compileInvariantCheck(stmt.expression, description, ctx);
    }
  }

  private generateContractDecorator(behavior: BehaviorDeclaration, ctx: PythonCompilerContext): void {
    const behaviorName = behavior.name.name;
    const snakeName = this.toSnakeCase(behaviorName);
    const hasPreconditions = !!behavior.preconditions;
    const hasPostconditions = !!behavior.postconditions;

    this.writeLine('T = TypeVar("T")');
    this.writeLine('');
    this.writeLine(`def ${snakeName}_contract(func: Callable[..., T]) -> Callable[..., T]:`);
    this.indent++;
    this.writeLine(`"""`);
    this.writeLine(`Decorator to enforce ${behaviorName} contracts.`);
    this.writeLine('');
    this.writeLine('Usage:');
    this.writeLine(`    @${snakeName}_contract`);
    this.writeLine(`    async def ${snakeName}(input: ${behaviorName}Input) -> ${behaviorName}Result:`);
    this.writeLine('        ...');
    this.writeLine('"""');
    this.writeLine('@functools.wraps(func)');
    this.writeLine('async def wrapper(*args: Any, **kwargs: Any) -> T:');
    this.indent++;

    // Extract input from args
    this.writeLine('# Extract input parameter');
    this.writeLine('_input_ = args[0] if args else kwargs.get("input")');
    this.writeLine('');

    // Capture old state for postconditions
    if (hasPostconditions) {
      this.writeLine('# Capture old state for postconditions');
      this.writeLine('_old_values_: Dict[str, Any] = {}');
      this.generateOldStateCapture(behavior, ctx);
      this.writeLine('_old_state_ = OldState(_old_values_)');
      this.writeLine('');
    }

    // Check preconditions
    if (hasPreconditions) {
      this.writeLine('# Check preconditions');
      this.writeLine(`_check_${snakeName}_preconditions(_input_)`);
      this.writeLine('');
    }

    // Call the actual function
    this.writeLine('# Execute the behavior');
    this.writeLine('_result_ = await func(*args, **kwargs)');
    this.writeLine('');

    // Check postconditions
    if (hasPostconditions) {
      this.writeLine('# Check postconditions');
      this.writeLine(`_check_${snakeName}_postconditions(_input_, _result_, _old_state_)`);
      this.writeLine('');
    }

    this.writeLine('return _result_');
    this.indent--;
    this.writeLine('');
    this.writeLine('return wrapper');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  private generateOldStateCapture(behavior: BehaviorDeclaration, ctx: PythonCompilerContext): void {
    // Look for old() references in postconditions to determine what to capture
    if (!behavior.postconditions) return;

    const oldReferences = this.findOldReferences(behavior.postconditions);
    
    for (const ref of oldReferences) {
      if (ref.type === 'entity') {
        this.writeLine(`if "${ref.name}" in _contract_context.entities:`);
        this.indent++;
        this.writeLine(`_old_values_["__entity_${ref.name}"] = deepcopy(_contract_context.entities["${ref.name}"])`);
        this.indent--;
      } else {
        this.writeLine(`_old_values_["${ref.name}"] = deepcopy(_input_.${this.toSnakeCase(ref.name)} if hasattr(_input_, "${this.toSnakeCase(ref.name)}") else None)`);
      }
    }
  }

  private findOldReferences(conditions: ConditionBlock): Array<{ type: 'field' | 'entity'; name: string }> {
    const refs: Array<{ type: 'field' | 'entity'; name: string }> = [];
    // Simplified - in a full implementation, walk the AST to find all old() calls
    // For now, return empty - the runtime will handle missing old values gracefully
    return refs;
  }

  // ============================================================================
  // Contract Wrapper Factory
  // ============================================================================

  private generateContractWrapperFactory(domain: DomainDeclaration): void {
    this.writeLine('# ============================================================================');
    this.writeLine('# Contract Wrapper Factory');
    this.writeLine('# ============================================================================');
    this.writeLine('');

    this.writeLine('def create_contracted_service(service: Any) -> Any:');
    this.indent++;
    this.writeLine('"""');
    this.writeLine('Wrap a service with contract checking for all behaviors.');
    this.writeLine('');
    this.writeLine('Args:');
    this.writeLine('    service: The service instance to wrap');
    this.writeLine('');
    this.writeLine('Returns:');
    this.writeLine('    A new service with contract checking enabled');
    this.writeLine('"""');
    this.writeLine('# Implementation depends on your service pattern');
    this.writeLine('# This is a placeholder for framework integration');
    this.writeLine('return service');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Export list
    this.writeLine('__all__ = [');
    this.indent++;
    this.writeLine('"ContractError",');
    this.writeLine('"PreconditionError",');
    this.writeLine('"PostconditionError",');
    this.writeLine('"InvariantError",');
    this.writeLine('"ContractMode",');
    this.writeLine('"ContractContext",');
    this.writeLine('"OldState",');
    this.writeLine('"set_contract_mode",');
    this.writeLine('"register_entity_store",');
    this.writeLine('"create_contracted_service",');

    // Add behavior-specific exports
    for (const behavior of domain.behaviors) {
      const snakeName = this.toSnakeCase(behavior.name.name);
      this.writeLine(`"${snakeName}_contract",`);
      if (behavior.preconditions) {
        this.writeLine(`"_check_${snakeName}_preconditions",`);
      }
      if (behavior.postconditions) {
        this.writeLine(`"_check_${snakeName}_postconditions",`);
      }
    }

    // Add entity invariant checkers
    for (const entity of domain.entities) {
      if (entity.invariants && entity.invariants.length > 0) {
        const snakeName = this.toSnakeCase(entity.name.name);
        this.writeLine(`"check_${snakeName}_invariants",`);
      }
    }

    this.indent--;
    this.writeLine(']');
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/__/g, '_');
  }

  private writeLine(line: string): void {
    const indentStr = '    '.repeat(this.indent);
    this.output.push(indentStr + line);
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Generate Python contract checking code from an ISL domain
 */
export function generatePythonContracts(
  domain: DomainDeclaration,
  options?: Partial<ContractGenerationOptions>
): string {
  const generator = new PythonContractGenerator(options);
  return generator.generate(domain);
}
