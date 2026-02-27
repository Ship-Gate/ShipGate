import { SummaryStrip } from '@/components/dashboard/summary-strip';
import { FindingsFeed } from '@/components/dashboard/findings-feed';
import { Timeline } from '@/components/dashboard/timeline';

export default function FindingsPage() {
  return (
    <>
      <SummaryStrip />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <FindingsFeed />
        <Timeline />
      </div>
    </>
  );
}
