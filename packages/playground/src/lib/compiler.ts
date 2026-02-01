// Browser-based ISL compiler
// This is a simplified compiler for the playground

export interface Location {
  line: number
  column: number
  offset: number
}

export interface CompileError {
  message: string
  location: Location
  severity: 'error' | 'warning'
}

export interface TypeDefinition {
  name: string
  fields: { name: string; type: string; optional: boolean }[]
}

export interface Behavior {
  name: string
  description: string
  preconditions: string[]
  postconditions: string[]
  parameters: { name: string; type: string }[]
  returns: string | null
}

export interface Domain {
  name: string
  description: string
  types: TypeDefinition[]
  behaviors: Behavior[]
}

export interface ParseResult {
  success: boolean
  domain?: Domain
  errors: CompileError[]
}

export interface CheckResult {
  success: boolean
  errors: CompileError[]
  warnings: CompileError[]
}

// Tokenizer
type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'COMMENT'
  | 'WHITESPACE'
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  location: Location
}

const KEYWORDS = [
  'domain', 'type', 'behavior', 'pre', 'post', 'returns',
  'requires', 'ensures', 'invariant', 'given', 'when', 'then',
  'true', 'false', 'null', 'and', 'or', 'not', 'in', 'is'
]

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1
  let column = 1

  const makeLocation = (): Location => ({ line, column, offset: pos })

  const advance = (count = 1) => {
    for (let i = 0; i < count; i++) {
      if (source[pos] === '\n') {
        line++
        column = 1
      } else {
        column++
      }
      pos++
    }
  }

  while (pos < source.length) {
    const char = source[pos]
    const location = makeLocation()

    // Whitespace
    if (/\s/.test(char)) {
      let value = ''
      while (pos < source.length && /\s/.test(source[pos])) {
        value += source[pos]
        advance()
      }
      tokens.push({ type: 'WHITESPACE', value, location })
      continue
    }

    // Comments
    if (source.slice(pos, pos + 2) === '//') {
      let value = ''
      while (pos < source.length && source[pos] !== '\n') {
        value += source[pos]
        advance()
      }
      tokens.push({ type: 'COMMENT', value, location })
      continue
    }

    // Multi-line comments
    if (source.slice(pos, pos + 2) === '/*') {
      let value = '/*'
      advance(2)
      while (pos < source.length && source.slice(pos, pos + 2) !== '*/') {
        value += source[pos]
        advance()
      }
      if (pos < source.length) {
        value += '*/'
        advance(2)
      }
      tokens.push({ type: 'COMMENT', value, location })
      continue
    }

    // Strings
    if (char === '"' || char === "'") {
      const quote = char
      let value = quote
      advance()
      while (pos < source.length && source[pos] !== quote) {
        if (source[pos] === '\\' && pos + 1 < source.length) {
          value += source[pos]
          advance()
        }
        value += source[pos]
        advance()
      }
      if (pos < source.length) {
        value += quote
        advance()
      }
      tokens.push({ type: 'STRING', value, location })
      continue
    }

    // Numbers
    if (/\d/.test(char)) {
      let value = ''
      while (pos < source.length && /[\d.]/.test(source[pos])) {
        value += source[pos]
        advance()
      }
      tokens.push({ type: 'NUMBER', value, location })
      continue
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let value = ''
      while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) {
        value += source[pos]
        advance()
      }
      const type = KEYWORDS.includes(value) ? 'KEYWORD' : 'IDENTIFIER'
      tokens.push({ type, value, location })
      continue
    }

    // Operators
    if (/[=<>!&|+\-*/%]/.test(char)) {
      let value = char
      advance()
      if (pos < source.length && /[=<>&|]/.test(source[pos])) {
        value += source[pos]
        advance()
      }
      tokens.push({ type: 'OPERATOR', value, location })
      continue
    }

    // Punctuation
    if (/[{}()\[\]:;,.]/.test(char)) {
      tokens.push({ type: 'PUNCTUATION', value: char, location })
      advance()
      continue
    }

    // Unknown character - skip it
    advance()
  }

  tokens.push({ type: 'EOF', value: '', location: makeLocation() })
  return tokens
}

