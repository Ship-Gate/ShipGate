// ============================================================================
// Tutorial Generator - Generate step-by-step tutorials
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  Tutorial,
  TutorialStep,
  CodeBlock,
  Exercise,
  GeneratorOptions,
  GeneratedFile,
} from '../types';
import { expressionToString, typeToString } from '../utils/ast-helpers';

/**
 * Generate tutorials from a domain
 */
export function generateTutorials(
  domain: AST.Domain,
  options: GeneratorOptions
): Tutorial[] {
  const tutorials: Tutorial[] = [];

  // Getting Started tutorial
  tutorials.push(generateGettingStartedTutorial(domain));

  // Entity tutorials
  for (const entity of domain.entities) {
    tutorials.push(generateEntityTutorial(entity, domain));
  }

  // Behavior tutorials
  for (const behavior of domain.behaviors) {
    tutorials.push(generateBehaviorTutorial(behavior, domain));
  }

  // Advanced topics
  if (domain.invariants.length > 0) {
    tutorials.push(generateInvariantsTutorial(domain));
  }

  return tutorials;
}

/**
 * Generate tutorial documentation pages
 */
export function generateTutorialPages(
  tutorials: Tutorial[],
  options: GeneratorOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Index page
  files.push({
    path: 'tutorials/index.mdx',
    content: generateTutorialIndexPage(tutorials, options),
    type: 'page',
  });

  // Individual tutorial pages
  for (const tutorial of tutorials) {
    files.push({
      path: `tutorials/${tutorial.id}.mdx`,
      content: generateTutorialPage(tutorial, options),
      type: 'page',
    });
  }

  return files;
}

// ============================================================================
// TUTORIAL GENERATORS
// ============================================================================

function generateGettingStartedTutorial(domain: AST.Domain): Tutorial {
  return {
    id: 'getting-started',
    title: `Getting Started with ${domain.name.name}`,
    description: `Learn the basics of the ${domain.name.name} domain`,
    difficulty: 'beginner',
    estimatedTime: '15 minutes',
    prerequisites: [],
    steps: [
      {
        title: 'Introduction',
        content: `Welcome to ${domain.name.name}! This tutorial will guide you through the basic concepts and help you get started.

The ${domain.name.name} domain defines:
- ${domain.entities.length} entities
- ${domain.behaviors.length} behaviors
- ${domain.types.length} custom types`,
      },
      {
        title: 'Understanding Entities',
        content: `Entities are the core data structures in ${domain.name.name}. Here are the main entities:

${domain.entities.map(e => `- **${e.name.name}**: ${e.fields.length} fields`).join('\n')}

Each entity has its own set of fields, constraints, and lifecycle states.`,
        code: {
          language: 'isl',
          code: domain.entities[0]
            ? `entity ${domain.entities[0].name.name} {\n${domain.entities[0].fields.slice(0, 3).map(f => `  ${f.name.name}: ${typeToString(f.type)}`).join('\n')}\n}`
            : '// No entities defined',
          filename: 'example.isl',
        },
      },
      {
        title: 'Working with Behaviors',
        content: `Behaviors define the operations you can perform. The main behaviors are:

${domain.behaviors.slice(0, 5).map(b => `- **${b.name.name}**: ${b.description?.value ?? 'No description'}`).join('\n')}

Each behavior has preconditions that must be met and postconditions that describe the expected outcome.`,
      },
      {
        title: 'Your First Request',
        content: 'Let\'s make your first request to the system. Choose a behavior and provide the required input.',
        exercise: domain.behaviors[0] ? {
          prompt: `Call the ${domain.behaviors[0].name.name} behavior with valid input`,
          hints: [
            `Check the input schema for ${domain.behaviors[0].name.name}`,
            'Make sure all required fields are provided',
            'Verify the types match the expected schema',
          ],
          solution: {
            language: 'typescript',
            code: `const result = await ${domain.behaviors[0].name.name.toLowerCase()}({
  // Add your input here
});`,
          },
        } : undefined,
      },
      {
        title: 'Next Steps',
        content: `Congratulations! You've completed the getting started tutorial. Here's what to explore next:

1. Deep dive into [Entities](/tutorials/entities)
2. Learn about [Behaviors](/tutorials/behaviors)
3. Explore [Advanced Topics](/tutorials/advanced)`,
        checkpoint: {
          question: 'What did you learn in this tutorial?',
          options: [
            'How to define entities',
            'How to call behaviors',
            'Both of the above',
            'None of the above',
          ],
          correctAnswer: 2,
          explanation: 'This tutorial covered both entities and behaviors, giving you a foundation to work with the domain.',
        },
      },
    ],
    outcomes: [
      'Understand the structure of the domain',
      'Know the main entities and behaviors',
      'Make your first API call',
    ],
  };
}

