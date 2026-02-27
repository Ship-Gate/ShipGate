import SummaryCards from '@/components/dashboard/summary-cards';
import ReposTable from '@/components/dashboard/repos-table';
import RecentScans from '@/components/dashboard/recent-scans';
import TeamActivity from '@/components/dashboard/team-activity';
import CompliancePanel from '@/components/dashboard/compliance-panel';
import ProofPreview from '@/components/dashboard/proof-preview';
import ProvenancePanel from '@/components/dashboard/provenance-panel';
import { DomainCard } from '@/components/shared/DomainCard';
import { VerificationCard } from '@/components/shared/VerificationCard';

export default function DashboardPage() {
  return (
    <>
      <SummaryCards />
      
      {/* ISL Dashboard Elements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DomainCard domain={{
              id: '1',
              name: 'acme-api',
              description: 'Main API domain for ACME platform',
              behaviorCount: 12,
              lastVerified: '2024-02-14T10:30:00Z',
              trustScore: 0.95,
              status: 'verified'
            }} />
            <VerificationCard verification={{
              id: '1',
              domainId: '1',
              domainName: 'acme-api',
              timestamp: '2024-02-14T10:30:00Z',
              duration: 2340,
              verdict: 'pass',
              trustScore: 0.95,
              coverage: {
                behaviors: 12,
                totalBehaviors: 12,
                preconditions: 24,
                totalPreconditions: 24,
                postconditions: 36,
                totalPostconditions: 36
              },
              results: []
            }} />
          </div>
        </div>
        <div>
          <div className="bg-sg-bg1 border border-sg-border rounded-card p-4">
            <h3 className="text-sm font-semibold text-sg-text0 mb-3">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-sg-text2">Active Domains</span>
                <span className="text-sg-text0 font-medium">4</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sg-text2">Avg Trust Score</span>
                <span className="text-sg-ship font-medium">85%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sg-text2">Recent Verifications</span>
                <span className="text-sg-text0 font-medium">12</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="flex flex-col gap-4">
          <ReposTable />
          <RecentScans />
          <TeamActivity />
        </div>
        
        <div className="flex flex-col gap-4">
          <CompliancePanel />
          <ProofPreview />
          <ProvenancePanel />
        </div>
      </div>
    </>
  );
}
