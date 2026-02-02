/**
 * Protobuf to ISL Converter
 * 
 * Convert Protocol Buffer definitions to ISL format.
 */

export interface ProtobufDefinition {
  package?: string;
  messages: ProtobufMessage[];
  enums: ProtobufEnum[];
  services: ProtobufService[];
}

export interface ProtobufMessage {
  name: string;
  fields: ProtobufField[];
  nested?: ProtobufMessage[];
  nestedEnums?: ProtobufEnum[];
  options?: Record<string, unknown>;
}

export interface ProtobufField {
  name: string;
  number: number;
  type: string;
  label?: 'optional' | 'required' | 'repeated';
  oneofName?: string;
  options?: Record<string, unknown>;
}

export interface ProtobufEnum {
  name: string;
  values: Array<{ name: string; number: number }>;
}

export interface ProtobufService {
  name: string;
  methods: ProtobufMethod[];
}

export interface ProtobufMethod {
  name: string;
  requestType: string;
  responseType: string;
  clientStreaming?: boolean;
  serverStreaming?: boolean;
  options?: Record<string, unknown>;
}

export interface ProtobufConversionOptions {
  /** Domain name for generated ISL */
  domainName?: string;
  /** Generate behaviors from services */
  generateBehaviors?: boolean;
  /** Include field numbers as metadata */
  includeFieldNumbers?: boolean;
  /** Handle nested messages */
  flattenNested?: boolean;
}

interface ISLEntity {
  name: string;
  fields: ISLField[];
}

interface ISLBehavior {
  name: string;
  input?: ISLField[];
  output?: { success: string };
  temporal?: string[];
}

interface ISLEnum {
  name: string;
  variants: string[];
}

interface ISLField {
  name: string;
  type: string;
  optional?: boolean;
}

export interface ISLDomain {
  name: string;
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  types: Array<{ name: string; baseType: string }>;
  enums: ISLEnum[];
}

/**
 * Protobuf to ISL Converter
 */
export class ProtobufConverter {
  private options: Required<ProtobufConversionOptions>;

  constructor(options: ProtobufConversionOptions = {}) {
    this.options = {
      domainName: options.domainName ?? 'ProtobufAPI',
      generateBehaviors: options.generateBehaviors ?? true,
      includeFieldNumbers: options.includeFieldNumbers ?? false,
      flattenNested: options.flattenNested ?? true,
    };
  }

  /**
   * Convert Protobuf definition to ISL domain
   */
  convert(proto: ProtobufDefinition): ISLDomain {
    const entities: ISLEntity[] = [];
    const behaviors: ISLBehavior[] = [];
    const enums: ISLEnum[] = [];

    // Convert messages to entities
    for (const message of proto.messages) {
      entities.push(...this.convertMessage(message));
    }

    // Convert enums
    for (const enumDef of proto.enums) {
      enums.push(this.convertEnum(enumDef));
    }

    // Convert services to behaviors
    if (this.options.generateBehaviors) {
      for (const service of proto.services) {
        behaviors.push(...this.convertService(service));
      }
    }

    return {
      name: this.options.domainName,
      entities,
      behaviors,
      types: [],
      enums,
    };
  }

  /**
   * Convert message to entity
   */
  private convertMessage(message: ProtobufMessage, prefix = ''): ISLEntity[] {
    const entities: ISLEntity[] = [];
    const name = prefix ? `${prefix}${message.name}` : message.name;

    const fields: ISLField[] = [];
    for (const field of message.fields) {
      fields.push({
        name: this.toCamelCase(field.name),
        type: this.mapProtoType(field.type, field.label === 'repeated'),
        optional: field.label === 'optional',
      });
    }

    entities.push({ name, fields });

    // Handle nested messages
    if (this.options.flattenNested && message.nested) {
      for (const nested of message.nested) {
        entities.push(...this.convertMessage(nested, `${name}_`));
      }
    }

    // Handle nested enums - add to parent
    if (message.nestedEnums) {
      // These would be handled separately in the main convert function
    }

    return entities;
  }

  /**
   * Convert enum
   */
  private convertEnum(enumDef: ProtobufEnum): ISLEnum {
    return {
      name: enumDef.name,
      variants: enumDef.values.map((v) => v.name),
    };
  }

  /**
   * Convert service to behaviors
   */
  private convertService(service: ProtobufService): ISLBehavior[] {
    return service.methods.map((method) => this.convertMethod(method));
  }

