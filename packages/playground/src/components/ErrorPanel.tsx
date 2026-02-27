'use client'

import { AlertCircle, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CompileError } from '@/lib/compiler'

interface ErrorPanelProps {
  errors: CompileError[]
  warnings?: CompileError[]
  onErrorClick?: (error: CompileError) => void
  onClose?: () => void
}

export function ErrorPanel({ errors, warnings = [], onErrorClick, onClose }: ErrorPanelProps) {
  const allIssues = [
    ...errors.map(e => ({ ...e, type: 'error' as const })),
    ...warnings.map(w => ({ ...w, type: 'warning' as const })),
  ]

  if (allIssues.length === 0) return null

  return (
    <div className="border-t bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-4 text-sm">
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            aria-label="Close error panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="max-h-32 overflow-auto">
        {allIssues.map((issue, index) => (
          <button
            key={index}
            onClick={() => onErrorClick?.(issue)}
            className={cn(
              'w-full text-left px-4 py-2 text-sm hover:bg-muted/50 flex items-start gap-2 border-b last:border-b-0',
              issue.type === 'error' ? 'text-red-600' : 'text-yellow-600'
            )}
          >
            {issue.type === 'error' ? (
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <span className="flex-1">
              <span className="font-mono text-xs text-muted-foreground mr-2">
                Ln {issue.location.line}, Col {issue.location.column}
              </span>
              {issue.message}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
