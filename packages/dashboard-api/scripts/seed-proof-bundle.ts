#!/usr/bin/env npx tsx
/**
 * Seed the dashboard with a sample proof bundle.
 * Run from repo root: pnpm --filter @isl-lang/dashboard-api exec tsx scripts/seed-proof-bundle.ts
 * Or from packages/dashboard-api: npx tsx scripts/seed-proof-bundle.ts
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, saveDatabase } from '../src/db/schema.js'
import { createQueries } from '../src/db/queries.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SAMPLE_PATH = resolve(__dirname, '../../examples/proof-bundle-sample.json')

async function main() {
  const dbPath = process.env['DATABASE_PATH'] || resolve(process.cwd(), 'shipgate.db')
  const db = await openDatabase(dbPath)

  const content = readFileSync(SAMPLE_PATH, 'utf-8')
  const proofBundle = JSON.parse(content)

  const queries = createQueries(db)
  const reportInput = {
    repo: 'example/repo',
    branch: 'main',
    commit: 'abc123def456',
    verdict: 'NO_SHIP' as const,
    score: 42,
    coverage: { specced: 0, total: 1, percentage: 0 },
    files: [
      {
        path: 'src/auth/login.ts',
        verdict: 'fail' as const,
        method: 'isl' as const,
        score: 0,
        violations: ['auth:login:credential-check'],
      },
    ],
    duration: 0,
    triggeredBy: 'cli' as const,
  }

  const report = queries.insertReportWithProofBundle(reportInput, proofBundle)
  saveDatabase(db, dbPath)
  db.close()

  console.log(`Ingested proof bundle. Run ID: ${report.id}`)
  console.log(`View at: http://localhost:3700 (ensure API is running)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
