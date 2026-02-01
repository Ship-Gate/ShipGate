/**
 * Python SDK Generator
 */

import type { GeneratedFile, DomainSpec, BehaviorSpec, FieldSpec } from '../types.js';
import type { SDKOptions } from '../generator.js';

export class PythonSDKGenerator {
  private options: Required<SDKOptions>;

  constructor(options: Required<SDKOptions>) {
    this.options = options;
  }

  generate(domain: DomainSpec): GeneratedFile[] {
    const pkg = this.toSnakeCase(this.options.packageName);
    return [
      { path: `${this.options.outputPrefix}${pkg}/__init__.py`, content: this.generateInit(domain) },
      { path: `${this.options.outputPrefix}${pkg}/client.py`, content: this.generateClient(domain) },
      { path: `${this.options.outputPrefix}${pkg}/types.py`, content: this.generateTypes(domain) },
      { path: `${this.options.outputPrefix}setup.py`, content: this.generateSetup(domain) },
      { path: `${this.options.outputPrefix}requirements.txt`, content: 'httpx>=0.25.0\npydantic>=2.0.0' },
    ];
  }

  private generateInit(domain: DomainSpec): string {
    return [
      `"""${domain.name} API Client"""`,
      '',
      `from .client import ${domain.name}Client`,
      'from .types import *',
      '',
      `__version__ = "${domain.version}"`,
    ].join('\n');
  }

  private generateClient(domain: DomainSpec): string {
    const lines = [
      '"""',
      `${domain.name} API Client`,
      'Generated from ISL specification',
      '"""',
      '',
      'from typing import Optional, Dict, Any',
      'import httpx',
      'from .types import *',
      '',
      '',
      `class ${domain.name}Client:`,
      '    """API client for interacting with the service."""',
      '',
      '    def __init__(',
      '        self,',
      `        base_url: str = "${this.options.baseUrl}",`,
      '        headers: Optional[Dict[str, str]] = None,',
      '        timeout: float = 30.0,',
      '    ):',
      '        self.base_url = base_url.rstrip("/")',
      '        self.timeout = timeout',
      '        self._headers = {"Content-Type": "application/json"}',
      '        if headers:',
      '            self._headers.update(headers)',
      '        self._client = httpx.Client(timeout=timeout, headers=self._headers)',
      '',
      '    def close(self):',
      '        """Close the HTTP client."""',
      '        self._client.close()',
      '',
      '    def __enter__(self):',
      '        return self',
      '',
      '    def __exit__(self, *args):',
      '        self.close()',
      '',
    ];

    // Generate methods
    for (const behavior of domain.behaviors) {
      lines.push(...this.generateMethod(behavior));
    }

    return lines.join('\n');
  }

  private generateMethod(behavior: BehaviorSpec): string[] {
    const methodName = this.toSnakeCase(behavior.name);
    const path = this.behaviorToPath(behavior.name);
    const httpMethod = this.inferMethod(behavior);
    const hasInput = !!behavior.input?.fields.length;

    const lines: string[] = [];

    // Method signature
    const params = hasInput ? `self, input: ${behavior.name}Input` : 'self';
    const returnType = behavior.output ? `${behavior.name}Result` : 'None';

    lines.push(`    def ${methodName}(${params}) -> ${returnType}:`);
    lines.push(`        """${behavior.description || behavior.name}"""`);

    if (httpMethod === 'GET') {
      lines.push(`        response = self._client.get(f"{self.base_url}${path}")`);
    } else {
      const data = hasInput ? 'json=input.model_dump()' : '';
      lines.push(`        response = self._client.${httpMethod.toLowerCase()}(f"{self.base_url}${path}"${data ? ', ' + data : ''})`);
    }

    lines.push('        response.raise_for_status()');
    
    if (behavior.output) {
      lines.push(`        return ${behavior.name}Result.model_validate(response.json())`);
    } else {
      lines.push('        return None');
    }
    
    lines.push('');

    return lines;
  }

  private generateTypes(domain: DomainSpec): string {
    const lines = [
      '"""',
      `Types for ${domain.name} API`,
      '"""',
      '',
      'from typing import Optional, List, Union, Literal',
      'from datetime import datetime',
      'from decimal import Decimal',
      'from uuid import UUID',
      'from pydantic import BaseModel, Field',
      '',
      '',
    ];

    // Entity types
    for (const entity of domain.entities) {
      lines.push(`class ${entity.name}(BaseModel):`);
      lines.push(`    """${entity.name} entity."""`);
      for (const field of entity.fields) {
        const pyType = this.toPython(field.type, field.optional);
        lines.push(`    ${this.toSnakeCase(field.name)}: ${pyType}`);
      }
      lines.push('');
      lines.push('');
    }

    // Behavior types
    for (const behavior of domain.behaviors) {
      if (behavior.input?.fields.length) {
        lines.push(`class ${behavior.name}Input(BaseModel):`);
        lines.push(`    """Input for ${behavior.name}."""`);
        for (const field of behavior.input.fields) {
          const pyType = this.toPython(field.type, field.optional);
          lines.push(`    ${this.toSnakeCase(field.name)}: ${pyType}`);
        }
        lines.push('');
        lines.push('');
      }

      if (behavior.output) {
        lines.push(`class ${behavior.name}Success(BaseModel):`);
        lines.push('    success: Literal[True] = True');
        lines.push(`    data: ${behavior.output.success}`);
        lines.push('');
        lines.push('');

        lines.push(`class ${behavior.name}Error(BaseModel):`);
        lines.push('    success: Literal[False] = False');
        lines.push('    error: dict');
        lines.push('');
        lines.push('');

        lines.push(`${behavior.name}Result = Union[${behavior.name}Success, ${behavior.name}Error]`);
        lines.push('');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private generateSetup(domain: DomainSpec): string {
    return [
      'from setuptools import setup, find_packages',
      '',
      'setup(',
      `    name="${this.toSnakeCase(this.options.packageName)}",`,
      `    version="${domain.version}",`,
      `    description="${domain.name} API Client",`,
      '    packages=find_packages(),',
      '    python_requires=">=3.10",',
      '    install_requires=[',
      '        "httpx>=0.25.0",',
      '        "pydantic>=2.0.0",',
      '    ],',
      ')',
    ].join('\n');
  }

  private toPython(type: string, optional: boolean): string {
    let pyType: string;
    switch (type) {
      case 'String': pyType = 'str'; break;
      case 'Int': pyType = 'int'; break;
      case 'Decimal': pyType = 'Decimal'; break;
      case 'Boolean': pyType = 'bool'; break;
      case 'UUID': pyType = 'UUID'; break;
      case 'Timestamp': pyType = 'datetime'; break;
      default: pyType = type;
    }
    return optional ? `Optional[${pyType}] = None` : pyType;
  }

  private toSnakeCase(s: string): string {
    return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/-/g, '_');
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
