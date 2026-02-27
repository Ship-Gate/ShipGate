'use client';

import { useProjects } from '@/hooks/use-data';
import { TableSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';

export default function ReposTable() {
  const { data, isLoading, error, refetch } = useProjects();

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
        <div className="text-lg font-semibold text-sg-text0 mb-4">Projects</div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!data || data.length === 0) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
        <EmptyState title="No Projects" description="Run your first scan to create a project." />
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-sg-text0">Projects</h2>
        <span className="text-xs text-sg-text3">{data.length} total</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sg-border">
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Name</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Repo</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Runs</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Created</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((project) => (
              <tr
                key={project.id}
                className="border-b border-sg-border/50 hover:bg-sg-bg2 transition-colors"
              >
                <td className="py-3">
                  <div className="text-[13px] text-sg-text0 font-medium">{project.name}</div>
                </td>
                <td className="py-3">
                  <div className="text-[11px] text-sg-text3 font-mono truncate max-w-[200px]">
                    {project.repoUrl ?? '—'}
                  </div>
                </td>
                <td className="py-3">
                  <div className="text-[13px] font-mono text-sg-text0">{project.runCount}</div>
                </td>
                <td className="py-3">
                  <div className="text-[11px] text-sg-text3">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
