// ============================================================================
// Markdown Documentation Generator
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import { generateMermaidDiagrams } from './diagrams';

// ============================================================================
// TYPES
// ============================================================================

export interface MarkdownOptions {
  includeDiagrams?: boolean;
  includeExamples?: boolean;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate comprehensive Markdown documentation for a domain
 */
export function generateMarkdown(domain: AST.Domain, options: MarkdownOptions = {}): string {
  const lines: string[] = [];
  const name = domain.name.name;
  const version = domain.version.value;

  // Header
  lines.push(`# ${name} Domain`);
  lines.push('');
  lines.push(`**Version:** ${version}`);
  if (domain.owner) {
    lines.push(`**Owner:** ${domain.owner.value}`);
  }
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Overview](#overview)');
  if (domain.types.length > 0) lines.push('- [Types](#types)');
  if (domain.entities.length > 0) lines.push('- [Entities](#entities)');
  if (domain.behaviors.length > 0) lines.push('- [Behaviors](#behaviors)');
  if (domain.invariants.length > 0) lines.push('- [Invariants](#invariants)');
  if (domain.policies.length > 0) lines.push('- [Policies](#policies)');
  if (domain.views.length > 0) lines.push('- [Views](#views)');
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(generateOverview(domain));
  lines.push('');

  // Types
  if (domain.types.length > 0) {
    lines.push('## Types');
    lines.push('');
    for (const type of domain.types) {
      lines.push(generateTypeDoc(type));
    }
  }

  // Entities
  if (domain.entities.length > 0) {
    lines.push('## Entities');
    lines.push('');
    for (const entity of domain.entities) {
      lines.push(generateEntityDoc(entity, options));
    }
  }

  // Behaviors
  if (domain.behaviors.length > 0) {
    lines.push('## Behaviors');
    lines.push('');
    for (const behavior of domain.behaviors) {
      lines.push(generateBehaviorDoc(behavior));
    }
  }

  // Invariants
  if (domain.invariants.length > 0) {
    lines.push('## Invariants');
    lines.push('');
    for (const invariant of domain.invariants) {
      lines.push(generateInvariantDoc(invariant));
    }
  }

  // Policies
  if (domain.policies.length > 0) {
    lines.push('## Policies');
    lines.push('');
    for (const policy of domain.policies) {
      lines.push(generatePolicyDoc(policy));
    }
  }

  // Views
  if (domain.views.length > 0) {
    lines.push('## Views');
    lines.push('');
    for (const view of domain.views) {
      lines.push(generateViewDoc(view));
    }
  }

  // Lifecycle diagrams
  if (options.includeDiagrams) {
    const diagrams = generateMermaidDiagrams(domain);
    if (diagrams.length > 0) {
      lines.push('## State Diagrams');
      lines.push('');
      for (const diagram of diagrams) {
        lines.push(`### ${diagram.name}`);
        lines.push('');
        lines.push(diagram.content);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// OVERVIEW
// ============================================================================

function generateOverview(domain: AST.Domain): string {
  const stats = {
    types: domain.types.length,
    entities: domain.entities.length,
    behaviors: domain.behaviors.length,
    invariants: domain.invariants.length,
    policies: domain.policies.length,
    views: domain.views.length,
    scenarios: domain.scenarios.length,
    chaos: domain.chaos.length,
  };

  const lines: string[] = [];
  
  lines.push('This document describes the ISL specification for the domain.');
  lines.push('');
  lines.push('### Domain Statistics');
  lines.push('');
  lines.push('| Component | Count |');
  lines.push('|-----------|-------|');
  
  if (stats.types > 0) lines.push(`| Types | ${stats.types} |`);
  if (stats.entities > 0) lines.push(`| Entities | ${stats.entities} |`);
  if (stats.behaviors > 0) lines.push(`| Behaviors | ${stats.behaviors} |`);
  if (stats.invariants > 0) lines.push(`| Invariants | ${stats.invariants} |`);
  if (stats.policies > 0) lines.push(`| Policies | ${stats.policies} |`);
  if (stats.views > 0) lines.push(`| Views | ${stats.views} |`);
  if (stats.scenarios > 0) lines.push(`| Scenario Blocks | ${stats.scenarios} |`);
  if (stats.chaos > 0) lines.push(`| Chaos Tests | ${stats.chaos} |`);

  return lines.join('\n');
}

// ============================================================================
// TYPE DOCUMENTATION
// ============================================================================

function generateTypeDoc(type: AST.TypeDeclaration): string {
  const lines: string[] = [];
  const name = type.name.name;

  lines.push(`### ${name}`);
  lines.push('');

  // Annotations
  if (type.annotations.length > 0) {
    const annotations = type.annotations.map(a => `@${a.name.name}`).join(', ');
    lines.push(`*Annotations: ${annotations}*`);
    lines.push('');
  }

  // Type definition
  lines.push('```');
  lines.push(formatTypeDefinitionBlock(type.definition));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function formatTypeDefinitionBlock(def: AST.TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      return def.name;
    case 'ConstrainedType': {
      const base = formatTypeDefinitionBlock(def.base);
      const constraints = def.constraints.map(c => `  ${c.name}: ${formatExpr(c.value)}`).join('\n');
      return `${base} {\n${constraints}\n}`;
    }
    case 'EnumType':
      return `enum {\n${def.variants.map(v => `  ${v.name.name}`).join('\n')}\n}`;
    case 'StructType':
      return `{\n${def.fields.map(f => `  ${f.name.name}: ${formatTypeDefinitionBlock(f.type)}${f.optional ? '?' : ''}`).join('\n')}\n}`;
    case 'UnionType':
      return def.variants.map(v => `| ${v.name.name} { ${v.fields.map(f => `${f.name.name}: ${formatTypeDefinitionBlock(f.type)}`).join(', ')} }`).join('\n');
    case 'ListType':
      return `List<${formatTypeDefinitionBlock(def.element)}>`;
    case 'MapType':
      return `Map<${formatTypeDefinitionBlock(def.key)}, ${formatTypeDefinitionBlock(def.value)}>`;
    case 'OptionalType':
      return `${formatTypeDefinitionBlock(def.inner)}?`;
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    default:
      return 'unknown';
  }
}

// ============================================================================
// ENTITY DOCUMENTATION
// ============================================================================

function generateEntityDoc(entity: AST.Entity, options: MarkdownOptions): string {
  const lines: string[] = [];
  const name = entity.name.name;

  lines.push(`### ${name}`);
  lines.push('');

  // Fields table
  lines.push('#### Fields');
  lines.push('');
  lines.push('| Name | Type | Modifiers | Optional |');
  lines.push('|------|------|-----------|----------|');
  
  for (const field of entity.fields) {
    const fieldName = field.name.name;
    const fieldType = formatTypeDefShort(field.type);
    const modifiers = field.annotations.map(a => `\`${a.name.name}\``).join(' ') || '-';
    const optional = field.optional ? 'Yes' : 'No';
    lines.push(`| ${fieldName} | \`${fieldType}\` | ${modifiers} | ${optional} |`);
  }
  lines.push('');

  // Invariants
  if (entity.invariants.length > 0) {
    lines.push('#### Invariants');
    lines.push('');
    for (const inv of entity.invariants) {
      lines.push(`- \`${formatExpr(inv)}\``);
    }
    lines.push('');
  }

  // Lifecycle
  if (entity.lifecycle && options.includeDiagrams) {
    lines.push('#### Lifecycle');
    lines.push('');
    lines.push('```mermaid');
    lines.push('stateDiagram-v2');
    
    // Find initial state (appears only in 'from' positions)
    const fromStates = new Set(entity.lifecycle.transitions.map(t => t.from.name));
    const toStates = new Set(entity.lifecycle.transitions.map(t => t.to.name));
    const initialStates = [...fromStates].filter(s => ![...toStates].some(ts => ts === s && !fromStates.has(ts)));
    
    if (initialStates.length > 0) {
      lines.push(`    [*] --> ${initialStates[0]}`);
    }
    
    for (const transition of entity.lifecycle.transitions) {
      lines.push(`    ${transition.from.name} --> ${transition.to.name}`);
    }
    
    // Find terminal states (appear only in 'to' positions, never in 'from')
    const terminalStates = [...toStates].filter(s => !fromStates.has(s));
    for (const terminal of terminalStates) {
      lines.push(`    ${terminal} --> [*]`);
    }
    
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// BEHAVIOR DOCUMENTATION
// ============================================================================

function generateBehaviorDoc(behavior: AST.Behavior): string {
  const lines: string[] = [];
  const name = behavior.name.name;

  lines.push(`### ${name}`);
  lines.push('');

  if (behavior.description) {
    lines.push(`> ${behavior.description.value}`);
    lines.push('');
  }

  // Actors
  if (behavior.actors && behavior.actors.length > 0) {
    lines.push('#### Actors');
    lines.push('');
    for (const actor of behavior.actors) {
      const constraints = actor.constraints.length > 0 
        ? ` (${actor.constraints.map(c => formatExpr(c)).join(', ')})` 
        : '';
      lines.push(`- **${actor.name.name}**${constraints}`);
    }
    lines.push('');
  }

  // Input
  lines.push('#### Input');
  lines.push('');
  if (behavior.input.fields.length > 0) {
    lines.push('| Parameter | Type | Required | Annotations |');
    lines.push('|-----------|------|----------|-------------|');
    for (const field of behavior.input.fields) {
      const required = field.optional ? 'No' : 'Yes';
      const annotations = field.annotations.map(a => `\`${a.name.name}\``).join(' ') || '-';
      lines.push(`| ${field.name.name} | \`${formatTypeDefShort(field.type)}\` | ${required} | ${annotations} |`);
    }
  } else {
    lines.push('*No input parameters*');
  }
  lines.push('');

  // Output
  lines.push('#### Output');
  lines.push('');
  lines.push(`**Success:** \`${formatTypeDefShort(behavior.output.success)}\``);
  lines.push('');

  if (behavior.output.errors.length > 0) {
    lines.push('**Errors:**');
    lines.push('');
    lines.push('| Error Code | Description | Retriable |');
    lines.push('|------------|-------------|-----------|');
    for (const error of behavior.output.errors) {
      const description = error.when?.value ?? '-';
      const retriable = error.retriable ? 'Yes' : 'No';
      lines.push(`| \`${error.name.name}\` | ${description} | ${retriable} |`);
    }
    lines.push('');
  }

  // Preconditions
  if (behavior.preconditions.length > 0) {
    lines.push('#### Preconditions');
    lines.push('');
    for (const pre of behavior.preconditions) {
      lines.push(`- \`${formatExpr(pre)}\``);
    }
    lines.push('');
  }

  // Postconditions
  if (behavior.postconditions.length > 0) {
    lines.push('#### Postconditions');
    lines.push('');
    for (const block of behavior.postconditions) {
      const condName = typeof block.condition === 'string' 
        ? block.condition 
        : block.condition.name;
      lines.push(`**On ${condName}:**`);
      lines.push('');
      for (const pred of block.predicates) {
        lines.push(`- \`${formatExpr(pred)}\``);
      }
      lines.push('');
    }
  }

  // Temporal
  if (behavior.temporal.length > 0) {
    lines.push('#### Temporal Requirements');
    lines.push('');
    for (const spec of behavior.temporal) {
      const duration = spec.duration ? ` ${spec.duration.value}${spec.duration.unit}` : '';
      const percentile = spec.percentile ? ` (p${spec.percentile})` : '';
      lines.push(`- **${spec.operator}**${duration}: ${formatExpr(spec.predicate)}${percentile}`);
    }
    lines.push('');
  }

  // Security
  if (behavior.security.length > 0) {
    lines.push('#### Security');
    lines.push('');
    for (const sec of behavior.security) {
      lines.push(`- **${sec.type}:** ${formatExpr(sec.details)}`);
    }
    lines.push('');
  }

  // Compliance
  if (behavior.compliance.length > 0) {
    lines.push('#### Compliance');
    lines.push('');
    for (const comp of behavior.compliance) {
      lines.push(`- **${comp.standard.name}**`);
      for (const req of comp.requirements) {
        lines.push(`  - ${formatExpr(req)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// INVARIANT DOCUMENTATION
// ============================================================================

function generateInvariantDoc(invariant: AST.InvariantBlock): string {
  const lines: string[] = [];

  lines.push(`### ${invariant.name.name}`);
  lines.push('');

  if (invariant.description) {
    lines.push(`> ${invariant.description.value}`);
    lines.push('');
  }

  lines.push(`**Scope:** ${invariant.scope}`);
  lines.push('');

  lines.push('**Predicates:**');
  lines.push('');
  for (const pred of invariant.predicates) {
    lines.push(`- \`${formatExpr(pred)}\``);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// POLICY DOCUMENTATION
// ============================================================================

function generatePolicyDoc(policy: AST.Policy): string {
  const lines: string[] = [];

  lines.push(`### ${policy.name.name}`);
  lines.push('');

  const target = policy.appliesTo.target === 'all' 
    ? 'all behaviors'
    : policy.appliesTo.target.map(t => t.name).join(', ');
  lines.push(`**Applies to:** ${target}`);
  lines.push('');

  lines.push('**Rules:**');
  lines.push('');
  for (const rule of policy.rules) {
    const condition = rule.condition ? `when \`${formatExpr(rule.condition)}\`: ` : '';
    lines.push(`- ${condition}\`${formatExpr(rule.action)}\``);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// VIEW DOCUMENTATION
// ============================================================================

function generateViewDoc(view: AST.View): string {
  const lines: string[] = [];

  lines.push(`### ${view.name.name}`);
  lines.push('');

  lines.push(`**For:** \`${view.forEntity.name.parts.map(p => p.name).join('.')}\``);
  lines.push('');

  lines.push('#### Fields');
  lines.push('');
  lines.push('| Field | Type | Computation |');
  lines.push('|-------|------|-------------|');
  for (const field of view.fields) {
    lines.push(`| ${field.name.name} | \`${formatTypeDefShort(field.type)}\` | \`${formatExpr(field.computation)}\` |`);
  }
  lines.push('');

  // Consistency
  lines.push('#### Consistency');
  lines.push('');
  lines.push(`**Mode:** ${view.consistency.mode}`);
  if (view.consistency.maxDelay) {
    lines.push(`**Max Delay:** ${view.consistency.maxDelay.value}${view.consistency.maxDelay.unit}`);
  }
  if (view.consistency.strongFields && view.consistency.strongFields.length > 0) {
    lines.push(`**Strongly Consistent Fields:** ${view.consistency.strongFields.map(f => f.name).join(', ')}`);
  }
  lines.push('');

  // Cache
  if (view.cache) {
    lines.push('#### Cache');
    lines.push('');
    lines.push(`**TTL:** ${view.cache.ttl.value}${view.cache.ttl.unit}`);
    if (view.cache.invalidateOn.length > 0) {
      lines.push(`**Invalidate On:** ${view.cache.invalidateOn.map(e => formatExpr(e)).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTypeDefShort(def: AST.TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      return def.name;
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ListType':
      return `List<${formatTypeDefShort(def.element)}>`;
    case 'MapType':
      return `Map<${formatTypeDefShort(def.key)}, ${formatTypeDefShort(def.value)}>`;
    case 'OptionalType':
      return `${formatTypeDefShort(def.inner)}?`;
    case 'ConstrainedType':
      return formatTypeDefShort(def.base);
    case 'EnumType':
      return def.variants.map(v => v.name.name).join(' | ');
    case 'StructType':
      return `{ ... }`;
    case 'UnionType':
      return def.variants.map(v => v.name.name).join(' | ');
    default:
      return 'unknown';
  }
}

function formatExpr(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'QualifiedName':
      return expr.parts.map(p => p.name).join('.');
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'NullLiteral':
      return 'null';
    case 'DurationLiteral':
      return `${expr.value}${expr.unit}`;
    case 'BinaryExpr':
      return `${formatExpr(expr.left)} ${expr.operator} ${formatExpr(expr.right)}`;
    case 'UnaryExpr':
      return `${expr.operator} ${formatExpr(expr.operand)}`;
    case 'CallExpr':
      return `${formatExpr(expr.callee)}(${expr.arguments.map(formatExpr).join(', ')})`;
    case 'MemberExpr':
      return `${formatExpr(expr.object)}.${expr.property.name}`;
    case 'IndexExpr':
      return `${formatExpr(expr.object)}[${formatExpr(expr.index)}]`;
    case 'QuantifierExpr':
      return `${expr.quantifier}(${expr.variable.name} in ${formatExpr(expr.collection)}, ${formatExpr(expr.predicate)})`;
    case 'ConditionalExpr':
      return `${formatExpr(expr.condition)} ? ${formatExpr(expr.thenBranch)} : ${formatExpr(expr.elseBranch)}`;
    case 'OldExpr':
      return `old(${formatExpr(expr.expression)})`;
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    case 'InputExpr':
      return `input.${expr.property.name}`;
    case 'LambdaExpr':
      return `(${expr.params.map(p => p.name).join(', ')}) => ${formatExpr(expr.body)}`;
    case 'ListExpr':
      return `[${expr.elements.map(formatExpr).join(', ')}]`;
    case 'MapExpr':
      return `{ ${expr.entries.map(e => `${formatExpr(e.key)}: ${formatExpr(e.value)}`).join(', ')} }`;
    default:
      return '...';
  }
}
