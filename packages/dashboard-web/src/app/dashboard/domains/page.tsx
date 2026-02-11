'use client'

import { DomainCard, DomainCardSkeleton } from '@/components/DomainCard'
import { useDomains } from '@/hooks/useApi'

export default function DomainsPage() {
  const { data: domains, loading } = useDomains()

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
        <p className="text-muted-foreground">
          Behavioral domains and their verification status
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [...Array(6)].map((_, i) => <DomainCardSkeleton key={i} />)
          : domains?.map((domain) => (
              <DomainCard key={domain.id} domain={domain} />
            ))
        }
      </div>

      {!loading && domains?.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>No domains yet</p>
          <p className="text-sm mt-1">
            Add domains via the CLI or connect your repositories to get started.
          </p>
        </div>
      )}
    </div>
  )
}
