'use client'

import { useState } from 'react'

interface Property {
  id: string
  name: string
  tier: 1 | 2 | 3
  description: string
  method: string
  confidence: 'definitive' | 'high' | 'medium'
  evidenceType: string
}

const properties: Property[] = [
  {
    id: 'import-integrity',
    name: 'Import Integrity',
    tier: 1,
    description: 'All imports resolve to real files or modules. Catches hallucinated imports from AI code generation.',
    method: 'static-ast-analysis',
    confidence: 'definitive',
    evidenceType: 'ImportEvidence[]',
  },
  {
    id: 'type-safety',
    name: 'Type Safety',
    tier: 1,
    description: 'TypeScript strict mode compiles without errors. Checks for any types, ts-ignore suppressions, and missing return types.',
    method: 'tsc-validation',
    confidence: 'definitive',
    evidenceType: 'TypeSafetyEvidence[]',
  },
  {
    id: 'auth-coverage',
    name: 'Auth Coverage',
    tier: 1,
    description: 'Protected API endpoints have authentication checks. Verifies auth middleware or session checks are applied.',
    method: 'static-ast-analysis',
    confidence: 'definitive',
    evidenceType: 'AuthEvidence[]',
  },
  {
    id: 'sql-injection',
    name: 'SQL Injection Prevention',
    tier: 1,
    description: 'Database queries use parameterized queries. Detects string concatenation in SQL and unsafe ORM usage.',
    method: 'pattern-matching',
    confidence: 'high',
    evidenceType: 'SQLEvidence[]',
  },
  {
    id: 'secret-exposure',
    name: 'Secret Exposure',
    tier: 1,
    description: 'No hardcoded secrets, API keys, or tokens. Uses pattern matching and entropy analysis.',
    method: 'pattern-matching',
    confidence: 'high',
    evidenceType: 'SecretEvidence[]',
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    tier: 2,
    description: 'Errors are caught and handled properly. No stack trace leaks, empty catch blocks, or unhandled promises.',
    method: 'static-ast-analysis',
    confidence: 'high',
    evidenceType: 'ErrorHandlingEvidence[]',
  },
  {
    id: 'xss-prevention',
    name: 'XSS Prevention',
    tier: 2,
    description: 'No unsafe HTML rendering or template interpolation. Checks for dangerouslySetInnerHTML and unescaped output.',
    method: 'pattern-matching',
    confidence: 'high',
    evidenceType: 'XSSEvidence[]',
  },
  {
    id: 'runtime-auth-blocking',
    name: 'Runtime Auth Blocking',
    tier: 3,
    description: 'Actually blocks unauthenticated HTTP requests. Starts the app and makes real HTTP calls.',
    method: 'runtime-http-test',
    confidence: 'definitive',
    evidenceType: 'RuntimeTestEvidence[]',
  },
]

export default function PropertiesPage() {
  const [selectedTier, setSelectedTier] = useState<number | 'all'>('all')

  const filteredProperties = selectedTier === 'all' 
    ? properties 
    : properties.filter(p => p.tier === selectedTier)

  return (
    <div className="prose max-w-none">
      <h1>Property Reference</h1>
      <p className="lead">
        Complete reference for all ISL Verify properties. Each property represents a specific security or correctness guarantee.
      </p>

      <div className="not-prose mb-8">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedTier('all')}
            className={`px-4 py-2 rounded-md transition ${
              selectedTier === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            All Properties
          </button>
          <button
            onClick={() => setSelectedTier(1)}
            className={`px-4 py-2 rounded-md transition ${
              selectedTier === 1
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Tier 1 (Critical)
          </button>
          <button
            onClick={() => setSelectedTier(2)}
            className={`px-4 py-2 rounded-md transition ${
              selectedTier === 2
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Tier 2 (Important)
          </button>
          <button
            onClick={() => setSelectedTier(3)}
            className={`px-4 py-2 rounded-md transition ${
              selectedTier === 3
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Tier 3 (Runtime)
          </button>
        </div>
      </div>

      <div className="not-prose space-y-6">
        {filteredProperties.map((property) => (
          <div key={property.id} className="border rounded-lg p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-semibold mb-1">{property.name}</h3>
                <code className="text-sm text-muted-foreground">{property.id}</code>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  Tier {property.tier}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  property.confidence === 'definitive'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                    : property.confidence === 'high'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                }`}>
                  {property.confidence}
                </span>
              </div>
            </div>
            
            <p className="text-muted-foreground mb-4">{property.description}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-1">Verification Method</div>
                <code className="text-xs bg-muted px-2 py-1 rounded">{property.method}</code>
              </div>
              <div>
                <div className="font-semibold mb-1">Evidence Type</div>
                <code className="text-xs bg-muted px-2 py-1 rounded">{property.evidenceType}</code>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Tier Definitions</h2>
        <ul className="space-y-2 text-sm">
          <li><strong>Tier 1 (Critical):</strong> Security and correctness properties. 10 points when PROVEN, 5 when PARTIAL.</li>
          <li><strong>Tier 2 (Important):</strong> Best practices and code quality. 5 points when PROVEN, 2 when PARTIAL.</li>
          <li><strong>Tier 3 (Runtime):</strong> Behavioral verification via HTTP testing. 3 points when PROVEN.</li>
        </ul>
      </div>
    </div>
  )
}
