// ============================================================================
// API Reference Generator - Generate comprehensive API documentation
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  APIReference,
  DomainInfo,
  TypeDoc,
  EntityDoc,
  BehaviorDoc,
  ViewDoc,
  InvariantDoc,
  FieldDoc,
  ConstraintDoc,
  ErrorDoc,
  ConditionDoc,
  PostconditionGroupDoc,
  LifecycleDoc,
  GeneratorOptions,
  GeneratedFile,
} from '../types';
import { generateMermaidSequenceDiagram, generateMermaidStateDiagram } from './diagrams';
import { expressionToString, typeToString } from '../utils/ast-helpers';

/**
 * Generate API reference from a domain
 */
export function generateAPIReference(domain: AST.Domain): APIReference {
  return {
    domain: extractDomainInfo(domain),
    types: domain.types.map(generateTypeDoc),
    entities: domain.entities.map((e) => generateEntityDoc(e, domain)),
    behaviors: domain.behaviors.map((b) => generateBehaviorDoc(b, domain)),
    views: domain.views.map(generateViewDoc),
    invariants: domain.invariants.map(generateInvariantDoc),
  };
}

/**
 * Generate API reference documentation pages
 */
export function generateAPIReferencePages(
  reference: APIReference,
  options: GeneratorOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { format } = options;

  // Index page
  files.push({
    path: 'api-reference/index.mdx',
    content: generateIndexPage(reference, format),
    type: 'page',
  });

  // Types page
  if (reference.types.length > 0) {
    files.push({
      path: 'api-reference/types.mdx',
      content: generateTypesPage(reference.types, format),
      type: 'page',
    });
  }

  // Entities pages
  for (const entity of reference.entities) {
    files.push({
      path: `api-reference/entities/${entity.name.toLowerCase()}.mdx`,
      content: generateEntityPage(entity, format),
      type: 'page',
    });
  }

  // Behaviors pages
  for (const behavior of reference.behaviors) {
    files.push({
      path: `api-reference/behaviors/${behavior.name.toLowerCase()}.mdx`,
      content: generateBehaviorPage(behavior, format, options),
      type: 'page',
    });
  }

  // Views page
  if (reference.views.length > 0) {
    files.push({
      path: 'api-reference/views.mdx',
      content: generateViewsPage(reference.views, format),
      type: 'page',
    });
  }

  // Invariants page
  if (reference.invariants.length > 0) {
    files.push({
      path: 'api-reference/invariants.mdx',
      content: generateInvariantsPage(reference.invariants, format),
      type: 'page',
    });
  }

  return files;
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

function extractDomainInfo(domain: AST.Domain): DomainInfo {
  return {
    name: domain.name.name,
    version: domain.version.value,
    owner: domain.owner?.value,
  };
}

function generateTypeDoc(type: AST.TypeDeclaration): TypeDoc {
  return {
    name: type.name.name,
    description: extractDescription(type.annotations),
    definition: typeToString(type.definition),
    constraints: extractConstraints(type.definition),
    examples: generateTypeExamples(type),
  };
}

function generateEntityDoc(entity: AST.Entity, _domain: AST.Domain): EntityDoc {
  return {
    name: entity.name.name,
    description: extractDescription([]),
    fields: entity.fields.map(generateFieldDoc),
    invariants: entity.invariants.map(expressionToString),
    lifecycle: entity.lifecycle ? generateLifecycleDoc(entity.lifecycle) : undefined,
    examples: [],
  };
}

function generateBehaviorDoc(behavior: AST.Behavior, domain: AST.Domain): BehaviorDoc {
  const sequenceDiagram = generateMermaidSequenceDiagram(behavior);

  return {
    name: behavior.name.name,
    description: behavior.description?.value,
    actors: behavior.actors?.map((a) => ({
      name: a.name.name,
      constraints: a.constraints.map(expressionToString),
    })),
    input: {
      fields: behavior.input.fields.map(generateFieldDoc),
      schema: generateSchemaString(behavior.input.fields),
    },
    output: {
      fields: behavior.output.success ? [generateTypeField(behavior.output.success)] : [],
      schema: behavior.output.success ? typeToString(behavior.output.success) : 'void',
    },
    errors: behavior.output.errors.map(generateErrorDoc),
    preconditions: behavior.preconditions.map((p) => ({
      expression: expressionToString(p),
    })),
    postconditions: behavior.postconditions.map(generatePostconditionGroup),
    invariants: behavior.invariants.map(expressionToString),
    temporal: behavior.temporal.map((t) => ({
      type: t.operator,
      predicate: expressionToString(t.predicate),
      duration: t.duration ? `${t.duration.value}${t.duration.unit}` : undefined,
      percentile: t.percentile ? `p${t.percentile}` : undefined,
    })),
    security: behavior.security.map((s) => ({
      type: s.type,
      details: expressionToString(s.details),
    })),
    examples: extractScenarioExamples(behavior.name.name, domain),
    sequenceDiagram,
    tryIt: {
      defaultInput: generateDefaultInput(behavior.input.fields),
      mockResponse: true,
    },
  };
}

function generateViewDoc(view: AST.View): ViewDoc {
  return {
    name: view.name.name,
    forEntity: view.forEntity.name.parts.map((p) => p.name).join('.'),
    fields: view.fields.map((f) => ({
      name: f.name.name,
      type: typeToString(f.type),
      computation: expressionToString(f.computation),
    })),
    consistency: `${view.consistency.mode}${view.consistency.maxDelay ? ` (max ${view.consistency.maxDelay.value}${view.consistency.maxDelay.unit})` : ''}`,
    cache: view.cache ? `TTL: ${view.cache.ttl.value}${view.cache.ttl.unit}` : undefined,
  };
}

function generateInvariantDoc(inv: AST.InvariantBlock): InvariantDoc {
  return {
    name: inv.name.name,
    description: inv.description?.value,
    scope: inv.scope,
    predicates: inv.predicates.map(expressionToString),
  };
}

function generateFieldDoc(field: AST.Field): FieldDoc {
  return {
    name: field.name.name,
    type: typeToString(field.type),
    description: extractDescription(field.annotations),
    annotations: field.annotations.map((a) => a.name.name),
    optional: field.optional,
    defaultValue: field.defaultValue ? expressionToString(field.defaultValue) : undefined,
  };
}

function generateTypeField(type: AST.TypeDefinition): FieldDoc {
  return {
    name: 'result',
    type: typeToString(type),
    annotations: [],
    optional: false,
  };
}

function generateErrorDoc(error: AST.ErrorSpec): ErrorDoc {
  return {
    name: error.name.name,
    when: error.when?.value,
    retriable: error.retriable,
    retryAfter: error.retryAfter ? expressionToString(error.retryAfter) : undefined,
    returns: error.returns ? typeToString(error.returns) : undefined,
  };
}

function generatePostconditionGroup(block: AST.PostconditionBlock): PostconditionGroupDoc {
  let condition: string;
  if (block.condition === 'success') {
    condition = 'success';
  } else if (block.condition === 'any_error') {
    condition = 'any_error';
  } else {
    condition = block.condition.name;
  }

  return {
    condition,
    predicates: block.predicates.map((p) => ({
      expression: expressionToString(p),
    })),
  };
}

function generateLifecycleDoc(lifecycle: AST.LifecycleSpec): LifecycleDoc {
  const states = new Set<string>();
  const transitions = lifecycle.transitions.map((t) => {
    states.add(t.from.name);
    states.add(t.to.name);
    return { from: t.from.name, to: t.to.name };
  });

  return {
    states: Array.from(states),
    transitions,
    diagram: generateMermaidStateDiagram(Array.from(states), transitions),
  };
}

function extractConstraints(type: AST.TypeDefinition): ConstraintDoc[] {
  if (type.kind !== 'ConstrainedType') return [];

  return type.constraints.map((c) => ({
    name: c.name,
    value: expressionToString(c.value),
  }));
}

function extractDescription(annotations: AST.Annotation[]): string | undefined {
  const descAnnotation = annotations.find((a) => a.name.name === 'description');
  if (descAnnotation?.value && descAnnotation.value.kind === 'StringLiteral') {
    return descAnnotation.value.value;
  }
  return undefined;
}

function extractScenarioExamples(behaviorName: string, domain: AST.Domain): BehaviorDoc['examples'] {
  const scenarioBlock = domain.scenarios.find((s) => s.behaviorName.name === behaviorName);
  if (!scenarioBlock) return [];

  return scenarioBlock.scenarios.map((scenario) => ({
    name: scenario.name.value,
    description: scenario.name.value,
    given: scenario.given.map(statementToString),
    when: scenario.when.map(statementToString),
    then: scenario.then.map(expressionToString),
  }));
}

function statementToString(stmt: AST.Statement): string {
  switch (stmt.kind) {
    case 'AssignmentStmt':
      return `${stmt.target.name} = ${expressionToString(stmt.value)}`;
    case 'CallStmt':
      return stmt.target
        ? `${stmt.target.name} = ${expressionToString(stmt.call)}`
        : expressionToString(stmt.call);
    case 'LoopStmt':
      return `repeat ${expressionToString(stmt.count)} times`;
    default:
      return '';
  }
}

function generateSchemaString(fields: AST.Field[]): string {
  const obj: Record<string, string> = {};
  for (const field of fields) {
    obj[field.name.name] = typeToString(field.type) + (field.optional ? '?' : '');
  }
  return JSON.stringify(obj, null, 2);
}

function generateDefaultInput(fields: AST.Field[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const field of fields) {
    input[field.name.name] = getDefaultValue(field.type);
  }
  return input;
}

function getDefaultValue(type: AST.TypeDefinition): unknown {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return '';
        case 'Int': return 0;
        case 'Decimal': return 0.0;
        case 'Boolean': return false;
        case 'UUID': return '00000000-0000-0000-0000-000000000000';
        case 'Timestamp': return new Date().toISOString();
        default: return null;
      }
    case 'ListType': return [];
    case 'MapType': return {};
    case 'OptionalType': return null;
    default: return null;
  }
}

