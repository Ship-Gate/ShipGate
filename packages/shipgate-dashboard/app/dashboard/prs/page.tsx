import { SummaryStrip } from '@/components/dashboard/summary-strip';
import { PrMonitor } from '@/components/dashboard/pr-monitor';
import { FindingsFeed } from '@/components/dashboard/findings-feed';

export default function PrsPage() {
  return (
    <>
      <SummaryStrip />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <PrMonitor />
        <FindingsFeed />
      </div>
    </>
  );
}
