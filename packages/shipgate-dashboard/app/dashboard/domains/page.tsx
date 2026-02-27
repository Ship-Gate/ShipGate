'use client';

import Link from 'next/link';
import { useProjects } from '@/hooks/use-data';
import { EmptyState } from '@/components/shared/empty-state';
import { CardSkeleton } from '@/components/shared/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function DomainsPage() {
  const { data: projects, isLoading, error } = useProjects();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">Domains</h1>
          <p className="text-sm text-sg-text3 mt-1">Projects (domains) and their verification status</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">Domains</h1>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-8">
          <p className="text-sg-text3">{error}</p>
        </div>
      </div>
    );
  }

  const list = projects ?? [];

  if (list.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">Domains</h1>
          <p className="text-sm text-sg-text3 mt-1">Projects (domains) and their verification status</p>
        </div>
        <EmptyState
          title="No projects"
          description="No projects. Connect a repo or run a scan."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-sg-text0">Domains</h1>
        <p className="text-sm text-sg-text3 mt-1">Projects (domains) and their verification status</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((project) => (
          <Link key={project.id} href={`/dashboard/runs?projectId=${project.id}`}>
            <Card className="bg-sg-bg1 border border-sg-border rounded-xl p-5 transition-colors hover:border-sg-accent/50">
              <CardContent className="p-0">
                <h3 className="text-base font-semibold text-sg-text0 mb-2">{project.name}</h3>
                {project.repoUrl ? (
                  <p className="text-xs text-sg-text3 truncate mb-3" title={project.repoUrl}>
                    {project.repoUrl}
                  </p>
                ) : (
                  <p className="text-xs text-sg-text3 mb-3">—</p>
                )}
                <div className="flex items-center gap-4 text-xs text-sg-text2">
                  <span>{project.runCount} runs</span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