function generateEntityTutorial(entity: AST.Entity, domain: AST.Domain): Tutorial {
  const relatedBehaviors = domain.behaviors.filter(b => {
    const str = JSON.stringify(b);
    return str.includes(entity.name.name);
  });

  return {
    id: `entity-${entity.name.name.toLowerCase()}`,
    title: `Working with ${entity.name.name}`,
    description: `Learn how to work with the ${entity.name.name} entity`,
    difficulty: 'intermediate',
    estimatedTime: '20 minutes',
    prerequisites: ['getting-started'],
    steps: [
      {
        title: `What is ${entity.name.name}?`,
        content: `The ${entity.name.name} entity represents a core concept in the domain. It has ${entity.fields.length} fields and ${entity.invariants.length} invariants.`,
        code: {
          language: 'isl',
          code: `entity ${entity.name.name} {\n${entity.fields.map(f => {
            const annotations = f.annotations.length > 0 
              ? ` [${f.annotations.map(a => a.name.name).join(', ')}]`
              : '';
            return `  ${f.name.name}: ${typeToString(f.type)}${annotations}`;
          }).join('\n')}\n}`,
          filename: `${entity.name.name.toLowerCase()}.isl`,
        },
      },
      {
        title: 'Field Types and Constraints',
        content: `Let's examine each field in ${entity.name.name}:

${entity.fields.map(f => {
  const required = f.optional ? 'Optional' : 'Required';
  const annotations = f.annotations.length > 0 
    ? `Annotations: ${f.annotations.map(a => a.name.name).join(', ')}`
    : '';
  return `### ${f.name.name}
- **Type:** \`${typeToString(f.type)}\`
- **${required}**
${annotations ? `- ${annotations}` : ''}`;
}).join('\n\n')}`,
      },
      ...(entity.lifecycle ? [{
        title: 'Lifecycle States',
        content: `${entity.name.name} has a defined lifecycle with the following states and transitions:

States: ${entity.lifecycle.transitions.map(t => t.from.name).concat(entity.lifecycle.transitions.map(t => t.to.name)).filter((v, i, a) => a.indexOf(v) === i).join(', ')}

Transitions:
${entity.lifecycle.transitions.map(t => `- ${t.from.name} → ${t.to.name}`).join('\n')}`,
      } as TutorialStep] : []),
      ...(entity.invariants.length > 0 ? [{
        title: 'Invariants',
        content: `${entity.name.name} must always satisfy these invariants:

${entity.invariants.map(i => `- \`${expressionToString(i)}\``).join('\n')}

These constraints are enforced at all times.`,
      } as TutorialStep] : []),
      ...(relatedBehaviors.length > 0 ? [{
        title: 'Related Behaviors',
        content: `These behaviors work with ${entity.name.name}:

${relatedBehaviors.map(b => `- [${b.name.name}](/api-reference/behaviors/${b.name.name.toLowerCase()})`).join('\n')}`,
      } as TutorialStep] : []),
    ],
    outcomes: [
      `Understand the ${entity.name.name} entity structure`,
      'Know all field types and constraints',
      entity.lifecycle ? 'Understand the entity lifecycle' : 'Know the invariants',
    ].filter(Boolean) as string[],
  };
}

function generateBehaviorTutorial(behavior: AST.Behavior, domain: AST.Domain): Tutorial {
  const scenarios = domain.scenarios.find(s => s.behaviorName.name === behavior.name.name);

  return {
    id: `behavior-${behavior.name.name.toLowerCase()}`,
    title: `Using ${behavior.name.name}`,
    description: behavior.description?.value ?? `Learn how to use the ${behavior.name.name} behavior`,
    difficulty: behavior.preconditions.length > 3 ? 'advanced' : 'intermediate',
    estimatedTime: '25 minutes',
    prerequisites: ['getting-started'],
    steps: [
      {
        title: 'Overview',
        content: `${behavior.description?.value ?? `The ${behavior.name.name} behavior allows you to perform a specific operation.`}

${behavior.actors && behavior.actors.length > 0 
  ? `**Allowed actors:** ${behavior.actors.map(a => a.name.name).join(', ')}`
  : ''}`,
      },
      {
        title: 'Input Schema',
        content: `To call ${behavior.name.name}, you need to provide the following input:

${behavior.input.fields.map(f => `- **${f.name.name}** (${f.optional ? 'optional' : 'required'}): \`${typeToString(f.type)}\``).join('\n')}`,
        code: {
          language: 'typescript',
          code: `interface ${behavior.name.name}Input {\n${behavior.input.fields.map(f => `  ${f.name.name}${f.optional ? '?' : ''}: ${typeToTSType(f.type)};`).join('\n')}\n}`,
          filename: 'types.ts',
        },
      },
      {
        title: 'Preconditions',
        content: behavior.preconditions.length > 0
          ? `Before ${behavior.name.name} can execute, these conditions must be met:

${behavior.preconditions.map(p => `- \`${expressionToString(p)}\``).join('\n')}

If any precondition fails, the behavior will return an error.`
          : `${behavior.name.name} has no preconditions - it can be called at any time.`,
      },
      {
        title: 'Expected Outcomes',
        content: `After successful execution, ${behavior.name.name} guarantees:

${behavior.postconditions.flatMap(block => 
  block.predicates.map(p => `- On ${typeof block.condition === 'string' ? block.condition : block.condition.name}: \`${expressionToString(p)}\``)
).join('\n')}`,
      },
      ...(behavior.output.errors.length > 0 ? [{
        title: 'Error Handling',
        content: `${behavior.name.name} may return these errors:

${behavior.output.errors.map(e => `### ${e.name.name}
- **When:** ${e.when?.value ?? 'Various conditions'}
- **Retriable:** ${e.retriable ? 'Yes' : 'No'}
${e.retryAfter ? `- **Retry after:** ${expressionToString(e.retryAfter)}` : ''}`).join('\n\n')}`,
      } as TutorialStep] : []),
      ...(scenarios && scenarios.scenarios.length > 0 ? [{
        title: 'Example Scenarios',
        content: `Here are some example scenarios for ${behavior.name.name}:

${scenarios.scenarios.slice(0, 2).map(s => `### ${s.name.value}

**Given:**
${s.given.map(g => `- ${statementToString(g)}`).join('\n') || 'No setup required'}

**When:**
${s.when.map(w => `- ${statementToString(w)}`).join('\n')}

**Then:**
${s.then.map(t => `- ${expressionToString(t)}`).join('\n')}`).join('\n\n')}`,
      } as TutorialStep] : []),
      {
        title: 'Try It Yourself',
        content: `Now it's your turn! Try calling ${behavior.name.name} with your own input.`,
        exercise: {
          prompt: `Call ${behavior.name.name} and verify the result matches the postconditions`,
          hints: [
            'Make sure all required fields are provided',
            'Check that preconditions are satisfied',
            'Verify the response structure',
          ],
          solution: {
            language: 'typescript',
            code: `// Example call to ${behavior.name.name}
const result = await client.${behavior.name.name.toLowerCase()}({
${behavior.input.fields.filter(f => !f.optional).map(f => `  ${f.name.name}: /* your value */,`).join('\n')}
});

// Check result
console.log(result);`,
          },
        },
      },
    ],
    outcomes: [
      `Know how to call ${behavior.name.name}`,
      'Understand the input requirements',
      'Handle all possible errors',
      'Verify postconditions',
    ],
  };
}

