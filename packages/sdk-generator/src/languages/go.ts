/**
 * Go SDK Generator
 */

import type { GeneratedFile, DomainSpec, BehaviorSpec, FieldSpec } from '../types.js';
import type { SDKOptions } from '../generator.js';

export class GoSDKGenerator {
  private options: Required<SDKOptions>;

  constructor(options: Required<SDKOptions>) {
    this.options = options;
  }

  generate(domain: DomainSpec): GeneratedFile[] {
    const pkg = this.toSnakeCase(domain.name);
    return [
      { path: `${this.options.outputPrefix}client.go`, content: this.generateClient(domain, pkg) },
      { path: `${this.options.outputPrefix}types.go`, content: this.generateTypes(domain, pkg) },
      { path: `${this.options.outputPrefix}go.mod`, content: this.generateGoMod(domain) },
    ];
  }

  private generateClient(domain: DomainSpec, pkg: string): string {
    const lines = [
      `// Package ${pkg} provides a client for the ${domain.name} API`,
      '// Generated from ISL specification',
      `package ${pkg}`,
      '',
      'import (',
      '\t"bytes"',
      '\t"context"',
      '\t"encoding/json"',
      '\t"fmt"',
      '\t"io"',
      '\t"net/http"',
      '\t"time"',
      ')',
      '',
      '// Client is the API client',
      'type Client struct {',
      '\tbaseURL    string',
      '\thttpClient *http.Client',
      '\theaders    map[string]string',
      '}',
      '',
      '// ClientOption configures the client',
      'type ClientOption func(*Client)',
      '',
      '// WithBaseURL sets the base URL',
      'func WithBaseURL(url string) ClientOption {',
      '\treturn func(c *Client) { c.baseURL = url }',
      '}',
      '',
      '// WithHeader adds a header',
      'func WithHeader(key, value string) ClientOption {',
      '\treturn func(c *Client) { c.headers[key] = value }',
      '}',
      '',
      '// WithTimeout sets the timeout',
      'func WithTimeout(d time.Duration) ClientOption {',
      '\treturn func(c *Client) { c.httpClient.Timeout = d }',
      '}',
      '',
      '// NewClient creates a new client',
      'func NewClient(opts ...ClientOption) *Client {',
      '\tc := &Client{',
      `\t\tbaseURL:    "${this.options.baseUrl}",`,
      '\t\thttpClient: &http.Client{Timeout: 30 * time.Second},',
      '\t\theaders:    map[string]string{"Content-Type": "application/json"},',
      '\t}',
      '\tfor _, opt := range opts {',
      '\t\topt(c)',
      '\t}',
      '\treturn c',
      '}',
      '',
      '// APIError represents an API error',
      'type APIError struct {',
      '\tStatusCode int',
      '\tCode       string',
      '\tMessage    string',
      '}',
      '',
      'func (e *APIError) Error() string {',
      '\treturn fmt.Sprintf("API error %d: %s - %s", e.StatusCode, e.Code, e.Message)',
      '}',
      '',
      'func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, result interface{}) error {',
      '\tvar bodyReader io.Reader',
      '\tif body != nil {',
      '\t\tdata, err := json.Marshal(body)',
      '\t\tif err != nil {',
      '\t\t\treturn fmt.Errorf("marshal body: %w", err)',
      '\t\t}',
      '\t\tbodyReader = bytes.NewReader(data)',
      '\t}',
      '',
      '\treq, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)',
      '\tif err != nil {',
      '\t\treturn fmt.Errorf("create request: %w", err)',
      '\t}',
      '',
      '\tfor k, v := range c.headers {',
      '\t\treq.Header.Set(k, v)',
      '\t}',
      '',
      '\tresp, err := c.httpClient.Do(req)',
      '\tif err != nil {',
      '\t\treturn fmt.Errorf("do request: %w", err)',
      '\t}',
      '\tdefer resp.Body.Close()',
      '',
      '\tif resp.StatusCode >= 400 {',
      '\t\tvar apiErr struct {',
      '\t\t\tCode    string `json:"code"`',
      '\t\t\tMessage string `json:"message"`',
      '\t\t}',
      '\t\tjson.NewDecoder(resp.Body).Decode(&apiErr)',
      '\t\treturn &APIError{StatusCode: resp.StatusCode, Code: apiErr.Code, Message: apiErr.Message}',
      '\t}',
      '',
      '\tif result != nil {',
      '\t\tif err := json.NewDecoder(resp.Body).Decode(result); err != nil {',
      '\t\t\treturn fmt.Errorf("decode response: %w", err)',
      '\t\t}',
      '\t}',
      '',
      '\treturn nil',
      '}',
      '',
    ];

    // Generate methods
    for (const behavior of domain.behaviors) {
      lines.push(...this.generateMethod(behavior));
    }

    return lines.join('\n');
  }

