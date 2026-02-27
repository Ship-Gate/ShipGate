// ============================================================================
// ISL Parser (Simple)
// ============================================================================

export class ISLParser {
  parse(code: string): ParsedISL {
    const result: ParsedISL = {
      domain: null,
      types: [],
      entities: [],
      behaviors: [],
    };

    const lines = code.split('\n');
    let currentBlock = '';
    let currentName = '';
    let blockContent: string[] = [];
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//')) continue;

      // Track braces
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;

      // Domain
      const domainMatch = trimmed.match(/^domain\s+(\w+)\s*\{?$/);
      if (domainMatch) {
        result.domain = { name: domainMatch[1] };
        braceDepth += opens;
        continue;
      }

      // Version
      const versionMatch = trimmed.match(/version:\s*"([^"]+)"/);
      if (versionMatch && result.domain) {
        result.domain.version = versionMatch[1];
        continue;
      }

      // Entity start
      const entityMatch = trimmed.match(/^entity\s+(\w+)\s*\{$/);
      if (entityMatch) {
        currentBlock = 'entity';
        currentName = entityMatch[1];
        blockContent = [];
        braceDepth += opens;
        continue;
      }

      // Behavior start
      const behaviorMatch = trimmed.match(/^behavior\s+(\w+)\s*\{$/);
      if (behaviorMatch) {
        currentBlock = 'behavior';
        currentName = behaviorMatch[1];
        blockContent = [];
        braceDepth += opens;
        continue;
      }

      // Type
      const typeMatch = trimmed.match(/^type\s+(\w+)\s*=\s*(.+)$/);
      if (typeMatch) {
        result.types.push({
          name: typeMatch[1],
          baseType: typeMatch[2].split('{')[0].trim(),
        });
        continue;
      }

      // Collect block content
      if (currentBlock) {
        blockContent.push(trimmed);
      }

      // Block end
      if (trimmed === '}') {
        braceDepth -= 1;
        if (braceDepth === 1 && currentBlock) {
          if (currentBlock === 'entity') {
            result.entities.push(this.parseEntity(currentName, blockContent));
          } else if (currentBlock === 'behavior') {
            result.behaviors.push(this.parseBehavior(currentName, blockContent));
          }
          currentBlock = '';
          currentName = '';
          blockContent = [];
        }
      }

      braceDepth += opens - closes;
    }

    return result;
  }

  private parseEntity(name: string, content: string[]): ParsedEntity {
    const fields: ParsedField[] = [];

    for (const line of content) {
      const fieldMatch = line.match(/^(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\s*(\?)?/);
      if (fieldMatch && !['invariant', 'lifecycle'].includes(fieldMatch[1])) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
          optional: !!fieldMatch[3],
        });
      }
    }

    return { name, fields };
  }

  private parseBehavior(name: string, content: string[]): ParsedBehavior {
    const inputs: ParsedField[] = [];
    let outputType = 'void';

    let section = '';
    for (const line of content) {
      if (line === 'input {') { section = 'input'; continue; }
      if (line === 'output {') { section = 'output'; continue; }
      if (line === '}') { section = ''; continue; }

      if (section === 'input') {
        const fieldMatch = line.match(/^(\w+)\s*:\s*(\w+(?:<[^>]+>)?)\s*(\?)?/);
        if (fieldMatch) {
          inputs.push({
            name: fieldMatch[1],
            type: fieldMatch[2],
            optional: !!fieldMatch[3],
          });
        }
      }

      if (section === 'output') {
        const successMatch = line.match(/success:\s*(\w+)/);
        if (successMatch) {
          outputType = successMatch[1];
        }
      }
    }

    return { name, inputs, outputType };
  }
}

// Types
export interface ParsedISL {
  domain: { name: string; version?: string } | null;
  types: ParsedType[];
  entities: ParsedEntity[];
  behaviors: ParsedBehavior[];
}

export interface ParsedType {
  name: string;
  baseType: string;
}

export interface ParsedEntity {
  name: string;
  fields: ParsedField[];
}

export interface ParsedBehavior {
  name: string;
  inputs: ParsedField[];
  outputType: string;
}

export interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
}
