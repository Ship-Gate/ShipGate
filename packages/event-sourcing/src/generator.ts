/**
 * Event Sourcing Generator
 *
 * Generate event sourcing code from ISL specifications.
 */

export interface EventGeneratorOptions {
  /** Output language */
  language?: 'typescript' | 'javascript';
  /** Include command handlers */
  includeCommands?: boolean;
  /** Include projections */
  includeProjections?: boolean;
}

interface ParsedDomain {
  name: string;
  entities: ParsedEntity[];
  behaviors: ParsedBehavior[];
}

interface ParsedEntity {
  name: string;
  fields: ParsedField[];
}

interface ParsedBehavior {
  name: string;
  description: string;
  input: ParsedField[];
  output: { success: string };
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
}

export class EventGenerator {
  private options: Required<EventGeneratorOptions>;

  constructor(options: EventGeneratorOptions = {}) {
    this.options = {
      language: options.language ?? 'typescript',
      includeCommands: options.includeCommands ?? true,
      includeProjections: options.includeProjections ?? true,
    };
  }

  /**
   * Generate event sourcing code from ISL
   */
  generate(islContent: string): string {
    const domain = this.parseISL(islContent);
    const parts: string[] = [];

    parts.push(this.generateImports());
    parts.push(this.generateEventTypes(domain));

    for (const entity of domain.entities) {
      parts.push(this.generateAggregate(entity));
    }

    if (this.options.includeCommands) {
      parts.push(this.generateCommands(domain));
    }

    if (this.options.includeProjections) {
      parts.push(this.generateProjections(domain));
    }

    return parts.filter(Boolean).join('\n\n');
  }

  private generateImports(): string {
    return `import { EventStore, Aggregate, Projection, CommandBus } from '@intentos/event-sourcing';`;
  }

  private generateEventTypes(domain: ParsedDomain): string {
    const events: string[] = [];

    for (const entity of domain.entities) {
      events.push(`
export interface ${entity.name}CreatedEvent {
  id: string;
  timestamp: string;
}

export interface ${entity.name}UpdatedEvent {
  id: string;
  timestamp: string;
}

export interface ${entity.name}DeletedEvent {
  id: string;
  timestamp: string;
}`);
    }

    return events.join('\n');
  }

  private generateAggregate(entity: ParsedEntity): string {
    return `
export interface ${entity.name}State {
  id: string;
  version: number;
  deleted: boolean;
}

export class ${entity.name}Aggregate extends Aggregate<${entity.name}State> {
  constructor(id: string, eventStore: EventStore) {
    super(id, { eventStore, aggregateType: '${entity.name}' }, {
      id,
      version: 0,
      deleted: false,
    });
  }
}`;
  }

  private generateCommands(domain: ParsedDomain): string {
    return `
// Command handlers for ${domain.name}
export function setupCommandHandlers(commandBus: CommandBus, eventStore: EventStore): void {
  // TODO: Register command handlers
}`;
  }

  private generateProjections(domain: ParsedDomain): string {
    return `
// Projections for ${domain.name}
export function setupProjections(eventStore: EventStore): void {
  // TODO: Setup projections
}`;
  }

  private parseISL(content: string): ParsedDomain {
    const domain: ParsedDomain = { name: '', entities: [], behaviors: [] };

    const domainMatch = content.match(/domain\s+(\w+)\s*\{/);
    if (domainMatch) domain.name = domainMatch[1];

    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = entityRegex.exec(content)) !== null) {
      domain.entities.push({ name: match[1], fields: this.parseFields(match[2]) });
    }

    return domain;
  }

  private parseFields(body: string): ParsedField[] {
    const fields: ParsedField[] = [];
    const fieldRegex = /(\w+)\s*:\s*(\w+)(\?)?/g;
    let match;
    while ((match = fieldRegex.exec(body)) !== null) {
      fields.push({ name: match[1], type: match[2], optional: match[3] === '?' });
    }
    return fields;
  }
}

export function generateEventSourcing(
  islContent: string,
  options?: EventGeneratorOptions
): string {
  const generator = new EventGenerator(options);
  return generator.generate(islContent);
}
