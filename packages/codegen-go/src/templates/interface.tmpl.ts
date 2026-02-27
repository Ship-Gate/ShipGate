// ============================================================================
// Go Interface Template
// ============================================================================

export interface InterfaceTemplateData {
  Comment: string;
  Name: string;
  Methods: MethodSignatureData[];
}

export interface MethodSignatureData {
  Comment?: string;
  Name: string;
  Params: string;
  Returns: string;
}

/**
 * Render interface template
 */
export function renderInterface(data: InterfaceTemplateData): string {
  const lines: string[] = [];
  
  // Comment
  lines.push(`// ${data.Comment}`);
  lines.push(`type ${data.Name} interface {`);
  
  // Methods
  for (const method of data.Methods) {
    if (method.Comment) {
      lines.push(`\t// ${method.Comment}`);
    }
    lines.push(`\t${method.Name}(${method.Params}) ${method.Returns}`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Render mock implementation template
 */
export function renderMockImplementation(interfaceName: string, methods: MethodSignatureData[]): string {
  const mockName = `Mock${interfaceName}`;
  const lines: string[] = [];
  
  // Struct
  lines.push(`// ${mockName} is a mock implementation of ${interfaceName}.`);
  lines.push(`type ${mockName} struct {`);
  
  for (const method of methods) {
    const funcType = `func(${method.Params}) ${method.Returns}`;
    lines.push(`\t${method.Name}Func ${funcType}`);
  }
  
  lines.push('}');
  lines.push('');
  
  // Methods
  for (const method of methods) {
    lines.push(`// ${method.Name} implements ${interfaceName}.${method.Name}.`);
    lines.push(`func (m *${mockName}) ${method.Name}(${method.Params}) ${method.Returns} {`);
    lines.push(`\tif m.${method.Name}Func != nil {`);
    
    // Extract param names for call
    const paramNames = extractParamNames(method.Params);
    lines.push(`\t\treturn m.${method.Name}Func(${paramNames})`);
    
    lines.push(`\t}`);
    
    // Default return
    const defaultReturn = getDefaultReturn(method.Returns);
    lines.push(`\treturn ${defaultReturn}`);
    
    lines.push('}');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Extract parameter names from signature
 */
function extractParamNames(params: string): string {
  if (!params.trim()) return '';
  
  const parts = params.split(',').map(p => {
    const trimmed = p.trim();
    const nameMatch = trimmed.match(/^(\w+)/);
    return nameMatch ? nameMatch[1] : '';
  });
  
  return parts.filter(Boolean).join(', ');
}

/**
 * Get default return value based on return type
 */
function getDefaultReturn(returns: string): string {
  const trimmed = returns.trim();
  
  if (!trimmed) return '';
  
  // Handle multiple returns
  if (trimmed.includes(',')) {
    const parts = trimmed.replace(/[()]/g, '').split(',').map(p => p.trim());
    return parts.map(getDefaultForType).join(', ');
  }
  
  // Handle single return with parentheses
  const cleanReturn = trimmed.replace(/[()]/g, '').trim();
  return getDefaultForType(cleanReturn);
}

/**
 * Get default value for a single type
 */
function getDefaultForType(typeName: string): string {
  const clean = typeName.trim();
  
  if (clean.startsWith('*')) return 'nil';
  if (clean.startsWith('[]')) return 'nil';
  if (clean.startsWith('map[')) return 'nil';
  if (clean === 'error') return 'nil';
  if (clean === 'string') return '""';
  if (clean === 'bool') return 'false';
  if (clean.includes('int') || clean.includes('float')) return '0';
  if (clean === 'interface{}') return 'nil';
  
  return `${clean}{}`; 
}