function generateTypeExamples(_type: AST.TypeDeclaration): string[] {
  return [];
}

// ============================================================================
// PAGE GENERATION
// ============================================================================

function generateIndexPage(reference: APIReference, format: string): string {
  const frontmatter = generateFrontmatter({
    title: `${reference.domain.name} API Reference`,
    description: `Complete API reference for ${reference.domain.name} v${reference.domain.version}`,
  }, format);

  return `${frontmatter}

# ${reference.domain.name} API Reference

Version: **${reference.domain.version}**
${reference.domain.owner ? `Owner: ${reference.domain.owner}` : ''}

## Overview

This documentation provides a complete reference for the ${reference.domain.name} domain.

## Contents

### Types
${reference.types.length} custom types defined.
[View all types →](./types)

### Entities
${reference.entities.map((e) => `- [${e.name}](./entities/${e.name.toLowerCase()})`).join('\n')}

### Behaviors
${reference.behaviors.map((b) => `- [${b.name}](./behaviors/${b.name.toLowerCase()}) - ${b.description ?? ''}`).join('\n')}

${reference.views.length > 0 ? `### Views
[View all views →](./views)` : ''}

${reference.invariants.length > 0 ? `### Invariants
[View all invariants →](./invariants)` : ''}
`;
}

function generateTypesPage(types: TypeDoc[], format: string): string {
  const frontmatter = generateFrontmatter({
    title: 'Types',
    description: 'Custom type definitions',
  }, format);

  const typesSections = types.map((type) => `
## ${type.name}

${type.description ?? ''}

\`\`\`isl
type ${type.name} = ${type.definition}
\`\`\`

${type.constraints.length > 0 ? `
### Constraints

| Name | Value |
|------|-------|
${type.constraints.map((c) => `| ${c.name} | \`${c.value}\` |`).join('\n')}
` : ''}
`).join('\n---\n');

  return `${frontmatter}

# Types

${typesSections}
`;
}