// Parser
class Parser {
  private tokens: Token[]
  private pos = 0
  private errors: CompileError[] = []

  constructor(source: string) {
    this.tokens = tokenize(source).filter(t => t.type !== 'WHITESPACE' && t.type !== 'COMMENT')
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', location: { line: 1, column: 1, offset: 0 } }
  }

  private advance(): Token {
    const token = this.peek()
    if (token.type !== 'EOF') this.pos++
    return token
  }

  private expect(type: TokenType, value?: string): Token | null {
    const token = this.peek()
    if (token.type !== type || (value && token.value !== value)) {
      this.errors.push({
        message: `Expected ${value || type}, got '${token.value}'`,
        location: token.location,
        severity: 'error',
      })
      return null
    }
    return this.advance()
  }

  private match(type: TokenType, value?: string): boolean {
    const token = this.peek()
    return token.type === type && (!value || token.value === value)
  }

  parse(): ParseResult {
    try {
      const domain = this.parseDomain()
      if (domain && this.errors.length === 0) {
        return { success: true, domain, errors: [] }
      }
      return { success: false, errors: this.errors }
    } catch (e) {
      this.errors.push({
        message: e instanceof Error ? e.message : 'Unknown parse error',
        location: this.peek().location,
        severity: 'error',
      })
      return { success: false, errors: this.errors }
    }
  }

  private parseDomain(): Domain | null {
    if (!this.expect('KEYWORD', 'domain')) return null
    
    const nameToken = this.expect('IDENTIFIER')
    if (!nameToken) return null
    
    let description = ''
    if (this.match('STRING')) {
      description = this.parseString(this.advance().value)
    }

    if (!this.expect('PUNCTUATION', '{')) return null

    const types: TypeDefinition[] = []
    const behaviors: Behavior[] = []

    while (!this.match('PUNCTUATION', '}') && !this.match('EOF', '')) {
      if (this.match('KEYWORD', 'type')) {
        const type = this.parseType()
        if (type) types.push(type)
      } else if (this.match('KEYWORD', 'behavior')) {
        const behavior = this.parseBehavior()
        if (behavior) behaviors.push(behavior)
      } else {
        // Skip unknown token
        this.advance()
      }
    }

    this.expect('PUNCTUATION', '}')

    return {
      name: nameToken.value,
      description,
      types,
      behaviors,
    }
  }

  private parseType(): TypeDefinition | null {
    this.expect('KEYWORD', 'type')
    
    const nameToken = this.expect('IDENTIFIER')
    if (!nameToken) return null

    if (!this.expect('PUNCTUATION', '{')) return null

    const fields: TypeDefinition['fields'] = []

    while (!this.match('PUNCTUATION', '}') && !this.match('EOF', '')) {
      const fieldName = this.expect('IDENTIFIER')
      if (!fieldName) break

      let optional = false
      if (this.match('OPERATOR', '?') || this.match('PUNCTUATION', '?')) {
        this.advance()
        optional = true
      }

      this.expect('PUNCTUATION', ':')
      
      const fieldType = this.parseTypeExpr()

      fields.push({ name: fieldName.value, type: fieldType, optional })

      // Skip comma if present
      if (this.match('PUNCTUATION', ',')) this.advance()
    }

    this.expect('PUNCTUATION', '}')

    return { name: nameToken.value, fields }
  }

  private parseTypeExpr(): string {
    let type = ''
    
    if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
      type = this.advance().value
    }

    // Handle array types
    if (this.match('PUNCTUATION', '[')) {
      this.advance()
      this.expect('PUNCTUATION', ']')
      type += '[]'
    }

    // Handle generic types
    if (this.match('OPERATOR', '<')) {
      type += '<'
      this.advance()
      type += this.parseTypeExpr()
      this.expect('OPERATOR', '>')
      type += '>'
    }

