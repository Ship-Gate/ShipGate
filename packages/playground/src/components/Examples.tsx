'use client'

import { useState } from 'react'
import { ChevronDown, FileCode } from 'lucide-react'
import { EXAMPLES, type ExampleKey } from '@/examples'
import { cn } from '@/lib/utils'

interface ExamplesProps {
  onSelect: (code: string) => void
  currentExample?: ExampleKey
}

export function Examples({ onSelect, currentExample }: ExamplesProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (key: ExampleKey) => {
    onSelect(EXAMPLES[key].code)
    setIsOpen(false)
  }

  const currentName = currentExample ? EXAMPLES[currentExample].name : 'Select Example'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
          'border bg-background hover:bg-muted'
        )}
      >
        <FileCode className="h-4 w-4" />
        <span>{currentName}</span>
        <ChevronDown className={cn(
          'h-4 w-4 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 w-64 bg-popover border rounded-lg shadow-lg z-50 py-1">
            {(Object.keys(EXAMPLES) as ExampleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors',
                  currentExample === key && 'bg-muted'
                )}
              >
                <div className="font-medium">{EXAMPLES[key].name}</div>
                <div className="text-xs text-muted-foreground">
                  {EXAMPLES[key].description}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
