import { SummaryStrip } from '@/components/dashboard/summary-strip';
import { CicdPanel } from '@/components/dashboard/cicd-panel';
import { DeploymentGate } from '@/components/dashboard/deployment-gate';
import { Timeline } from '@/components/dashboard/timeline';
import { WebhookConfig } from '@/components/dashboard/webhook-config';

export default function CicdPage() {
  return (
    <>
      <SummaryStrip />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="flex flex-col gap-4">
          <CicdPanel />
          <WebhookConfig />
        </div>
        <div className="flex flex-col gap-4">
          <DeploymentGate />
          <Timeline />
        </div>
      </div>
    </>
  );
}