    return type || 'unknown'
  }

  private parseBehavior(): Behavior | null {
    this.expect('KEYWORD', 'behavior')
    
    const nameToken = this.expect('IDENTIFIER')
    if (!nameToken) return null

    let description = ''
    if (this.match('STRING')) {
      description = this.parseString(this.advance().value)
    }

    // Parse parameters
    const parameters: Behavior['parameters'] = []
    if (this.match('PUNCTUATION', '(')) {
      this.advance()
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF', '')) {
        const paramName = this.expect('IDENTIFIER')
        if (!paramName) break
        
        this.expect('PUNCTUATION', ':')
        const paramType = this.parseTypeExpr()
        
        parameters.push({ name: paramName.value, type: paramType })
        
        if (this.match('PUNCTUATION', ',')) this.advance()
      }
      this.expect('PUNCTUATION', ')')
    }

    // Parse return type
    let returns: string | null = null
    if (this.match('KEYWORD', 'returns') || this.match('PUNCTUATION', ':')) {
      this.advance()
      returns = this.parseTypeExpr()
    }

    if (!this.expect('PUNCTUATION', '{')) return null

    const preconditions: string[] = []
    const postconditions: string[] = []

    while (!this.match('PUNCTUATION', '}') && !this.match('EOF', '')) {
      if (this.match('KEYWORD', 'pre') || this.match('KEYWORD', 'requires') || this.match('KEYWORD', 'given')) {
        this.advance()
        const condition = this.parseCondition()
        if (condition) preconditions.push(condition)
      } else if (this.match('KEYWORD', 'post') || this.match('KEYWORD', 'ensures') || this.match('KEYWORD', 'then')) {
        this.advance()
        const condition = this.parseCondition()
        if (condition) postconditions.push(condition)
      } else {
        this.advance()
      }
    }

    this.expect('PUNCTUATION', '}')

    return {
      name: nameToken.value,
      description,
      preconditions,
      postconditions,
      parameters,
      returns,
    }
  }

  private parseCondition(): string {
    let condition = ''
    let braceDepth = 0
    
    while (!this.match('EOF', '')) {
      const token = this.peek()
      
      if (token.type === 'PUNCTUATION') {
        if (token.value === '{') braceDepth++
        if (token.value === '}') {
          if (braceDepth === 0) break
          braceDepth--
        }
      }
      
      if (token.type === 'KEYWORD' && ['pre', 'post', 'requires', 'ensures', 'given', 'then'].includes(token.value)) {
        break
      }
      
      condition += token.value + ' '
      this.advance()
    }
    
    return condition.trim()
  }

  private parseString(str: string): string {
    // Remove quotes and unescape
    return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'")
  }
}

export function parse(source: string): ParseResult {
  const parser = new Parser(source)
  return parser.parse()
}

export function check(domain: Domain): CheckResult {
  const errors: CompileError[] = []
  const warnings: CompileError[] = []
  
  // Check for duplicate type names
  const typeNames = new Set<string>()
  for (const type of domain.types) {
    if (typeNames.has(type.name)) {
      errors.push({
        message: `Duplicate type definition: ${type.name}`,
        location: { line: 1, column: 1, offset: 0 },
        severity: 'error',
      })
    }
    typeNames.add(type.name)
  }

  // Check for duplicate behavior names
  const behaviorNames = new Set<string>()
  for (const behavior of domain.behaviors) {
    if (behaviorNames.has(behavior.name)) {
      errors.push({
        message: `Duplicate behavior definition: ${behavior.name}`,
        location: { line: 1, column: 1, offset: 0 },
        severity: 'error',
      })
    }
    behaviorNames.add(behavior.name)
  }

  // Warn about behaviors without preconditions or postconditions
  for (const behavior of domain.behaviors) {
    if (behavior.preconditions.length === 0) {
      warnings.push({
        message: `Behavior '${behavior.name}' has no preconditions`,
        location: { line: 1, column: 1, offset: 0 },
        severity: 'warning',
      })
    }
    if (behavior.postconditions.length === 0) {
      warnings.push({
        message: `Behavior '${behavior.name}' has no postconditions`,
        location: { line: 1, column: 1, offset: 0 },
        severity: 'warning',
      })
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  }
}
