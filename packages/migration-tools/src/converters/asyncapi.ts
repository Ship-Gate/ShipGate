/**
 * AsyncAPI to ISL Converter
 * 
 * Convert AsyncAPI specifications to ISL format with event-driven patterns.
 */

export interface AsyncAPISpec {
  asyncapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Record<string, AsyncAPIServer>;
  channels: Record<string, AsyncAPIChannel>;
  components?: {
    schemas?: Record<string, AsyncAPISchema>;
    messages?: Record<string, AsyncAPIMessage>;
  };
}

export interface AsyncAPIServer {
  url: string;
  protocol: string;
  description?: string;
}

export interface AsyncAPIChannel {
  description?: string;
  subscribe?: AsyncAPIOperation;
  publish?: AsyncAPIOperation;
  parameters?: Record<string, AsyncAPIParameter>;
}

export interface AsyncAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  message: AsyncAPIMessage | { oneOf: AsyncAPIMessage[] };
}

export interface AsyncAPIMessage {
  name?: string;
  title?: string;
  description?: string;
  contentType?: string;
  payload: AsyncAPISchema;
  headers?: AsyncAPISchema;
  $ref?: string;
}

export interface AsyncAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, AsyncAPISchema>;
  required?: string[];
  items?: AsyncAPISchema;
  enum?: string[];
  $ref?: string;
  description?: string;
}

export interface AsyncAPIParameter {
  description?: string;
  schema: AsyncAPISchema;
}

export interface AsyncAPIConversionOptions {
  /** Domain name */
  domainName?: string;
  /** Generate event entities */
  generateEventEntities?: boolean;
  /** Include temporal annotations */
  includeTemporalAnnotations?: boolean;
  /** Generate channel behaviors */
  generateChannelBehaviors?: boolean;
}

interface ISLEntity {
  name: string;
  description?: string;
  fields: ISLField[];
}

interface ISLBehavior {
  name: string;
  description?: string;
  input?: ISLField[];
  output?: { success: string };
  temporal?: string[];
  preconditions?: string[];
}

interface ISLEnum {
  name: string;
  variants: string[];
}

interface ISLField {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface ISLDomain {
  name: string;
  description?: string;
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  types: Array<{ name: string; baseType: string }>;
  enums: ISLEnum[];
}

/**
 * AsyncAPI to ISL Converter
 */
export class AsyncAPIConverter {
  private options: Required<AsyncAPIConversionOptions>;
  private schemas = new Map<string, AsyncAPISchema>();
  private messages = new Map<string, AsyncAPIMessage>();

  constructor(options: AsyncAPIConversionOptions = {}) {
    this.options = {
      domainName: options.domainName ?? 'Events',
      generateEventEntities: options.generateEventEntities ?? true,
      includeTemporalAnnotations: options.includeTemporalAnnotations ?? true,
      generateChannelBehaviors: options.generateChannelBehaviors ?? true,
    };
  }

  /**
   * Convert AsyncAPI spec to ISL domain
   */
  convert(spec: AsyncAPISpec): ISLDomain {
    // Reset state
    this.schemas.clear();
    this.messages.clear();

    // Collect schemas and messages
    if (spec.components?.schemas) {
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        this.schemas.set(name, schema);
      }
    }

    if (spec.components?.messages) {
      for (const [name, message] of Object.entries(spec.components.messages)) {
        this.messages.set(name, message);
      }
    }

    const entities: ISLEntity[] = [];
    const behaviors: ISLBehavior[] = [];
    const enums: ISLEnum[] = [];

    // Convert schemas to entities
    for (const [name, schema] of this.schemas) {
      if (schema.enum) {
        enums.push(this.convertToEnum(name, schema));
      } else if (schema.type === 'object' || schema.properties) {
        entities.push(this.convertSchemaToEntity(name, schema));
      }
    }

    // Convert messages to event entities
    if (this.options.generateEventEntities) {
      for (const [name, message] of this.messages) {
        entities.push(this.convertMessageToEntity(name, message));
      }
    }

    // Convert channels to behaviors
    if (this.options.generateChannelBehaviors) {
      for (const [channelName, channel] of Object.entries(spec.channels)) {
        const channelBehaviors = this.convertChannelToBehaviors(channelName, channel);
        behaviors.push(...channelBehaviors);
      }
    }

    return {
      name: this.options.domainName,
      description: spec.info.description,
      entities,
      behaviors,
      types: [],
      enums,
    };
  }

