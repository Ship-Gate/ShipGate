// ============================================================================
// Visual → ISL Serializer
// ============================================================================

import type { ISLNode, ISLEdge, EntityNodeData, BehaviorNodeData, TypeNodeData, InvariantNodeData, PolicyNodeData } from '@/types';

interface SerializerInput {
  nodes: ISLNode[];
  edges: ISLEdge[];
  domainName: string;
  domainVersion: string;
}

export function serializeToISL(input: SerializerInput): string {
  const { nodes, edges, domainName, domainVersion } = input;
  const lines: string[] = [];

  // Domain header
  lines.push(`domain ${domainName} {`);
  lines.push(`  version: "${domainVersion}"`);
  lines.push('');

  // Group nodes by type
  const types = nodes.filter((n) => n.data.type === 'type');
  const entities = nodes.filter((n) => n.data.type === 'entity');
  const behaviors = nodes.filter((n) => n.data.type === 'behavior');
  const invariants = nodes.filter((n) => n.data.type === 'invariant');
  const policies = nodes.filter((n) => n.data.type === 'policy');

  // Serialize types
  if (types.length > 0) {
    lines.push('  // Types');
    for (const node of types) {
      lines.push(...serializeType(node.data as TypeNodeData).map((l) => `  ${l}`));
      lines.push('');
    }
  }

  // Serialize entities
  if (entities.length > 0) {
    lines.push('  // Entities');
    for (const node of entities) {
      lines.push(...serializeEntity(node.data as EntityNodeData).map((l) => `  ${l}`));
      lines.push('');
    }
  }

  // Serialize behaviors
  if (behaviors.length > 0) {
    lines.push('  // Behaviors');
    for (const node of behaviors) {
      lines.push(...serializeBehavior(node.data as BehaviorNodeData).map((l) => `  ${l}`));
      lines.push('');
    }
  }

  // Serialize invariants
  if (invariants.length > 0) {
    lines.push('  // Invariants');
    for (const node of invariants) {
      lines.push(...serializeInvariant(node.data as InvariantNodeData).map((l) => `  ${l}`));
      lines.push('');
    }
  }

  // Serialize policies
  if (policies.length > 0) {
    lines.push('  // Policies');
    for (const node of policies) {
      lines.push(...serializePolicy(node.data as PolicyNodeData).map((l) => `  ${l}`));
      lines.push('');
    }
  }

  lines.push('}');

  return lines.join('\n');
}

function serializeType(data: TypeNodeData): string[] {
  const lines: string[] = [];
  
  if (data.constraints.length === 0) {
    lines.push(`type ${data.name} = ${data.definition}`);
  } else {
    lines.push(`type ${data.name} = ${data.definition} {`);
    for (const constraint of data.constraints) {
      lines.push(`  ${constraint}`);
    }
    lines.push('}');
  }
  
  return lines;
}

function serializeEntity(data: EntityNodeData): string[] {
  const lines: string[] = [];
  
  lines.push(`entity ${data.name} {`);
  
  // Fields
  for (const field of data.fields) {
    const annotations = field.annotations.length > 0
      ? ` ${field.annotations.join(' ')}`
      : '';
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name}: ${field.type}${optional}${annotations}`);
  }
  
  // Invariants
  if (data.invariants.length > 0) {
    lines.push('');
    lines.push('  invariant {');
    for (const inv of data.invariants) {
      lines.push(`    ${inv}`);
    }
    lines.push('  }');
  }
  
  // Lifecycle
  if (data.lifecycleStates && data.lifecycleStates.length > 0) {
    lines.push('');
    lines.push('  lifecycle {');
    for (let i = 0; i < data.lifecycleStates.length - 1; i++) {
      lines.push(`    ${data.lifecycleStates[i]} -> ${data.lifecycleStates[i + 1]}`);
    }
    lines.push('  }');
  }
  
  lines.push('}');
  
  return lines;
}

function serializeBehavior(data: BehaviorNodeData): string[] {
  const lines: string[] = [];
  
  lines.push(`behavior ${data.name} {`);
  
  // Description
  if (data.description) {
    lines.push(`  description: "${data.description}"`);
    lines.push('');
  }
  
  // Input
  lines.push('  input {');
  for (const input of data.inputs) {
    const optional = input.optional ? '?' : '';
    lines.push(`    ${input.name}: ${input.type}${optional}`);
  }
  lines.push('  }');
  lines.push('');
  
  // Output
  lines.push('  output {');
  lines.push(`    success: ${data.outputType}`);
  if (data.errors.length > 0) {
    lines.push('');
    for (const error of data.errors) {
      lines.push(`    error ${error}`);
    }
  }
  lines.push('  }');
  
  // Preconditions
  if (data.preconditions.length > 0) {
    lines.push('');
    lines.push('  pre {');
    for (const pre of data.preconditions) {
      lines.push(`    ${pre}`);
    }
    lines.push('  }');
  }
  
  // Postconditions
  if (data.postconditions.length > 0) {
    lines.push('');
    lines.push('  post {');
    for (const post of data.postconditions) {
      lines.push(`    ${post}`);
    }
    lines.push('  }');
  }
  
  lines.push('}');
  
  return lines;
}

function serializeInvariant(data: InvariantNodeData): string[] {
  const lines: string[] = [];
  
  lines.push(`invariant ${data.name} {`);
  lines.push(`  scope: ${data.scope}`);
  
  if (data.predicates.length > 0) {
    lines.push('');
    for (const pred of data.predicates) {
      lines.push(`  ${pred}`);
    }
  }
  
  lines.push('}');
  
  return lines;
}

function serializePolicy(data: PolicyNodeData): string[] {
  const lines: string[] = [];
  
  lines.push(`policy ${data.name} {`);
  
  // Applies to
  const appliesTo = data.appliesTo.includes('all')
    ? 'all'
    : data.appliesTo.join(', ');
  lines.push(`  applies_to: ${appliesTo}`);
  
  // Rules
  if (data.rules.length > 0) {
    lines.push('');
    lines.push('  rules {');
    for (const rule of data.rules) {
      lines.push(`    ${rule}`);
    }
    lines.push('  }');
  }
  
  lines.push('}');
  
  return lines;
}
