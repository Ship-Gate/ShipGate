/**
 * Dispatch Slack notifications for run/finding events based on org notification rules.
 * Fire-and-forget: failures are logged but do not affect the main request.
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const SLACK_API = 'https://slack.com/api/chat.postMessage';

export type SlackEvent = 'run.completed' | 'verdict.no_ship' | 'finding.critical';

export interface RunCompletedPayload {
  runId: string;
  projectName?: string;
  verdict?: string | null;
  score?: number | null;
}

export interface FindingCriticalPayload {
  runId: string;
  projectName?: string;
  count: number;
  titles?: string[];
}

/**
 * Post a message to a Slack channel using the connection's bot token.
 */
async function postToSlack(
  accessToken: string,
  channelId: string,
  text: string
): Promise<boolean> {
  const res = await fetch(SLACK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ channel: channelId, text }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { ok?: boolean };
  return data.ok === true;
}

/**
 * Load enabled rules for org + event and the connection token, then notify each channel.
 */
export async function dispatchSlackNotifications(
  orgId: string,
  event: SlackEvent,
  payload: RunCompletedPayload | FindingCriticalPayload
): Promise<void> {
  const conn = await prisma.slackConnection.findFirst({
    where: { orgId },
    include: {
      notifications: {
        where: { event, enabled: true },
      },
    },
  });

  if (!conn || conn.notifications.length === 0) return;

  let token: string;
  try {
    token = decrypt(conn.accessToken);
  } catch {
    return;
  }

  const text = formatMessage(event, payload);

  await Promise.allSettled(
    conn.notifications.map((rule) =>
      postToSlack(token, rule.channelId, text)
    )
  );
}

function formatMessage(
  event: SlackEvent,
  payload: RunCompletedPayload | FindingCriticalPayload
): string {
  switch (event) {
    case 'run.completed': {
      const p = payload as RunCompletedPayload;
      const proj = p.projectName ? ` (${p.projectName})` : '';
      const verdict = p.verdict ?? '—';
      const score = p.score != null ? ` Score: ${p.score}` : '';
      return `ShipGate: Run completed${proj}\nVerdict: ${verdict}${score}\nRun ID: ${p.runId}`;
    }
    case 'verdict.no_ship': {
      const p = payload as RunCompletedPayload;
      const proj = p.projectName ? ` (${p.projectName})` : '';
      return `ShipGate: NO_SHIP verdict${proj}\nRun ID: ${p.runId}`;
    }
    case 'finding.critical': {
      const p = payload as FindingCriticalPayload;
      const proj = p.projectName ? ` (${p.projectName})` : '';
      const titles = p.titles?.length
        ? `\n${p.titles.slice(0, 5).map((t) => `• ${t}`).join('\n')}`
        : '';
      return `ShipGate: ${p.count} critical finding(s)${proj}${titles}\nRun ID: ${p.runId}`;
    }
    default:
      return `ShipGate: ${event}`;
  }
}
