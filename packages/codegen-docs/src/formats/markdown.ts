// ============================================================================
// Markdown Documentation Generator
// ============================================================================

import type { Domain, Entity, Behavior, TypeDeclaration, Invariant, Policy, DocOptions, GeneratedFile, Field } from '../types';

export function generateMarkdown(domain: Domain, options: DocOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { outputDir, title = domain.name } = options;

  // Main index
  files.push({
    path: `${outputDir}/README.md`,
    content: generateIndex(domain, title),
  });

  // Types documentation
  if (domain.types.length > 0) {
    files.push({
      path: `${outputDir}/types.md`,
      content: generateTypesDoc(domain.types, domain.name),
    });
  }

  // Entities documentation
  if (domain.entities.length > 0) {
    files.push({
      path: `${outputDir}/entities.md`,
      content: generateEntitiesDoc(domain.entities, domain.name),
    });

    // Individual entity files
    for (const entity of domain.entities) {
      files.push({
        path: `${outputDir}/entities/${toKebabCase(entity.name)}.md`,
        content: generateEntityDoc(entity),
      });
    }
  }

  // Behaviors documentation
  if (domain.behaviors.length > 0) {
    files.push({
      path: `${outputDir}/behaviors.md`,
      content: generateBehaviorsDoc(domain.behaviors, domain.name),
    });

    // Individual behavior files
    for (const behavior of domain.behaviors) {
      files.push({
        path: `${outputDir}/behaviors/${toKebabCase(behavior.name)}.md`,
        content: generateBehaviorDoc(behavior),
      });
    }
  }

  // Invariants & Policies
  if (domain.invariants.length > 0 || domain.policies.length > 0) {
    files.push({
      path: `${outputDir}/rules.md`,
      content: generateRulesDoc(domain.invariants, domain.policies),
    });
  }

  return files;
}

