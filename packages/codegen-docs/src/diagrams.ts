// ============================================================================
// Mermaid Diagram Generator
// Generates state diagrams, flow charts, and entity relationships
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TYPES
// ============================================================================

export interface MermaidDiagram {
  name: string;
  type: 'stateDiagram' | 'flowchart' | 'erDiagram' | 'sequenceDiagram';
  content: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate all Mermaid diagrams for a domain
 */
export function generateMermaidDiagrams(domain: AST.Domain): MermaidDiagram[] {
  const diagrams: MermaidDiagram[] = [];

  // Generate entity lifecycle diagrams
  for (const entity of domain.entities) {
    if (entity.lifecycle && entity.lifecycle.transitions.length > 0) {
      diagrams.push(generateLifecycleDiagram(entity));
    }
  }

  // Generate entity relationship diagram
  if (domain.entities.length > 0) {
    diagrams.push(generateERDiagram(domain));
  }

  // Generate behavior flow diagrams
  for (const behavior of domain.behaviors) {
    diagrams.push(generateBehaviorFlowDiagram(behavior));
  }

  // Generate domain overview diagram
  diagrams.push(generateDomainOverview(domain));

  return diagrams;
}

// ============================================================================
// LIFECYCLE DIAGRAMS
// ============================================================================

/**
 * Generate a state diagram for entity lifecycle
 */
export function generateLifecycleDiagram(entity: AST.Entity): MermaidDiagram {
  const lines: string[] = [];
  const name = entity.name.name;

  lines.push('```mermaid');
  lines.push('stateDiagram-v2');
  
  if (!entity.lifecycle) {
    lines.push('    [*] --> Active');
    lines.push('```');
    return {
      name: `${name}Lifecycle`,
      type: 'stateDiagram',
      content: lines.join('\n'),
    };
  }

  // Collect all states
  const fromStates = new Set<string>();
  const toStates = new Set<string>();
  
  for (const transition of entity.lifecycle.transitions) {
    fromStates.add(transition.from.name);
    toStates.add(transition.to.name);
  }

  // Find initial states (only appear in 'from', or first state in 'from' that's not in 'to')
  const allStates = new Set([...fromStates, ...toStates]);
  const onlyFromStates = [...fromStates].filter(s => !toStates.has(s));
  const initialState = onlyFromStates.length > 0 
    ? onlyFromStates[0] 
    : entity.lifecycle.transitions[0]?.from.name;

  if (initialState) {
    lines.push(`    [*] --> ${initialState}`);
  }

  // Add transitions with styling
  for (const transition of entity.lifecycle.transitions) {
    lines.push(`    ${transition.from.name} --> ${transition.to.name}`);
  }

  // Find terminal states (only appear in 'to')
  const terminalStates = [...toStates].filter(s => !fromStates.has(s));
  for (const terminal of terminalStates) {
    lines.push(`    ${terminal} --> [*]`);
  }

  // Add state descriptions/styling for special states
  for (const state of allStates) {
    const stateLower = state.toLowerCase();
    if (stateLower.includes('deleted') || stateLower.includes('cancelled') || stateLower.includes('failed')) {
      lines.push(`    ${state} : Terminal state`);
    } else if (stateLower.includes('pending') || stateLower.includes('draft')) {
      lines.push(`    ${state} : Initial state`);
    }
  }

  lines.push('```');

  return {
    name: `${name}Lifecycle`,
    type: 'stateDiagram',
    content: lines.join('\n'),
  };
}

// ============================================================================
// ENTITY RELATIONSHIP DIAGRAMS
// ============================================================================

/**
 * Generate an entity relationship diagram for the domain
 */
export function generateERDiagram(domain: AST.Domain): MermaidDiagram {
  const lines: string[] = [];

  lines.push('```mermaid');
  lines.push('erDiagram');

  // Collect entity relationships
  const relationships: Array<{
    from: string;
    to: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
    label?: string;
  }> = [];

  for (const entity of domain.entities) {
    // Add entity with its fields
    lines.push(`    ${entity.name.name} {`);
    
    for (const field of entity.fields) {
      const fieldType = getSimpleTypeName(field.type);
      const pk = field.annotations.some(a => a.name.name === 'unique' || a.name.name === 'immutable') ? 'PK' : '';
      const fk = isReference(field.type) ? 'FK' : '';
      const marker = pk || fk || '';
      lines.push(`        ${fieldType} ${field.name.name}${marker ? ' ' + marker : ''}`);

      // Check for references
      if (field.type.kind === 'ReferenceType') {
        const refName = field.type.name.parts[0].name;
        if (domain.entities.some(e => e.name.name === refName)) {
          relationships.push({
            from: entity.name.name,
            to: refName,
            type: 'many-to-one',
            label: field.name.name,
          });
        }
      }

      // Check for List of references
      if (field.type.kind === 'ListType' && field.type.element.kind === 'ReferenceType') {
        const refName = field.type.element.name.parts[0].name;
        if (domain.entities.some(e => e.name.name === refName)) {
          relationships.push({
            from: entity.name.name,
            to: refName,
            type: 'one-to-many',
            label: field.name.name,
          });
        }
      }
    }
    
    lines.push('    }');
  }

  // Add relationships
  for (const rel of relationships) {
    const relSymbol = getRelationshipSymbol(rel.type);
    const label = rel.label ? ` : ${rel.label}` : '';
    lines.push(`    ${rel.from} ${relSymbol} ${rel.to}${label}`);
  }

  lines.push('```');

  return {
    name: 'EntityRelationships',
    type: 'erDiagram',
    content: lines.join('\n'),
  };
}

function getRelationshipSymbol(type: string): string {
  switch (type) {
    case 'one-to-one':
      return '||--||';
    case 'one-to-many':
      return '||--o{';
    case 'many-to-one':
      return '}o--||';
    case 'many-to-many':
      return '}o--o{';
    default:
      return '||--||';
  }
}

function isReference(type: AST.TypeDefinition): boolean {
  if (type.kind === 'ReferenceType') return true;
  if (type.kind === 'OptionalType') return isReference(type.inner);
  return false;
}

// ============================================================================
// BEHAVIOR FLOW DIAGRAMS
// ============================================================================

/**
 * Generate a flowchart for a behavior
 */
export function generateBehaviorFlowDiagram(behavior: AST.Behavior): MermaidDiagram {
  const lines: string[] = [];
  const name = behavior.name.name;

  lines.push('```mermaid');
  lines.push('flowchart TD');

  // Start node
  lines.push(`    Start([${name}]) --> ValidateInput`);

  // Validation
  lines.push('    ValidateInput{Validate Input}');
  
  // Preconditions
  if (behavior.preconditions.length > 0) {
    lines.push('    ValidateInput -->|Valid| CheckPreconditions');
    lines.push('    ValidateInput -->|Invalid| ValidationError[Return Validation Error]');
    lines.push('    CheckPreconditions{Check Preconditions}');
    lines.push('    CheckPreconditions -->|Pass| Execute');
    lines.push('    CheckPreconditions -->|Fail| PreconditionError[Return Precondition Error]');
  } else {
    lines.push('    ValidateInput -->|Valid| Execute');
    lines.push('    ValidateInput -->|Invalid| ValidationError[Return Validation Error]');
  }

  // Execution
  lines.push('    Execute[Execute Operation]');
  lines.push('    Execute -->|Success| CheckPostconditions');
  
  // Error paths
  if (behavior.output.errors.length > 0) {
    lines.push('    Execute -->|Error| HandleError{Error Type}');
    for (const error of behavior.output.errors) {
      const errorName = error.name.name;
      const retriable = error.retriable ? '🔄' : '❌';
      lines.push(`    HandleError -->|${errorName}| ${errorName}Error[${retriable} ${errorName}]`);
    }
  } else {
    lines.push('    Execute -->|Error| GenericError[Return Error]');
  }

  // Postconditions
  lines.push('    CheckPostconditions{Verify Postconditions}');
  lines.push('    CheckPostconditions -->|Pass| Success[Return Success]');
  lines.push('    CheckPostconditions -->|Fail| PostconditionError[Internal Error]');

  // Style terminal nodes
  lines.push('    Success:::successStyle');
  lines.push('    ValidationError:::errorStyle');
  if (behavior.preconditions.length > 0) {
    lines.push('    PreconditionError:::errorStyle');
  }
  lines.push('    PostconditionError:::errorStyle');
  
  for (const error of behavior.output.errors) {
    lines.push(`    ${error.name.name}Error:::errorStyle`);
  }

  // Style definitions
  lines.push('    classDef successStyle fill:#90EE90,stroke:#228B22');
  lines.push('    classDef errorStyle fill:#FFB6C1,stroke:#DC143C');

  lines.push('```');

  return {
    name: `${name}Flow`,
    type: 'flowchart',
    content: lines.join('\n'),
  };
}

// ============================================================================
// DOMAIN OVERVIEW
// ============================================================================

/**
 * Generate an overview diagram of the entire domain
 */
export function generateDomainOverview(domain: AST.Domain): MermaidDiagram {
  const lines: string[] = [];
  const name = domain.name.name;

  lines.push('```mermaid');
  lines.push('flowchart TB');
  
  // Domain as main container
  lines.push(`    subgraph ${name}["📦 ${name} Domain v${domain.version.value}"]`);
  
  // Types subgraph
  if (domain.types.length > 0) {
    lines.push('        subgraph Types["📐 Types"]');
    for (const type of domain.types) {
      lines.push(`            T_${type.name.name}["${type.name.name}"]`);
    }
    lines.push('        end');
  }

  // Entities subgraph
  if (domain.entities.length > 0) {
    lines.push('        subgraph Entities["📋 Entities"]');
    for (const entity of domain.entities) {
      const hasLifecycle = entity.lifecycle ? '🔄' : '';
      lines.push(`            E_${entity.name.name}["${hasLifecycle} ${entity.name.name}"]`);
    }
    lines.push('        end');
  }

  // Behaviors subgraph
  if (domain.behaviors.length > 0) {
    lines.push('        subgraph Behaviors["⚡ Behaviors"]');
    for (const behavior of domain.behaviors) {
      lines.push(`            B_${behavior.name.name}["${behavior.name.name}"]`);
    }
    lines.push('        end');
  }

  // Views subgraph
  if (domain.views.length > 0) {
    lines.push('        subgraph Views["👁 Views"]');
    for (const view of domain.views) {
      lines.push(`            V_${view.name.name}["${view.name.name}"]`);
    }
    lines.push('        end');
  }

  lines.push('    end');

  // Add connections between behaviors and entities
  for (const behavior of domain.behaviors) {
    const outputType = getSimpleTypeName(behavior.output.success);
    if (domain.entities.some(e => e.name.name === outputType)) {
      lines.push(`    B_${behavior.name.name} -.->|returns| E_${outputType}`);
    }
  }

  // Add connections between views and entities
  for (const view of domain.views) {
    const entityName = view.forEntity.name.parts[view.forEntity.name.parts.length - 1].name;
    if (domain.entities.some(e => e.name.name === entityName)) {
      lines.push(`    V_${view.name.name} -.->|for| E_${entityName}`);
    }
  }

  lines.push('```');

  return {
    name: 'DomainOverview',
    type: 'flowchart',
    content: lines.join('\n'),
  };
}

// ============================================================================
// SEQUENCE DIAGRAMS FOR BEHAVIORS
// ============================================================================

/**
 * Generate a sequence diagram showing behavior execution
 */
export function generateSequenceDiagram(behavior: AST.Behavior): MermaidDiagram {
  const lines: string[] = [];
  const name = behavior.name.name;

  lines.push('```mermaid');
  lines.push('sequenceDiagram');
  
  // Participants
  const actor = behavior.actors?.[0]?.name.name ?? 'Client';
  lines.push(`    participant ${actor}`);
  lines.push(`    participant API as ${name} API`);
  lines.push('    participant DB as Database');

  // Request
  lines.push(`    ${actor}->>+API: ${name} Request`);
  
  // Validation
  lines.push('    API->>API: Validate Input');

  // Preconditions (often involve DB)
  if (behavior.preconditions.length > 0) {
    lines.push('    API->>+DB: Check Preconditions');
    lines.push('    DB-->>-API: Precondition Results');
  }

  // Execute
  lines.push('    API->>+DB: Execute Operation');
  lines.push('    DB-->>-API: Operation Result');

  // Response paths
  lines.push('    alt Success');
  lines.push(`    API-->>-${actor}: Success Response`);
  
  if (behavior.output.errors.length > 0) {
    for (const error of behavior.output.errors) {
      lines.push(`    else ${error.name.name}`);
      lines.push(`    API-->>-${actor}: ${error.name.name} Error`);
    }
  }
  
  lines.push('    end');

  lines.push('```');

  return {
    name: `${name}Sequence`,
    type: 'sequenceDiagram',
    content: lines.join('\n'),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getSimpleTypeName(def: AST.TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      return def.name;
    case 'ReferenceType':
      return def.name.parts[def.name.parts.length - 1].name;
    case 'ListType':
      return `List_${getSimpleTypeName(def.element)}`;
    case 'MapType':
      return 'Map';
    case 'OptionalType':
      return getSimpleTypeName(def.inner);
    case 'ConstrainedType':
      return getSimpleTypeName(def.base);
    case 'EnumType':
      return 'Enum';
    case 'StructType':
      return 'Struct';
    case 'UnionType':
      return 'Union';
    default:
      return 'Unknown';
  }
}
