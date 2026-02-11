'use client'

import { useVerifications } from '@/hooks/useApi'
import { VerificationCard, VerificationCardSkeleton } from '@/components/VerificationCard'

export default function VerificationsPage() {
  const { data: verifications, loading } = useVerifications()

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verifications</h1>
        <p className="text-muted-foreground">
          Run history and verification results across all domains
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [...Array(6)].map((_, i) => <VerificationCardSkeleton key={i} />)
          : verifications?.map((verification) => (
              <VerificationCard key={verification.id} verification={verification} />
            ))
        }
      </div>

      {!loading && verifications?.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>No verifications yet</p>
          <p className="text-sm mt-1">
            Run verifications from the Domains page to see results here.
          </p>
        </div>
      )}
    </div>
  )
}