function generateEntityPage(entity: EntityDoc, format: string): string {
  const frontmatter = generateFrontmatter({
    title: entity.name,
    description: entity.description ?? `${entity.name} entity documentation`,
  }, format);

  return `${frontmatter}

# ${entity.name}

${entity.description ?? ''}

## Fields

| Name | Type | Required | Annotations |
|------|------|----------|-------------|
${entity.fields.map((f) => `| ${f.name} | \`${f.type}\` | ${f.optional ? 'No' : 'Yes'} | ${f.annotations.join(', ') || '-'} |`).join('\n')}

${entity.invariants.length > 0 ? `
## Invariants

${entity.invariants.map((i) => `- \`${i}\``).join('\n')}
` : ''}

${entity.lifecycle ? `
## Lifecycle

States: ${entity.lifecycle.states.join(', ')}

\`\`\`mermaid
${entity.lifecycle.diagram}
\`\`\`

### Transitions

| From | To |
|------|-----|
${entity.lifecycle.transitions.map((t) => `| ${t.from} | ${t.to} |`).join('\n')}
` : ''}
`;
}

function generateBehaviorPage(
  behavior: BehaviorDoc,
  format: string,
  options: GeneratorOptions
): string {
  const frontmatter = generateFrontmatter({
    title: behavior.name,
    description: behavior.description ?? `${behavior.name} behavior documentation`,
  }, format);

  return `${frontmatter}

