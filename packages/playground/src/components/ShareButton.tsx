'use client'

import { useState, useCallback } from 'react'
import { Share2, Link, Code2, Check, Copy } from 'lucide-react'
import { encodeShareUrl, copyToClipboard, generateEmbedCode } from '@/lib/share'
import { cn } from '@/lib/utils'
import type { OutputType } from './Toolbar'

interface ShareButtonProps {
  code: string
  outputType: OutputType
}

export function ShareButton({ code, outputType }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  const shareUrl = encodeShareUrl({ code, outputType })
  const embedCode = generateEmbedCode(shareUrl)

  const handleCopyLink = useCallback(async () => {
    const success = await copyToClipboard(shareUrl)
    if (success) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }, [shareUrl])

  const handleCopyEmbed = useCallback(async () => {
    const success = await copyToClipboard(embedCode)
    if (success) {
      setCopiedEmbed(true)
      setTimeout(() => setCopiedEmbed(false), 2000)
    }
  }, [embedCode])

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-lg shadow-lg z-50 p-4 space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Link className="h-4 w-4" />
                Share Link
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-muted rounded-md font-mono truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    'px-3 py-2 rounded-md transition-colors',
                    'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Embed Code
              </h4>
              <div className="relative">
                <pre className="px-3 py-2 text-xs bg-muted rounded-md font-mono overflow-auto max-h-24">
                  {embedCode}
                </pre>
                <button
                  onClick={handleCopyEmbed}
                  className={cn(
                    'absolute top-2 right-2 p-1.5 rounded transition-colors',
                    'bg-background/80 hover:bg-background'
                  )}
                >
                  {copiedEmbed ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