function generateIndex(domain: Domain, title: string): string {
  const lines: string[] = [];

  lines.push(`# ${title} API Documentation`);
  lines.push('');
  if (domain.version) {
    lines.push(`**Version:** ${domain.version}`);
    lines.push('');
  }
  if (domain.description) {
    lines.push(domain.description);
    lines.push('');
  }

  lines.push('## Overview');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Types | ${domain.types.length} |`);
  lines.push(`| Entities | ${domain.entities.length} |`);
  lines.push(`| Behaviors | ${domain.behaviors.length} |`);
  lines.push(`| Invariants | ${domain.invariants.length} |`);
  lines.push(`| Policies | ${domain.policies.length} |`);
  lines.push('');

  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Types](./types.md)');
  lines.push('- [Entities](./entities.md)');
  lines.push('- [Behaviors](./behaviors.md)');
  lines.push('- [Business Rules](./rules.md)');
  lines.push('');

  // Quick reference for entities
  if (domain.entities.length > 0) {
    lines.push('## Entities');
    lines.push('');
    for (const entity of domain.entities) {
      lines.push(`- [${entity.name}](./entities/${toKebabCase(entity.name)}.md)`);
    }
    lines.push('');
  }

  // Quick reference for behaviors
  if (domain.behaviors.length > 0) {
    lines.push('## Behaviors');
    lines.push('');
    for (const behavior of domain.behaviors) {
      lines.push(`- [${behavior.name}](./behaviors/${toKebabCase(behavior.name)}.md)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateTypesDoc(types: TypeDeclaration[], domainName: string): string {
  const lines: string[] = [];

  lines.push(`# ${domainName} Types`);
  lines.push('');
  lines.push('Custom type definitions used throughout the domain.');
  lines.push('');

  for (const type of types) {
    lines.push(`## ${type.name}`);
    lines.push('');
    if (type.description) {
      lines.push(type.description);
      lines.push('');
    }
    lines.push(`**Base Type:** \`${type.baseType}\``);
    lines.push('');

    if (type.constraints.length > 0) {
      lines.push('**Constraints:**');
      lines.push('');
      for (const constraint of type.constraints) {
        lines.push(`- ${constraint}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function generateEntitiesDoc(entities: Entity[], domainName: string): string {
  const lines: string[] = [];

  lines.push(`# ${domainName} Entities`);
  lines.push('');
  lines.push('Entity models representing the core data structures.');
  lines.push('');

  lines.push('| Entity | Fields | Has Lifecycle |');
  lines.push('|--------|--------|---------------|');
  for (const entity of entities) {
    const hasLifecycle = entity.lifecycleStates && entity.lifecycleStates.length > 0 ? '✓' : '';
    lines.push(`| [${entity.name}](./entities/${toKebabCase(entity.name)}.md) | ${entity.fields.length} | ${hasLifecycle} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function generateEntityDoc(entity: Entity): string {
  const lines: string[] = [];

  lines.push(`# ${entity.name}`);
  lines.push('');
  if (entity.description) {
    lines.push(entity.description);
    lines.push('');
  }

  // Fields table
  lines.push('## Fields');
  lines.push('');
  lines.push('| Field | Type | Required | Annotations |');
  lines.push('|-------|------|----------|-------------|');
  for (const field of entity.fields) {
    const required = field.optional ? 'No' : 'Yes';
    const annotations = field.annotations.join(', ') || '-';
    lines.push(`| \`${field.name}\` | \`${field.type}\` | ${required} | ${annotations} |`);
  }
  lines.push('');

  // Lifecycle
  if (entity.lifecycleStates && entity.lifecycleStates.length > 0) {
    lines.push('## Lifecycle States');
    lines.push('');
    lines.push('```mermaid');
    lines.push('stateDiagram-v2');
    for (let i = 0; i < entity.lifecycleStates.length - 1; i++) {
      lines.push(`    ${entity.lifecycleStates[i]} --> ${entity.lifecycleStates[i + 1]}`);
    }
    lines.push('```');
    lines.push('');
  }

  // Invariants
  if (entity.invariants.length > 0) {
    lines.push('## Invariants');
    lines.push('');
    lines.push('The following constraints must always hold:');
    lines.push('');
    for (const inv of entity.invariants) {
      lines.push(`- \`${inv}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateBehaviorsDoc(behaviors: Behavior[], domainName: string): string {
  const lines: string[] = [];

  lines.push(`# ${domainName} Behaviors`);
  lines.push('');
  lines.push('Operations available in the domain.');
  lines.push('');

  lines.push('| Behavior | Inputs | Output | Errors |');
  lines.push('|----------|--------|--------|--------|');
  for (const behavior of behaviors) {
    const inputs = behavior.inputs.length;
    const errors = behavior.errors.length;
    lines.push(`| [${behavior.name}](./behaviors/${toKebabCase(behavior.name)}.md) | ${inputs} | \`${behavior.outputType}\` | ${errors} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function generateBehaviorDoc(behavior: Behavior): string {
  const lines: string[] = [];

  lines.push(`# ${behavior.name}`);
  lines.push('');
  if (behavior.description) {
    lines.push(behavior.description);
    lines.push('');
  }

  // Input
  lines.push('## Input');
  lines.push('');
  if (behavior.inputs.length === 0) {
    lines.push('*No input parameters*');
  } else {
    lines.push('| Parameter | Type | Required | Description |');
    lines.push('|-----------|------|----------|-------------|');
    for (const input of behavior.inputs) {
      const required = input.optional ? 'No' : 'Yes';
      const desc = input.description || '-';
      lines.push(`| \`${input.name}\` | \`${input.type}\` | ${required} | ${desc} |`);
    }
  }
  lines.push('');

  // Output
  lines.push('## Output');
  lines.push('');
  lines.push(`**Success Type:** \`${behavior.outputType}\``);
  lines.push('');

  // Errors
  if (behavior.errors.length > 0) {
    lines.push('**Possible Errors:**');
    lines.push('');
    for (const error of behavior.errors) {
      lines.push(`- \`${error}\``);
    }
    lines.push('');
  }

  // Preconditions
  if (behavior.preconditions.length > 0) {
    lines.push('## Preconditions');
    lines.push('');
    lines.push('The following conditions must be true before execution:');
    lines.push('');
    lines.push('```isl');
    for (const pre of behavior.preconditions) {
      lines.push(pre);
    }
    lines.push('```');
    lines.push('');
  }

  // Postconditions
  if (behavior.postconditions.length > 0) {
    lines.push('## Postconditions');
    lines.push('');
    lines.push('The following conditions are guaranteed after successful execution:');
    lines.push('');
    lines.push('```isl');
    for (const post of behavior.postconditions) {
      lines.push(post);
    }
    lines.push('```');
    lines.push('');
  }

  // Temporal constraints
  if (behavior.temporal) {
    lines.push('## Performance Requirements');
    lines.push('');
    if (behavior.temporal.responseTime) {
      lines.push('**Response Time SLAs:**');
      lines.push('');
      for (const rt of behavior.temporal.responseTime) {
        lines.push(`- p${rt.percentile}: < ${rt.value}${rt.unit}`);
      }
      lines.push('');
    }
    if (behavior.temporal.rateLimit) {
      const rl = behavior.temporal.rateLimit;
      lines.push(`**Rate Limit:** ${rl.count}/${rl.period}${rl.scope ? ` per ${rl.scope}` : ''}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateRulesDoc(invariants: Invariant[], policies: Policy[]): string {
  const lines: string[] = [];

  lines.push('# Business Rules');
  lines.push('');

  if (invariants.length > 0) {
    lines.push('## Invariants');
    lines.push('');
    lines.push('Constraints that must always be maintained:');
    lines.push('');

    for (const inv of invariants) {
      lines.push(`### ${inv.name}`);
      lines.push('');
      if (inv.description) {
        lines.push(inv.description);
        lines.push('');
      }
      lines.push(`**Scope:** ${inv.scope}`);
      lines.push('');
      if (inv.predicates.length > 0) {
        lines.push('```isl');
        for (const pred of inv.predicates) {
          lines.push(pred);
        }
        lines.push('```');
        lines.push('');
      }
    }
  }

  if (policies.length > 0) {
    lines.push('## Policies');
    lines.push('');

    for (const policy of policies) {
      lines.push(`### ${policy.name}`);
      lines.push('');
      if (policy.description) {
        lines.push(policy.description);
        lines.push('');
      }
      lines.push(`**Applies to:** ${policy.appliesTo.join(', ')}`);
      lines.push('');
      if (policy.rules.length > 0) {
        lines.push('**Rules:**');
        lines.push('');
        for (const rule of policy.rules) {
          lines.push(`- ${rule}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