  /**
   * Convert method to behavior
   */
  private convertMethod(method: ProtobufMethod): ISLBehavior {
    const temporal: string[] = [];

    if (method.clientStreaming) {
      temporal.push('clientStreaming: true');
    }
    if (method.serverStreaming) {
      temporal.push('serverStreaming: true');
    }

    return {
      name: method.name,
      input: [{ name: 'request', type: method.requestType }],
      output: { success: method.responseType },
      temporal: temporal.length > 0 ? temporal : undefined,
    };
  }

  /**
   * Map Protobuf type to ISL type
   */
  private mapProtoType(protoType: string, repeated: boolean): string {
    let islType: string;

    switch (protoType) {
      case 'string':
        islType = 'String';
        break;
      case 'int32':
      case 'int64':
      case 'sint32':
      case 'sint64':
      case 'sfixed32':
      case 'sfixed64':
        islType = 'Int';
        break;
      case 'uint32':
      case 'uint64':
      case 'fixed32':
      case 'fixed64':
        islType = 'Int';
        break;
      case 'float':
      case 'double':
        islType = 'Decimal';
        break;
      case 'bool':
        islType = 'Boolean';
        break;
      case 'bytes':
        islType = 'Bytes';
        break;
      default:
        // Assume it's a message type reference
        islType = protoType;
    }

    return repeated ? `List<${islType}>` : islType;
  }

  /**
   * Convert to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  /**
   * Parse .proto file content
   */
  static parseProto(content: string): ProtobufDefinition {
    const messages: ProtobufMessage[] = [];
    const enums: ProtobufEnum[] = [];
    const services: ProtobufService[] = [];
    let packageName: string | undefined;

    // Parse package
    const packageMatch = content.match(/package\s+([\w.]+);/);
    if (packageMatch) {
      packageName = packageMatch[1];
    }

    // Parse messages (simplified)
    const messageRegex = /message\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = messageRegex.exec(content)) !== null) {
      const [, name, body] = match;
      if (!name || !body) continue;
      const fields = ProtobufConverter.parseFields(body);
      messages.push({ name, fields });
    }

    // Parse enums
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = enumRegex.exec(content)) !== null) {
      const [, name, body] = match;
      if (!name || !body) continue;
      const values = ProtobufConverter.parseEnumValues(body);
      enums.push({ name, values });
    }

    // Parse services
    const serviceRegex = /service\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = serviceRegex.exec(content)) !== null) {
      const [, name, body] = match;
      if (!name || !body) continue;
      const methods = ProtobufConverter.parseMethods(body);
      services.push({ name, methods });
    }

    return { package: packageName, messages, enums, services };
  }

  /**
   * Parse message fields
   */
  private static parseFields(body: string): ProtobufField[] {
    const fields: ProtobufField[] = [];
    const lines = body.split(';').map((l) => l.trim()).filter((l) => l);

    for (const line of lines) {
      const match = line.match(/(optional|required|repeated)?\s*(\w+)\s+(\w+)\s*=\s*(\d+)/);
      if (match) {
        const [, label, type, name, number] = match;
        if (!type || !name || !number) continue;
        fields.push({
          name,
          type,
          number: parseInt(number, 10),
          label: label as 'optional' | 'required' | 'repeated' | undefined,
        });
      }
    }

    return fields;
  }

  /**
   * Parse enum values
   */
  private static parseEnumValues(body: string): Array<{ name: string; number: number }> {
    const values: Array<{ name: string; number: number }> = [];
    const lines = body.split(';').map((l) => l.trim()).filter((l) => l);

    for (const line of lines) {
      const match = line.match(/(\w+)\s*=\s*(\d+)/);
      if (match && match[1] && match[2]) {
        values.push({
          name: match[1],
          number: parseInt(match[2], 10),
        });
      }
    }

    return values;
  }

  /**
   * Parse service methods
   */
  private static parseMethods(body: string): ProtobufMethod[] {
    const methods: ProtobufMethod[] = [];
    const regex = /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+)\s*\)/g;
    let match;

    while ((match = regex.exec(body)) !== null) {
      const [, name, clientStream, requestType, serverStream, responseType] = match;
      if (!name || !requestType || !responseType) continue;
      methods.push({
        name,
        requestType,
        responseType,
        clientStreaming: !!clientStream,
        serverStreaming: !!serverStream,
      });
    }

    return methods;
  }
}

/**
 * Convert Protobuf to ISL
 */
export function convertProtobuf(
  proto: ProtobufDefinition | string,
  options?: ProtobufConversionOptions
): ISLDomain {
  const converter = new ProtobufConverter(options);

  if (typeof proto === 'string') {
    proto = ProtobufConverter.parseProto(proto);
  }

  return converter.convert(proto);
}
