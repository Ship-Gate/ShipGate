'use client'

import { useRef, useCallback, useEffect } from 'react'
import MonacoEditor, { OnMount, BeforeMount } from '@monaco-editor/react'
import type { editor, languages } from 'monaco-editor'
import type { CompileError } from '@/lib/compiler'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  errors?: CompileError[]
  readOnly?: boolean
}

// ISL language definition
const ISL_LANGUAGE_ID = 'isl'

const ISL_MONARCH_TOKENS: languages.IMonarchLanguage = {
  keywords: [
    'domain', 'type', 'behavior', 'pre', 'post', 'returns',
    'requires', 'ensures', 'invariant', 'given', 'when', 'then',
    'true', 'false', 'null', 'and', 'or', 'not', 'in', 'is',
    'with', 'exists', 'old', 'now'
  ],
  
  typeKeywords: [
    'string', 'number', 'boolean', 'void', 'any',
    'String', 'Number', 'Boolean', 'Int', 'Float'
  ],
  
  operators: [
    '=', '>', '<', '!', '~', '?', ':',
    '==', '<=', '>=', '!=', '&&', '||', '++', '--',
    '+', '-', '*', '/', '&', '|', '^', '%', '<<',
    '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
    '^=', '%=', '<<=', '>>=', '>>>='
  ],
  
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  
  tokenizer: {
    root: [
      // Identifiers and keywords
      [/[a-z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier'
        }
      }],
      [/[A-Z][\w$]*/, 'type.identifier'],
      
      // Whitespace
      { include: '@whitespace' },
      
      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      
      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      
      // Delimiter: after number because of .\d floats
      [/[;,.]/, 'delimiter'],
      
      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
    ],
    
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ],
    
    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],
    
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      ['\\*/', 'comment', '@pop'],
      [/[\/*]/, 'comment']
    ],
  },
}

const ISL_THEME: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
    { token: 'type', foreground: '267F99' },
    { token: 'type.identifier', foreground: '267F99' },
    { token: 'identifier', foreground: '001080' },
    { token: 'string', foreground: 'A31515' },
    { token: 'number', foreground: '098658' },
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    { token: 'operator', foreground: '000000' },
  ],
  colors: {
    'editor.background': '#ffffff',
  },
}

const ISL_COMPLETIONS: languages.CompletionItem[] = [
  {
    label: 'domain',
    kind: 14, // Keyword
    insertText: 'domain ${1:Name} "${2:description}" {\n  $0\n}',
    insertTextRules: 4, // InsertAsSnippet
    documentation: 'Define a new domain',
  },
  {
    label: 'type',
    kind: 14,
    insertText: 'type ${1:Name} {\n  ${2:field}: ${3:string}\n}',
    insertTextRules: 4,
    documentation: 'Define a new type',
  },
  {
    label: 'behavior',
    kind: 14,
    insertText: 'behavior ${1:Name} "${2:description}" (\n  ${3:param}: ${4:string}\n) returns ${5:Type} {\n  pre ${6:condition}: ${7:expression}\n  \n  post ${8:condition}: ${9:expression}\n}',
    insertTextRules: 4,
    documentation: 'Define a new behavior',
  },
  {
    label: 'pre',
    kind: 14,
    insertText: 'pre ${1:name}: ${2:condition}',
    insertTextRules: 4,
    documentation: 'Define a precondition',
  },
  {
    label: 'post',
    kind: 14,
    insertText: 'post ${1:name}: ${2:condition}',
    insertTextRules: 4,
    documentation: 'Define a postcondition',
  },
] as unknown as languages.CompletionItem[]

export function Editor({ value, onChange, errors = [], readOnly = false }: EditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco
    
    // Register ISL language
    monaco.languages.register({ id: ISL_LANGUAGE_ID })
    
    // Set tokenizer
    monaco.languages.setMonarchTokensProvider(ISL_LANGUAGE_ID, ISL_MONARCH_TOKENS)
    
    // Set theme
    monaco.editor.defineTheme('isl-theme', ISL_THEME)
    
    // Register completion provider
    monaco.languages.registerCompletionItemProvider(ISL_LANGUAGE_ID, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }
        
        return {
          suggestions: ISL_COMPLETIONS.map(item => ({
            ...item,
            range,
          })),
        }
      },
    })
    
    // Register hover provider
    monaco.languages.registerHoverProvider(ISL_LANGUAGE_ID, {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null
        
        const hovers: Record<string, string> = {
          domain: 'Defines a domain - a bounded context with types and behaviors',
          type: 'Defines a data type with fields',
          behavior: 'Defines a behavior with preconditions and postconditions',
          pre: 'Precondition - must be true before the behavior executes',
          post: 'Postcondition - must be true after the behavior executes',
          requires: 'Alias for pre - defines a precondition',
          ensures: 'Alias for post - defines a postcondition',
          returns: 'Specifies the return type of a behavior',
        }
        
        const content = hovers[word.word]
        if (!content) return null
        
        return {
          contents: [{ value: content }],
        }
      },
    })
  }, [])

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  // Update error markers
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return
    
    const model = editorRef.current.getModel()
    if (!model) return
    
    const markers: editor.IMarkerData[] = errors.map(error => ({
      severity: error.severity === 'error' 
        ? monacoRef.current!.MarkerSeverity.Error 
        : monacoRef.current!.MarkerSeverity.Warning,
      startLineNumber: error.location.line,
      startColumn: error.location.column,
      endLineNumber: error.location.line,
      endColumn: error.location.column + 10,
      message: error.message,
    }))
    
    monacoRef.current.editor.setModelMarkers(model, 'isl', markers)
  }, [errors])

  return (
    <MonacoEditor
      height="100%"
      language={ISL_LANGUAGE_ID}
      theme="isl-theme"
      value={value}
      onChange={(value) => onChange(value || '')}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        readOnly,
        renderValidationDecorations: 'on',
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  )
}
