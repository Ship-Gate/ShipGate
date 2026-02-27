'use client'

import { cn } from '@/lib/utils'
import { FileCode, FileText, TestTube, BookOpen, Braces, Copy, Check } from 'lucide-react'
import { useState, useCallback } from 'react'
import { copyToClipboard } from '@/lib/share'

export type OutputType = 'types' | 'tests' | 'docs' | 'python' | 'openapi'

interface ToolbarProps {
  outputType: OutputType
  onOutputTypeChange: (type: OutputType) => void
  output: string
}

const outputOptions: { value: OutputType; label: string; icon: React.ReactNode }[] = [
  { value: 'types', label: 'TypeScript', icon: <FileCode className="h-4 w-4" /> },
  { value: 'python', label: 'Python', icon: <FileText className="h-4 w-4" /> },
  { value: 'tests', label: 'Tests', icon: <TestTube className="h-4 w-4" /> },
  { value: 'docs', label: 'Docs', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'openapi', label: 'OpenAPI', icon: <Braces className="h-4 w-4" /> },
]

export function Toolbar({ outputType, onOutputTypeChange, output }: ToolbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(output)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [output])

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg">
      {outputOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onOutputTypeChange(option.value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
            outputType === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
      
      <div className="w-px h-6 bg-border mx-1" />
      
      <button
        onClick={handleCopy}
        disabled={!output}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-background/50',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        title="Copy to clipboard"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="hidden sm:inline">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copy</span>
          </>
        )}
      </button>
    </div>
  )
}
