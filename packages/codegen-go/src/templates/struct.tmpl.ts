// ============================================================================
// Go Struct Template
// ============================================================================

export const STRUCT_TEMPLATE = `
// {{.Comment}}
type {{.Name}} struct {
{{range .Fields}}	{{.Name}} {{.Type}}{{if .Tags}} \`{{.Tags}}\`{{end}}
{{end}}}
`;

export const STRUCT_METHOD_TEMPLATE = `
// {{.Comment}}
func ({{.Receiver}} *{{.StructName}}) {{.Name}}({{.Params}}) {{.Returns}} {
{{.Body}}
}
`;

export interface StructTemplateData {
  Comment: string;
  Name: string;
  Fields: FieldTemplateData[];
}

export interface FieldTemplateData {
  Name: string;
  Type: string;
  Tags: string;
}

export interface MethodTemplateData {
  Comment: string;
  Receiver: string;
  StructName: string;
  Name: string;
  Params: string;
  Returns: string;
  Body: string;
}

/**
 * Render struct template
 */
export function renderStruct(data: StructTemplateData): string {
  const lines: string[] = [];
  
  // Comment
  lines.push(`// ${data.Comment}`);
  lines.push(`type ${data.Name} struct {`);
  
  // Fields
  for (const field of data.Fields) {
    const tags = field.Tags ? ` \`${field.Tags}\`` : '';
    lines.push(`\t${field.Name} ${field.Type}${tags}`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Render method template
 */
export function renderMethod(data: MethodTemplateData): string {
  const lines: string[] = [];
  
  lines.push(`// ${data.Comment}`);
  lines.push(`func (${data.Receiver} *${data.StructName}) ${data.Name}(${data.Params}) ${data.Returns} {`);
  
  // Indent body lines
  const bodyLines = data.Body.split('\n');
  for (const line of bodyLines) {
    lines.push(`\t${line}`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}
