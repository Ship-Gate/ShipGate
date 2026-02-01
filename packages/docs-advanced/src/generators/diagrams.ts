// ============================================================================
// Diagram Generators - Generate Mermaid/PlantUML diagrams
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import type { TransitionDoc, DiagramFormat } from '../types';
import { expressionToString } from '../utils/ast-helpers';

/**
 * Generate a sequence diagram for a behavior
 */
export function generateMermaidSequenceDiagram(behavior: AST.Behavior): string {
  const lines: string[] = ['sequenceDiagram'];
  
  // Add participants
  const participants = new Set<string>();
  participants.add('Client');
  participants.add('System');
  
  if (behavior.actors) {
    for (const actor of behavior.actors) {
      participants.add(actor.name.name);
    }
  }
  
  for (const p of participants) {
    lines.push(`    participant ${p}`);
  }
  
  lines.push('');
  
  // Input
  lines.push(`    Client->>System: ${behavior.name}(input)`);
  
  // Precondition checks
  if (behavior.preconditions.length > 0) {
    lines.push('    Note over System: Check preconditions');
    lines.push(`    alt Preconditions pass`);
  }
  
  // Main flow
  lines.push('    Note over System: Execute behavior');
  
  // Postconditions
  if (behavior.postconditions.length > 0) {
    lines.push('    Note over System: Verify postconditions');
  }
  
  // Success response
  lines.push(`    System-->>Client: Success(result)`);
  
  // Error flows
  if (behavior.preconditions.length > 0) {
    lines.push('    else Preconditions fail');
    lines.push(`    System-->>Client: Error(PRECONDITION_FAILED)`);
    lines.push('    end');
  }
  
  if (behavior.output.errors.length > 0) {
    lines.push('');
    lines.push('    Note right of System: Possible errors:');
    for (const error of behavior.output.errors.slice(0, 3)) {
      lines.push(`    Note right of System: ${error.name.name}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate a state diagram for entity lifecycle
 */
export function generateMermaidStateDiagram(
  states: string[],
  transitions: TransitionDoc[]
): string {
  const lines: string[] = ['stateDiagram-v2'];
  
  // Find initial state (state that has no incoming transitions but has outgoing)
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();
  
  for (const t of transitions) {
    hasIncoming.add(t.to);
    hasOutgoing.add(t.from);
  }
  
  const initialStates = states.filter(s => !hasIncoming.has(s) && hasOutgoing.has(s));
  const terminalStates = states.filter(s => !hasOutgoing.has(s) && hasIncoming.has(s));
  
  // Add initial transition
  if (initialStates.length > 0) {
    lines.push(`    [*] --> ${initialStates[0]}`);
  }
  
  // Add transitions
  for (const t of transitions) {
    lines.push(`    ${t.from} --> ${t.to}`);
  }
  
  // Add terminal transitions
  for (const t of terminalStates) {
    lines.push(`    ${t} --> [*]`);
  }
  
  return lines.join('\n');
}

/**
 * Generate a flow diagram for a behavior
 */
export function generateMermaidFlowDiagram(behavior: AST.Behavior): string {
  const lines: string[] = ['flowchart TD'];
  
  lines.push('    Start([Start])');
  lines.push('    Input[/"Receive Input"/]');
  lines.push('    Start --> Input');
  
  // Preconditions
  if (behavior.preconditions.length > 0) {
    lines.push('    PreCheck{Preconditions?}');
    lines.push('    Input --> PreCheck');
    lines.push('    PreCheck -->|Fail| PreError[/PRECONDITION_FAILED/]');
    lines.push('    PreError --> End([End])');
    lines.push('    PreCheck -->|Pass| Execute');
  } else {
    lines.push('    Input --> Execute');
  }
  
  lines.push('    Execute[Execute Behavior]');
  
  // Error handling
  if (behavior.output.errors.length > 0) {
    lines.push('    ExecCheck{Success?}');
    lines.push('    Execute --> ExecCheck');
    lines.push('    ExecCheck -->|Yes| PostCheck');
    lines.push('    ExecCheck -->|No| Error[/Return Error/]');
    lines.push('    Error --> End');
  } else {
    lines.push('    Execute --> PostCheck');
  }
  
  // Postconditions
  if (behavior.postconditions.length > 0) {
    lines.push('    PostCheck{Postconditions?}');
    lines.push('    PostCheck -->|Pass| Success');
    lines.push('    PostCheck -->|Fail| PostError[/POSTCONDITION_FAILED/]');
    lines.push('    PostError --> End');
  } else {
    lines.push('    PostCheck[Verify Result]');
    lines.push('    PostCheck --> Success');
  }
  
  lines.push('    Success[/Return Result/]');
  lines.push('    Success --> End');
  
  return lines.join('\n');
}

/**
 * Generate an entity relationship diagram
 */
export function generateMermaidERDiagram(domain: AST.Domain): string {
  const lines: string[] = ['erDiagram'];
  
  for (const entity of domain.entities) {
    // Entity with fields
    lines.push(`    ${entity.name.name} {`);
    for (const field of entity.fields) {
      const type = simplifyType(field.type);
      const pk = field.annotations.some(a => a.name.name === 'unique') ? 'PK' : '';
      const fk = field.annotations.some(a => a.name.name === 'references') ? 'FK' : '';
      lines.push(`        ${type} ${field.name.name} ${pk}${fk}`);
    }
    lines.push('    }');
  }
  
  // Add relationships based on reference types
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const ref = extractReference(field);
      if (ref) {
        lines.push(`    ${entity.name.name} }o--|| ${ref} : "${field.name.name}"`);
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate a domain overview diagram
 */
export function generateMermaidDomainOverview(domain: AST.Domain): string {
  const lines: string[] = ['graph TB'];
  
  // Subgraph for entities
  lines.push('    subgraph Entities');
  for (const entity of domain.entities) {
    lines.push(`        E_${entity.name.name}[${entity.name.name}]`);
  }
  lines.push('    end');
  
  // Subgraph for behaviors
  lines.push('    subgraph Behaviors');
  for (const behavior of domain.behaviors) {
    lines.push(`        B_${behavior.name.name}((${behavior.name.name}))`);
  }
  lines.push('    end');
  
  // Connect behaviors to entities they affect
  for (const behavior of domain.behaviors) {
    const affectedEntities = findAffectedEntities(behavior, domain);
    for (const entity of affectedEntities) {
      lines.push(`    B_${behavior.name.name} --> E_${entity}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Convert diagram to PlantUML format
 */
export function mermaidToPlantUML(mermaid: string, type: 'sequence' | 'state' | 'flow'): string {
  // Basic conversion - would need more sophisticated parsing for production
  const lines = mermaid.split('\n');
  const plantUMLLines: string[] = ['@startuml'];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (type === 'sequence') {
      if (trimmed.includes('->>')) {
        const [from, rest] = trimmed.split('->>');
        const [to, message] = rest?.split(':') ?? ['', ''];
        plantUMLLines.push(`${from?.trim()} -> ${to?.trim()} : ${message?.trim()}`);
      } else if (trimmed.includes('-->>')) {
        const [from, rest] = trimmed.split('-->>');
        const [to, message] = rest?.split(':') ?? ['', ''];
        plantUMLLines.push(`${from?.trim()} --> ${to?.trim()} : ${message?.trim()}`);
      } else if (trimmed.startsWith('participant')) {
        plantUMLLines.push(trimmed);
      } else if (trimmed.startsWith('Note')) {
        plantUMLLines.push(trimmed.replace('Note over', 'note over').replace('Note right of', 'note right of'));
      }
    }
  }
  
  plantUMLLines.push('@enduml');
  return plantUMLLines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function simplifyType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name.toLowerCase();
    case 'ReferenceType':
      return type.name.parts.map(p => p.name).join('.');
    case 'ListType':
      return `list_${simplifyType(type.element)}`;
    case 'OptionalType':
      return simplifyType(type.inner);
    default:
      return 'unknown';
  }
}

function extractReference(field: AST.Field): string | null {
  const refAnnotation = field.annotations.find(a => a.name.name === 'references');
  if (refAnnotation?.value && refAnnotation.value.kind === 'QualifiedName') {
    return refAnnotation.value.parts[0]?.name ?? null;
  }
  return null;
}

function findAffectedEntities(behavior: AST.Behavior, domain: AST.Domain): string[] {
  const entities = new Set<string>();
  
  // Check postconditions for entity references
  for (const block of behavior.postconditions) {
    for (const predicate of block.predicates) {
      const exprStr = expressionToString(predicate);
      for (const entity of domain.entities) {
        if (exprStr.includes(entity.name.name)) {
          entities.add(entity.name.name);
        }
      }
    }
  }
  
  return Array.from(entities);
}