function generateInvariantsTutorial(domain: AST.Domain): Tutorial {
  return {
    id: 'invariants',
    title: 'Understanding Invariants',
    description: 'Learn about domain invariants and how they ensure data consistency',
    difficulty: 'advanced',
    estimatedTime: '30 minutes',
    prerequisites: ['getting-started'],
    steps: [
      {
        title: 'What are Invariants?',
        content: `Invariants are conditions that must always be true. They ensure data consistency and business rule compliance.

${domain.name.name} defines ${domain.invariants.length} domain-level invariants.`,
      },
      ...domain.invariants.map((inv, i) => ({
        title: inv.name.name,
        content: `${inv.description?.value ?? 'This invariant ensures data consistency.'}

**Scope:** ${inv.scope}

**Predicates:**
${inv.predicates.map(p => `- \`${expressionToString(p)}\``).join('\n')}`,
      } as TutorialStep)),
      {
        title: 'Entity-Level Invariants',
        content: `In addition to domain invariants, entities have their own invariants:

${domain.entities.filter(e => e.invariants.length > 0).map(e => `### ${e.name.name}
${e.invariants.map(i => `- \`${expressionToString(i)}\``).join('\n')}`).join('\n\n')}`,
      },
    ],
    outcomes: [
      'Understand what invariants are',
      'Know all domain-level invariants',
      'Understand how invariants are enforced',
    ],
  };
}

