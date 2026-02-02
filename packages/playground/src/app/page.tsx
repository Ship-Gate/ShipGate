'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Github, ExternalLink } from 'lucide-react'
import { parse, check, type CompileError } from '@/lib/compiler'
import { generateTypes, generateTests, generateDocs, generatePython, generateOpenAPI } from '@/lib/generator'
import { getShareDataFromUrl } from '@/lib/share'
import { EXAMPLES, type ExampleKey } from '@/examples'
import { Toolbar, type OutputType } from '@/components/Toolbar'
import { ErrorPanel } from '@/components/ErrorPanel'
import { Examples } from '@/components/Examples'
import { ShareButton } from '@/components/ShareButton'

// Dynamic import for Monaco to avoid SSR issues
const Editor = dynamic(() => import('@/components/Editor').then(mod => ({ default: mod.Editor })), {
  ssr: false,
  loading: () => <div className="h-full bg-muted animate-pulse" />,
})

const Preview = dynamic(() => import('@/components/Preview').then(mod => ({ default: mod.Preview })), {
  ssr: false,
  loading: () => <div className="h-full bg-muted animate-pulse" />,
})

export default function PlaygroundPage() {
  const [code, setCode] = useState<string>(EXAMPLES.auth.code)
  const [output, setOutput] = useState('')
  const [errors, setErrors] = useState<CompileError[]>([])
  const [warnings, setWarnings] = useState<CompileError[]>([])
  const [outputType, setOutputType] = useState<OutputType>('types')
  const [currentExample, setCurrentExample] = useState<ExampleKey | undefined>('auth')

  // Load from URL on mount
  useEffect(() => {
    const shareData = getShareDataFromUrl()
    if (shareData) {
      setCode(shareData.code)
      if (shareData.outputType) {
        setOutputType(shareData.outputType as OutputType)
      }
      setCurrentExample(undefined)
    }
  }, [])

  // Compile and generate output
  const compile = useCallback(() => {
    const parseResult = parse(code)
    
    if (!parseResult.success || !parseResult.domain) {
      setErrors(parseResult.errors)
      setWarnings([])
      setOutput('')
      return
    }
    
    const checkResult = check(parseResult.domain)
    setErrors(checkResult.errors)
    setWarnings(checkResult.warnings)
    
    if (!checkResult.success) {
      setOutput('')
      return
    }
    
    const domain = parseResult.domain
    
    switch (outputType) {
      case 'types':
        setOutput(generateTypes(domain))
        break
      case 'tests':
        setOutput(generateTests(domain))
        break
      case 'docs':
        setOutput(generateDocs(domain))
        break
      case 'python':
        setOutput(generatePython(domain))
        break
      case 'openapi':
        setOutput(generateOpenAPI(domain))
        break
    }
  }, [code, outputType])

  // Debounced compilation
  useEffect(() => {
    const timeout = setTimeout(compile, 300)
    return () => clearTimeout(timeout)
  }, [compile])

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode)
    setCurrentExample(undefined)
  }, [])

  const handleExampleSelect = useCallback((exampleCode: string) => {
    setCode(exampleCode)
    // Find which example this is
    const example = (Object.keys(EXAMPLES) as ExampleKey[]).find(
      key => EXAMPLES[key].code === exampleCode
    )
    setCurrentExample(example)
  }, [])

  const handleErrorClick = useCallback((error: CompileError) => {
    // In a full implementation, this would focus the editor on the error line
  }, [])

  const outputLanguage = useMemo(() => {
    switch (outputType) {
      case 'types':
      case 'tests':
        return 'typescript'
      case 'docs':
        return 'markdown'
      case 'python':
        return 'python'
      case 'openapi':
        return 'json'
      default:
        return 'typescript'
    }
  }, [outputType])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2 font-bold text-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-primary"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>ISL Playground</span>
          </a>
          
          <div className="h-6 w-px bg-border" />
          
          <Examples onSelect={handleExampleSelect} currentExample={currentExample} />
        </div>

        <div className="flex items-center gap-3">
          <ShareButton code={code} outputType={outputType} />
          
          <a
            href="https://github.com/intentos/intentos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Docs</span>
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex min-h-0">
          {/* Editor Panel */}
          <div className="w-1/2 border-r flex flex-col min-h-0">
            <div className="h-10 border-b bg-muted/30 flex items-center px-4">
              <span className="text-sm font-medium text-muted-foreground">ISL Source</span>
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                value={code}
                onChange={handleCodeChange}
                errors={errors}
              />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="h-10 border-b bg-muted/30 flex items-center justify-between px-4">
              <Toolbar
                outputType={outputType}
                onOutputTypeChange={setOutputType}
                output={output}
              />
            </div>
            <div className="flex-1 min-h-0">
              <Preview value={output} language={outputLanguage} />
            </div>
          </div>
        </div>

        {/* Error Panel */}
        <ErrorPanel
          errors={errors}
          warnings={warnings}
          onErrorClick={handleErrorClick}
        />
      </div>

      {/* Footer */}
      <footer className="h-8 border-t bg-muted/30 flex items-center justify-between px-4 text-xs text-muted-foreground flex-shrink-0">
        <span>IntentOS Playground v0.1.0</span>
        <span>
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">Ctrl+S</kbd> to format
        </span>
      </footer>
    </div>
  )
}