# ${behavior.name}

${behavior.description ?? ''}

${behavior.actors && behavior.actors.length > 0 ? `
## Actors

${behavior.actors.map((a) => `- **${a.name}**${a.constraints.length > 0 ? `: ${a.constraints.join(', ')}` : ''}`).join('\n')}
` : ''}

## Input

\`\`\`typescript
${behavior.input.schema}
\`\`\`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
${behavior.input.fields.map((f) => `| ${f.name} | \`${f.type}\` | ${f.optional ? 'No' : 'Yes'} | ${f.description ?? '-'} |`).join('\n')}

## Output

**Success:** \`${behavior.output.schema}\`

${behavior.errors.length > 0 ? `
### Errors

| Error | When | Retriable |
|-------|------|-----------|
${behavior.errors.map((e) => `| \`${e.name}\` | ${e.when ?? '-'} | ${e.retriable ? 'Yes' : 'No'} |`).join('\n')}
` : ''}

${behavior.preconditions.length > 0 ? `
## Preconditions

${behavior.preconditions.map((p) => `- \`${p.expression}\``).join('\n')}
` : ''}

${behavior.postconditions.length > 0 ? `
## Postconditions

${behavior.postconditions.map((group) => `
### On ${group.condition}

${group.predicates.map((p) => `- \`${p.expression}\``).join('\n')}
`).join('\n')}
` : ''}

${behavior.invariants.length > 0 ? `
## Invariants

${behavior.invariants.map((i) => `- \`${i}\``).join('\n')}
` : ''}

${behavior.temporal.length > 0 ? `
## Temporal Requirements

| Type | Predicate | Duration | Percentile |
|------|-----------|----------|------------|
${behavior.temporal.map((t) => `| ${t.type} | ${t.predicate} | ${t.duration ?? '-'} | ${t.percentile ?? '-'} |`).join('\n')}
` : ''}

${behavior.security.length > 0 ? `
## Security

${behavior.security.map((s) => `- **${s.type}**: ${s.details}`).join('\n')}
` : ''}

${behavior.sequenceDiagram && options.diagrams ? `
## Sequence Diagram

\`\`\`mermaid
${behavior.sequenceDiagram}
\`\`\`
` : ''}

${behavior.examples.length > 0 ? `
## Examples

${behavior.examples.map((ex) => `
### ${ex.name}

${ex.description}

**Given:**
${ex.given?.map((g) => `- ${g}`).join('\n') ?? 'N/A'}

**When:**
${ex.when.map((w) => `- ${w}`).join('\n')}

**Then:**
${ex.then.map((t) => `- \`${t}\``).join('\n')}
`).join('\n')}
` : ''}

${options.interactive && behavior.tryIt ? `
## Try It

<TryIt
  behavior="${behavior.name}"
  defaultInput={${JSON.stringify(behavior.tryIt.defaultInput, null, 2)}}
/>
` : ''}
`;
}

function generateViewsPage(views: ViewDoc[], format: string): string {
  const frontmatter = generateFrontmatter({
    title: 'Views',
    description: 'Query views documentation',
  }, format);

  return `${frontmatter}

# Views

${views.map((view) => `
## ${view.name}

For entity: \`${view.forEntity}\`

### Fields

| Name | Type | Computation |
|------|------|-------------|
${view.fields.map((f) => `| ${f.name} | \`${f.type}\` | \`${f.computation}\` |`).join('\n')}

**Consistency:** ${view.consistency}
${view.cache ? `**Cache:** ${view.cache}` : ''}
`).join('\n---\n')}
`;
}

function generateInvariantsPage(invariants: InvariantDoc[], format: string): string {
  const frontmatter = generateFrontmatter({
    title: 'Invariants',
    description: 'Domain invariants',
  }, format);

  return `${frontmatter}

# Invariants

${invariants.map((inv) => `
## ${inv.name}

${inv.description ?? ''}

**Scope:** ${inv.scope}

### Predicates

${inv.predicates.map((p) => `- \`${p}\``).join('\n')}
`).join('\n---\n')}
`;
}

function generateFrontmatter(data: Record<string, unknown>, format: string): string {
  if (format === 'markdown') return '';

  const yaml = Object.entries(data)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? `"${value}"` : value}`)
    .join('\n');

  return `---
${yaml}
---`;
}