// ============================================================================
// PAGE GENERATION
// ============================================================================

function generateTutorialIndexPage(tutorials: Tutorial[], options: GeneratorOptions): string {
  const byDifficulty = {
    beginner: tutorials.filter(t => t.difficulty === 'beginner'),
    intermediate: tutorials.filter(t => t.difficulty === 'intermediate'),
    advanced: tutorials.filter(t => t.difficulty === 'advanced'),
  };

  return `---
title: Tutorials
description: Step-by-step guides to learn the domain
---

# Tutorials

Learn the domain step-by-step with our comprehensive tutorials.

## Beginner

${byDifficulty.beginner.map(t => `- [${t.title}](./${t.id}) - ${t.estimatedTime}`).join('\n')}

## Intermediate

${byDifficulty.intermediate.map(t => `- [${t.title}](./${t.id}) - ${t.estimatedTime}`).join('\n')}

## Advanced

${byDifficulty.advanced.map(t => `- [${t.title}](./${t.id}) - ${t.estimatedTime}`).join('\n')}
`;
}

function generateTutorialPage(tutorial: Tutorial, options: GeneratorOptions): string {
  return `---
title: "${tutorial.title}"
description: "${tutorial.description}"
---

# ${tutorial.title}

${tutorial.description}

<div className="flex gap-4 my-4">
  <span className="badge badge-${tutorial.difficulty}">${tutorial.difficulty}</span>
  <span className="text-muted">⏱ ${tutorial.estimatedTime}</span>
</div>

${tutorial.prerequisites.length > 0 ? `
## Prerequisites

Before starting this tutorial, complete:
${tutorial.prerequisites.map(p => `- [${p}](./${p})`).join('\n')}
` : ''}

## What You'll Learn

${tutorial.outcomes.map(o => `- ${o}`).join('\n')}

---

${tutorial.steps.map((step, i) => generateStepContent(step, i + 1, options)).join('\n\n---\n\n')}

---

## Summary

You've completed the ${tutorial.title} tutorial! You should now be able to:

${tutorial.outcomes.map(o => `✅ ${o}`).join('\n')}
`;
}

function generateStepContent(step: TutorialStep, stepNumber: number, options: GeneratorOptions): string {
  let content = `## Step ${stepNumber}: ${step.title}

${step.content}`;

  if (step.code) {
    content += `

\`\`\`${step.code.language}${step.code.filename ? ` title="${step.code.filename}"` : ''}${step.code.highlightLines ? ` {${step.code.highlightLines.join(',')}}` : ''}
${step.code.code}
\`\`\``;
  }

  if (step.exercise && options.interactive) {
    content += `

<Exercise>
  <ExercisePrompt>${step.exercise.prompt}</ExercisePrompt>
  
  <Hints>
${step.exercise.hints.map(h => `    - ${h}`).join('\n')}
  </Hints>
  
  <Solution>
\`\`\`${step.exercise.solution.language}
${step.exercise.solution.code}
\`\`\`
  </Solution>
</Exercise>`;
  }

  if (step.checkpoint) {
    content += `

<Checkpoint question="${step.checkpoint.question}">
${step.checkpoint.options.map((o, i) => `  <Option correct={${i === step.checkpoint!.correctAnswer}}>${o}</Option>`).join('\n')}
  <Explanation>${step.checkpoint.explanation}</Explanation>
</Checkpoint>`;
  }

  return content;
}

// ============================================================================
// HELPERS
// ============================================================================

function typeToTSType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'UUID': return 'string';
        case 'Timestamp': return 'Date';
        default: return 'unknown';
      }
    case 'ListType':
      return `${typeToTSType(type.element)}[]`;
    case 'OptionalType':
      return `${typeToTSType(type.inner)} | null`;
    case 'ReferenceType':
      return type.name.parts.map(p => p.name).join('.');
    default:
      return 'unknown';
  }
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
