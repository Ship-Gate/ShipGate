import SummaryCards from '@/components/dashboard/summary-cards';
import ReposTable from '@/components/dashboard/repos-table';
import RecentScans from '@/components/dashboard/recent-scans';
import TeamActivity from '@/components/dashboard/team-activity';
import CompliancePanel from '@/components/dashboard/compliance-panel';
import ProofPreview from '@/components/dashboard/proof-preview';
import ProvenancePanel from '@/components/dashboard/provenance-panel';

export default function NewDashboardPage() {
  return (
    <>
      <SummaryCards />
      
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
