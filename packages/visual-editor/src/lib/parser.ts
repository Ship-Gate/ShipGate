// ============================================================================
// ISL → Visual Parser
// ============================================================================

import type { ISLNode, ISLEdge, ParseResult, EntityNodeData, BehaviorNodeData, TypeNodeData } from '@/types';

let nodeIdCounter = 0;
const generateId = () => `node_${++nodeIdCounter}`;

export function parseISL(code: string): ParseResult {
  try {
    const lines = code.split('\n');
    const nodes: ISLNode[] = [];
    const edges: ISLEdge[] = [];
    let domainName = 'Domain';
    let domainVersion = '1.0.0';
    
    let currentBlock: string | null = null;
    let currentBlockName = '';
    let blockContent: string[] = [];
    let braceCount = 0;
    let position = { x: 100, y: 100 };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Domain declaration
      const domainMatch = trimmed.match(/^domain\s+(\w+)\s*\{?$/);
      if (domainMatch) {
        domainName = domainMatch[1];
        braceCount++;
        continue;
      }
      
      // Version
      const versionMatch = trimmed.match(/version:\s*"([^"]+)"/);
      if (versionMatch) {
        domainVersion = versionMatch[1];
        continue;
      }
      
      // Entity declaration
      const entityMatch = trimmed.match(/^entity\s+(\w+)\s*\{$/);
      if (entityMatch) {
        currentBlock = 'entity';
        currentBlockName = entityMatch[1];
        blockContent = [];
        braceCount++;
        continue;
      }
      
      // Behavior declaration
      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)\s*\{$/);
      if (behaviorMatch) {
        currentBlock = 'behavior';
        currentBlockName = behaviorMatch[1];
        blockContent = [];
        braceCount++;
        continue;
      }
      
      // Type declaration
      const typeMatch = trimmed.match(/^type\s+(\w+)\s*=\s*(.+)$/);
      if (typeMatch) {
        const node = createTypeNode(typeMatch[1], typeMatch[2], position);
        nodes.push(node);
        position = { x: position.x + 250, y: position.y };
        continue;
      }
      
      // Track braces
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      // Collect block content
      if (currentBlock && braceCount > 1) {
        blockContent.push(trimmed);
      }
      
      // End of block
      if (currentBlock && braceCount === 1 && trimmed === '}') {
        if (currentBlock === 'entity') {
          const node = createEntityNode(currentBlockName, blockContent, position);
          nodes.push(node);
          position = { x: position.x, y: position.y + 200 };
        } else if (currentBlock === 'behavior') {
          const node = createBehaviorNode(currentBlockName, blockContent, position);
          nodes.push(node);
          position = { x: position.x + 300, y: position.y };
        }
        currentBlock = null;
        currentBlockName = '';
        blockContent = [];
      }
    }
    
    return {
      success: true,
      nodes,
      edges,
      domainName,
      domainVersion,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Parse error'],
    };
  }
}

function createEntityNode(name: string, content: string[], position: { x: number; y: number }): ISLNode {
  const fields: EntityNodeData['fields'] = [];
  const invariants: string[] = [];
  let inInvariant = false;
  
  for (const line of content) {
    if (line.startsWith('invariant')) {
      inInvariant = true;
      continue;
    }
    if (inInvariant && line === '}') {
      inInvariant = false;
      continue;
    }
    
    if (inInvariant) {
      invariants.push(line);
    } else if (line.includes(':')) {
      const fieldMatch = line.match(/(\w+):\s*(\w+)(\?)?/);
      if (fieldMatch) {
        fields.push({
          id: `f${Date.now()}_${Math.random()}`,
          name: fieldMatch[1],
          type: fieldMatch[2],
          optional: !!fieldMatch[3],
          annotations: extractAnnotations(line),
        });
      }
    }
  }
  
  return {
    id: generateId(),
    type: 'entityNode',
    position,
    data: {
      type: 'entity',
      name,
      fields,
      invariants,
    },
  };
}

function createBehaviorNode(name: string, content: string[], position: { x: number; y: number }): ISLNode {
  const inputs: BehaviorNodeData['inputs'] = [];
  const preconditions: string[] = [];
  const postconditions: string[] = [];
  let outputType = 'Boolean';
  const errors: string[] = [];
  let description = '';
  
  let currentSection = '';
  
  for (const line of content) {
    if (line.startsWith('description:')) {
      const match = line.match(/description:\s*"([^"]+)"/);
      if (match) description = match[1];
      continue;
    }
    
    if (line === 'input {') {
      currentSection = 'input';
      continue;
    }
    if (line === 'output {') {
      currentSection = 'output';
      continue;
    }
    if (line === 'pre {') {
      currentSection = 'pre';
      continue;
    }
    if (line === 'post {') {
      currentSection = 'post';
      continue;
    }
    if (line === '}') {
      currentSection = '';
      continue;
    }
    
    if (currentSection === 'input' && line.includes(':')) {
      const match = line.match(/(\w+):\s*(\w+)(\?)?/);
      if (match) {
        inputs.push({
          id: `i${Date.now()}_${Math.random()}`,
          name: match[1],
          type: match[2],
          optional: !!match[3],
          annotations: [],
        });
      }
    }
    
    if (currentSection === 'output') {
      const successMatch = line.match(/success:\s*(\w+)/);
      if (successMatch) outputType = successMatch[1];
      
      const errorMatch = line.match(/error\s+(\w+)/);
      if (errorMatch) errors.push(errorMatch[1]);
    }
    
    if (currentSection === 'pre') {
      preconditions.push(line);
    }
    
    if (currentSection === 'post') {
      postconditions.push(line);
    }
  }
  
  return {
    id: generateId(),
    type: 'behaviorNode',
    position,
    data: {
      type: 'behavior',
      name,
      description,
      inputs,
      outputType,
      errors,
      preconditions,
      postconditions,
    },
  };
}

function createTypeNode(name: string, definition: string, position: { x: number; y: number }): ISLNode {
  const baseType = definition.split('{')[0].trim();
  const constraints: string[] = [];
  
  if (definition.includes('{')) {
    const constraintPart = definition.match(/\{([^}]+)\}/);
    if (constraintPart) {
      constraints.push(...constraintPart[1].split(',').map(c => c.trim()));
    }
  }
  
  return {
    id: generateId(),
    type: 'typeNode',
    position,
    data: {
      type: 'type',
      name,
      definition: baseType,
      constraints,
    },
  };
}

function extractAnnotations(line: string): string[] {
  const annotations: string[] = [];
  const matches = line.matchAll(/@(\w+)/g);
  for (const match of matches) {
    annotations.push(`@${match[1]}`);
  }
  return annotations;
}
