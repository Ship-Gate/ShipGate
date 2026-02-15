import { SummaryStrip } from '@/components/dashboard/summary-strip';
import { TeamPanel } from '@/components/dashboard/team-panel';
import { Timeline } from '@/components/dashboard/timeline';

export default function TeamPage() {
  return (
    <>
      <SummaryStrip />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <TeamPanel />
        <Timeline />
      </div>
    </>
  );
}
