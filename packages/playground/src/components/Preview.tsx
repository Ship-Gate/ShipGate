'use client'

import MonacoEditor from '@monaco-editor/react'

interface PreviewProps {
  value: string
  language: string
}

const languageMap: Record<string, string> = {
  types: 'typescript',
  tests: 'typescript',
  docs: 'markdown',
  python: 'python',
  openapi: 'json',
}

export function Preview({ value, language }: PreviewProps) {
  const monacoLanguage = languageMap[language] || language

  return (
    <MonacoEditor
      height="100%"
      language={monacoLanguage}
      theme="vs"
      value={value}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  )
}
