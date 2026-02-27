import LZString from 'lz-string'

export interface ShareData {
  code: string
  outputType?: string
  version?: number
}

const SHARE_VERSION = 1

export function encodeShareUrl(data: ShareData): string {
  const payload = JSON.stringify({
    ...data,
    version: SHARE_VERSION,
  })
  
  const compressed = LZString.compressToEncodedURIComponent(payload)
  
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?code=${compressed}`
  }
  
  return `?code=${compressed}`
}

export function decodeShareUrl(url: string): ShareData | null {
  try {
    const urlObj = new URL(url, 'http://localhost')
    const code = urlObj.searchParams.get('code')
    
    if (!code) return null
    
    const decompressed = LZString.decompressFromEncodedURIComponent(code)
    if (!decompressed) return null
    
    const data = JSON.parse(decompressed) as ShareData
    return data
  } catch {
    return null
  }
}

export function getShareDataFromUrl(): ShareData | null {
  if (typeof window === 'undefined') return null
  
  return decodeShareUrl(window.location.href)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

export function generateEmbedCode(shareUrl: string, options?: { width?: string; height?: string }): string {
  const width = options?.width || '100%'
  const height = options?.height || '500px'
  
  return `<iframe
  src="${shareUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="clipboard-write"
  title="IntentOS Playground"
></iframe>`
}
