// ============================================================================
// Inspect Command
// Inspect entities, behaviors, and types
// ============================================================================

import type { Domain, CommandResult } from '../types.js';
import { formatEntity, formatBehavior, formatType, formatDomainSummary } from '../formatter.js';

/**
 * Inspect command handler
 */
export function inspectCommand(
  name: string | undefined,
  domain: Domain | null
): CommandResult {
  if (!domain) {
    return {
      success: false,
      error: 'No domain loaded. Use :load <file.isl> first.',
    };
  }

  if (!name) {
    // Show domain summary
    return {
      success: true,
      message: formatDomainSummary(domain),
    };
  }

  // Try to find entity
  const entity = domain.entities.find(e => e.name.name === name);
  if (entity) {
    return {
      success: true,
      message: formatEntity(entity),
      data: entity,
    };
  }

  // Try to find behavior
  const behavior = domain.behaviors.find(b => b.name.name === name);
  if (behavior) {
    return {
      success: true,
      message: formatBehavior(behavior),
      data: behavior,
    };
  }

  // Try to find type
  const type = domain.types.find(t => t.name.name === name);
  if (type) {
    return {
      success: true,
      message: formatTypeDeclaration(type, domain),
      data: type,
    };
  }

  // Try to find invariant block
  const invariant = domain.invariants.find(i => i.name?.name === name);
  if (invariant) {
    return {
      success: true,
      message: formatInvariantBlock(invariant),
      data: invariant,
    };
  }

  // Try to find policy
  const policy = domain.policies.find(p => p.name.name === name);
  if (policy) {
    return {
      success: true,
      message: formatPolicy(policy),
      data: policy,
    };
  }

  // Not found
  const available = [
    ...domain.entities.map(e => e.name.name),
    ...domain.behaviors.map(b => b.name.name),
    ...domain.types.map(t => t.name.name),
  ];

  return {
    success: false,
    error: `Not found: ${name}\nAvailable: ${available.join(', ')}`,
  };
}

/**
 * Format type declaration for display
 */
function formatTypeDeclaration(type: Domain['types'][0], _domain: Domain): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`Type: ${type.name.name}`);
  lines.push('─'.repeat(40));

  // Annotations
  if (type.annotations.length > 0) {
    lines.push('');
    lines.push('Annotations:');
    for (const ann of type.annotations) {
      lines.push(`  @${ann.name}`);
    }
  }

  // Definition
  lines.push('');
  lines.push('Definition:');
  lines.push(`  ${formatType(type.definition)}`);

  // Details based on type kind
  switch (type.definition.kind) {
    case 'EnumType':
      lines.push('');
      lines.push('Variants:');
      for (const variant of type.definition.variants) {
        lines.push(`  - ${variant.name.name}`);
      }
      break;

    case 'StructType':
      lines.push('');
      lines.push('Fields:');
      for (const field of type.definition.fields) {
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name.name}${optional}: ${formatType(field.type)}`);
      }
      break;

    case 'UnionType':
      lines.push('');
      lines.push('Variants:');
      for (const variant of type.definition.variants) {
        const data = variant.data ? `: ${formatType(variant.data)}` : '';
        lines.push(`  - ${variant.name.name}${data}`);
      }
      break;

    case 'ConstrainedType':
      lines.push('');
      lines.push('Base type:');
      lines.push(`  ${formatType(type.definition.base)}`);
      lines.push('');
      lines.push('Constraints:');
      for (const constraint of type.definition.constraints) {
        lines.push(`  ${constraint.name}: ${JSON.stringify(constraint.value)}`);
      }
      break;
  }

  return lines.join('\n');
}

/**
 * Format invariant block for display
 */
function formatInvariantBlock(invariant: Domain['invariants'][0]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`Invariant: ${invariant.name?.name ?? 'unnamed'}`);
  lines.push('─'.repeat(40));

  if (invariant.description) {
    lines.push('');
    lines.push(invariant.description.value);
  }

  lines.push('');
  lines.push('Conditions:');
  for (const condition of invariant.conditions) {
    // Format expression (simplified)
    lines.push(`  ${JSON.stringify(condition)}`);
  }

  return lines.join('\n');
}

/**
 * Format policy for display
 */
function formatPolicy(policy: Domain['policies'][0]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`Policy: ${policy.name.name}`);
  lines.push('─'.repeat(40));
  lines.push('');
  lines.push(`Actor: ${policy.actor.name}`);
  lines.push('');
  lines.push('Rules:');

  for (const rule of policy.rules) {
    const actions = rule.actions.join(', ');
    lines.push(`  ${rule.permission} ${actions} on ${rule.resource.name}`);
    if (rule.condition) {
      lines.push(`    when: ${JSON.stringify(rule.condition)}`);
    }
  }

  return lines.join('\n');
}

/**
 * List all items of a type
 */
export function listCommand(
  what: string | undefined,
  domain: Domain | null
): CommandResult {
  if (!domain) {
    return {
      success: false,
      error: 'No domain loaded. Use :load <file.isl> first.',
    };
  }

  const lines: string[] = [];

  switch (what) {
    case 'entities':
      lines.push('Entities:');
      for (const entity of domain.entities) {
        const desc = entity.description ? ` - ${entity.description.value}` : '';
        lines.push(`  ${entity.name.name}${desc}`);
      }
      break;

    case 'behaviors':
      lines.push('Behaviors:');
      for (const behavior of domain.behaviors) {
        const desc = behavior.description ? ` - ${behavior.description.value}` : '';
        lines.push(`  ${behavior.name.name}${desc}`);
      }
      break;

    case 'types':
      lines.push('Types:');
      for (const type of domain.types) {
        lines.push(`  ${type.name.name}: ${type.definition.kind}`);
      }
      break;

    case 'invariants':
      lines.push('Invariants:');
      for (const inv of domain.invariants) {
        const name = inv.name?.name ?? 'unnamed';
        const count = inv.conditions.length;
        lines.push(`  ${name} (${count} conditions)`);
      }
      break;

    case 'policies':
      lines.push('Policies:');
      for (const policy of domain.policies) {
        lines.push(`  ${policy.name.name} (actor: ${policy.actor.name})`);
      }
      break;

    default:
      lines.push('Usage: :list <entities|behaviors|types|invariants|policies>');
      lines.push('');
      lines.push('Or use :inspect <name> to see details');
  }

  return {
    success: true,
    message: lines.join('\n'),
  };
}