  /**
   * Convert schema to entity
   */
  private convertSchemaToEntity(name: string, schema: AsyncAPISchema): ISLEntity {
    const fields: ISLField[] = [];

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        fields.push({
          name: propName,
          type: this.mapSchemaToType(propSchema),
          optional: !schema.required?.includes(propName),
          description: propSchema.description,
        });
      }
    }

    return {
      name: this.toPascalCase(name),
      description: schema.description,
      fields,
    };
  }

  /**
   * Convert message to event entity
   */
  private convertMessageToEntity(name: string, message: AsyncAPIMessage): ISLEntity {
    const fields: ISLField[] = [];

    // Add message metadata
    fields.push({
      name: 'eventId',
      type: 'UUID',
      optional: false,
    });
    fields.push({
      name: 'timestamp',
      type: 'Timestamp',
      optional: false,
    });

    // Add payload fields
    if (message.payload.properties) {
      for (const [propName, propSchema] of Object.entries(message.payload.properties)) {
        fields.push({
          name: propName,
          type: this.mapSchemaToType(propSchema),
          optional: !message.payload.required?.includes(propName),
          description: propSchema.description,
        });
      }
    }

    return {
      name: this.toPascalCase(name) + 'Event',
      description: message.description,
      fields,
    };
  }

  /**
   * Convert schema to enum
   */
  private convertToEnum(name: string, schema: AsyncAPISchema): ISLEnum {
    return {
      name: this.toPascalCase(name),
      variants: schema.enum ?? [],
    };
  }

  /**
   * Convert channel to behaviors
   */
  private convertChannelToBehaviors(channelName: string, channel: AsyncAPIChannel): ISLBehavior[] {
    const behaviors: ISLBehavior[] = [];

    // Subscribe operation (receiving events)
    if (channel.subscribe) {
      behaviors.push(this.convertOperationToBehavior(
        channelName,
        'Subscribe',
        channel.subscribe,
        channel.parameters
      ));
    }

    // Publish operation (sending events)
    if (channel.publish) {
      behaviors.push(this.convertOperationToBehavior(
        channelName,
        'Publish',
        channel.publish,
        channel.parameters
      ));
    }

    return behaviors;
  }

  /**
   * Convert operation to behavior
   */
  private convertOperationToBehavior(
    channelName: string,
    operationType: 'Subscribe' | 'Publish',
    operation: AsyncAPIOperation,
    parameters?: Record<string, AsyncAPIParameter>
  ): ISLBehavior {
    const name = operation.operationId
      ? this.toPascalCase(operation.operationId)
      : `${operationType}${this.toPascalCase(this.cleanChannelName(channelName))}`;

    const input: ISLField[] = [];

    // Add channel parameters
    if (parameters) {
      for (const [paramName, param] of Object.entries(parameters)) {
        input.push({
          name: paramName,
          type: this.mapSchemaToType(param.schema),
          optional: false,
          description: param.description,
        });
      }
    }

    // Get message type
    let messageType = 'unknown';
    const message = operation.message;
    
    if ('oneOf' in message) {
      const types = message.oneOf.map((m) => this.getMessageTypeName(m));
      messageType = types.join(' | ');
    } else {
      messageType = this.getMessageTypeName(message);
    }

    // Add message as input for Publish, output for Subscribe
    const temporal: string[] = [];
    
    if (this.options.includeTemporalAnnotations) {
      if (operationType === 'Subscribe') {
        temporal.push('eventDriven: true');
        temporal.push('streaming: true');
      }
    }

    if (operationType === 'Publish') {
      input.push({
        name: 'event',
        type: messageType,
        optional: false,
      });
    }

    return {
      name,
      description: operation.summary ?? operation.description,
      input: input.length > 0 ? input : undefined,
      output: operationType === 'Subscribe' ? { success: messageType } : undefined,
      temporal: temporal.length > 0 ? temporal : undefined,
    };
  }

  /**
   * Get message type name
   */
  private getMessageTypeName(message: AsyncAPIMessage): string {
    if (message.$ref) {
      const refName = message.$ref.split('/').pop()!;
      return this.toPascalCase(refName) + 'Event';
    }

    if (message.name) {
      return this.toPascalCase(message.name) + 'Event';
    }

    return 'unknown';
  }

  /**
   * Map schema to ISL type
   */
  private mapSchemaToType(schema: AsyncAPISchema): string {
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      return this.toPascalCase(refName);
    }

    if (schema.type === 'array' && schema.items) {
      const itemType = this.mapSchemaToType(schema.items);
      return `List<${itemType}>`;
    }

    switch (schema.type) {
      case 'string':
        if (schema.format === 'uuid') return 'UUID';
        if (schema.format === 'date-time') return 'Timestamp';
        return 'String';
      case 'integer':
        return 'Int';
      case 'number':
        return 'Decimal';
      case 'boolean':
        return 'Boolean';
      case 'object':
        return 'Map<String, unknown>';
      default:
        return 'unknown';
    }
  }

  /**
   * Clean channel name for use in behavior names
   */
  private cleanChannelName(channelName: string): string {
    return channelName
      .replace(/^\//, '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/\//g, '_')
      .replace(/_+/g, '_')
      .replace(/_$/, '');
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s\/]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^./, (c) => c.toUpperCase());
  }
}

/**
 * Convert AsyncAPI spec to ISL
 */
export function convertAsyncAPI(
  spec: AsyncAPISpec,
  options?: AsyncAPIConversionOptions
): ISLDomain {
  const converter = new AsyncAPIConverter(options);
  return converter.convert(spec);
}
