'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useIngestProofBundle } from '@/hooks/useApi'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { FileJson } from 'lucide-react'

export default function UploadProofBundlePage() {
  const router = useRouter()
  const { ingest, loading, error } = useIngestProofBundle()
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [commit, setCommit] = useState('')

  const validateAndIngest = useCallback(
    async (proofBundle: unknown) => {
      setFileError(null)
      if (
        !proofBundle ||
        typeof proofBundle !== 'object' ||
        !('schemaVersion' in proofBundle) ||
        proofBundle.schemaVersion !== '1.0.0'
      ) {
        setFileError('Invalid proof bundle: must have schemaVersion "1.0.0"')
        return
      }
      try {
        const report = await ingest({
          proofBundle,
          repo: repo || 'unknown',
          branch: branch || 'main',
          commit: commit || 'unknown',
          triggeredBy: 'manual',
        })
        router.push(`/runs/${report.id}`)
      } catch {
        // error state is set by the hook
      }
    },
    [ingest, repo, branch, commit, router]
  )

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string)
          validateAndIngest(json)
        } catch {
          setFileError('Invalid JSON file')
        }
      }
      reader.onerror = () => setFileError('Failed to read file')
      reader.readAsText(file)
    },
    [validateAndIngest]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile]
  )

  return (
    <div className="container py-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ingest Proof Bundle</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a proof bundle JSON file to add a run to the dashboard
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run metadata (optional)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Override repo, branch, and commit if not present in the bundle
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="repo" className="text-sm font-medium block mb-1">
              Repo
            </label>
            <Input
              id="repo"
              placeholder="owner/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              aria-label="Repository name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="branch" className="text-sm font-medium block mb-1">
                Branch
              </label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                aria-label="Branch name"
              />
            </div>
            <div>
              <label htmlFor="commit" className="text-sm font-medium block mb-1">
                Commit
              </label>
              <Input
                id="commit"
                placeholder="abc123..."
                value={commit}
                onChange={(e) => setCommit(e.target.value)}
                aria-label="Commit SHA"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proof bundle file</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag and drop a .json file or click to browse. Must comply with ProofBundleV1 schema.
          </p>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Select proof bundle JSON file"
            />
            <FileJson className="h-12 w-12 text-muted-foreground mb-4" aria-hidden />
            <p className="text-sm font-medium mb-1">Drop proof bundle here or click to browse</p>
            <p className="text-xs text-muted-foreground">JSON file with schemaVersion 1.0.0</p>
          </div>

          {(error || fileError) && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error?.message ?? fileError}
            </p>
          )}

          {loading && (
            <p className="mt-4 text-sm text-muted-foreground">Uploading and validating…</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