  private generateMethod(behavior: BehaviorSpec): string[] {
    const methodName = behavior.name;
    const path = this.behaviorToPath(behavior.name);
    const httpMethod = this.inferMethod(behavior);
    const hasInput = !!behavior.input?.fields.length;
    const hasOutput = !!behavior.output;

    const lines: string[] = [];

    // Comment
    lines.push(`// ${methodName} - ${behavior.description || behavior.name}`);

    // Signature
    const params = hasInput ? `ctx context.Context, input *${behavior.name}Input` : 'ctx context.Context';
    const returns = hasOutput ? `(*${behavior.name}Result, error)` : 'error';

    lines.push(`func (c *Client) ${methodName}(${params}) ${returns} {`);

    if (hasOutput) {
      lines.push(`\tvar result ${behavior.name}Result`);
      lines.push(`\terr := c.doRequest(ctx, "${httpMethod}", "${path}", ${hasInput ? 'input' : 'nil'}, &result)`);
      lines.push('\tif err != nil {');
      lines.push('\t\treturn nil, err');
      lines.push('\t}');
      lines.push('\treturn &result, nil');
    } else {
      lines.push(`\treturn c.doRequest(ctx, "${httpMethod}", "${path}", ${hasInput ? 'input' : 'nil'}, nil)`);
    }

    lines.push('}');
    lines.push('');

    return lines;
  }

  private generateTypes(domain: DomainSpec, pkg: string): string {
    const lines = [
      `package ${pkg}`,
      '',
      'import "time"',
      '',
    ];

    // Entity types
    for (const entity of domain.entities) {
      lines.push(`// ${entity.name} entity`);
      lines.push(`type ${entity.name} struct {`);
      for (const field of entity.fields) {
        const goType = this.toGo(field.type, field.optional);
        const jsonTag = `\`json:"${this.toSnakeCase(field.name)}${field.optional ? ',omitempty' : ''}"\``;
        lines.push(`\t${this.toPascalCase(field.name)} ${goType} ${jsonTag}`);
      }
      lines.push('}');
      lines.push('');
    }

    // Behavior types
    for (const behavior of domain.behaviors) {
      if (behavior.input?.fields.length) {
        lines.push(`// ${behavior.name}Input request`);
        lines.push(`type ${behavior.name}Input struct {`);
        for (const field of behavior.input.fields) {
          const goType = this.toGo(field.type, field.optional);
          const jsonTag = `\`json:"${this.toSnakeCase(field.name)}${field.optional ? ',omitempty' : ''}"\``;
          lines.push(`\t${this.toPascalCase(field.name)} ${goType} ${jsonTag}`);
        }
        lines.push('}');
        lines.push('');
      }

      if (behavior.output) {
        lines.push(`// ${behavior.name}Result response`);
        lines.push(`type ${behavior.name}Result struct {`);
        lines.push('\tSuccess bool        `json:"success"`');
        lines.push(`\tData    *${behavior.output.success} \`json:"data,omitempty"\``);
        lines.push('\tError   *ErrorInfo  `json:"error,omitempty"`');
        lines.push('}');
        lines.push('');
      }
    }

    lines.push('// ErrorInfo error details');
    lines.push('type ErrorInfo struct {');
    lines.push('\tCode    string `json:"code"`');
    lines.push('\tMessage string `json:"message"`');
    lines.push('}');

    return lines.join('\n');
  }

  private generateGoMod(domain: DomainSpec): string {
    return [
      `module ${this.options.packageName}`,
      '',
      'go 1.21',
    ].join('\n');
  }

  private toGo(type: string, optional: boolean): string {
    let goType: string;
    switch (type) {
      case 'String': case 'UUID': goType = 'string'; break;
      case 'Int': goType = 'int64'; break;
      case 'Decimal': goType = 'float64'; break;
      case 'Boolean': goType = 'bool'; break;
      case 'Timestamp': goType = 'time.Time'; break;
      default: goType = type;
    }
    return optional ? `*${goType}` : goType;
  }

  private toPascalCase(s: string): string {
    return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }

  private toSnakeCase(s: string): string {
    return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  private behaviorToPath(name: string): string {
    return '/' + name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  }

  private inferMethod(b: BehaviorSpec): string {
    const n = b.name.toLowerCase();
    if (n.startsWith('get') || n.startsWith('list')) return 'GET';
    if (n.startsWith('delete')) return 'DELETE';
    if (n.startsWith('update')) return 'PUT';
    return 'POST';
  }
}
