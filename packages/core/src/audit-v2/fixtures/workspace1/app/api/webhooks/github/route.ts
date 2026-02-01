/**
 * GitHub Webhook Handler
 * 
 * Sample webhook handler WITHOUT signature verification - should be flagged.
 */

import { NextResponse } from 'next/server';

// Webhook handler WITHOUT signature verification - should be flagged
export async function POST(request: Request) {
  const event = request.headers.get('x-github-event');
  const body = await request.json();

  // No signature verification here!
  // Should be flagged as webhook-without-signature

  switch (event) {
    case 'push':
      await handlePush(body);
      break;
    case 'pull_request':
      await handlePullRequest(body);
      break;
    case 'issues':
      await handleIssues(body);
      break;
    default:
      console.log(`Unhandled GitHub event: ${event}`);
  }

  return NextResponse.json({ ok: true });
}

async function handlePush(payload: unknown) {
  // Handle push event
}

async function handlePullRequest(payload: unknown) {
  // Handle PR event
}

async function handleIssues(payload: unknown) {
  // Handle issues event
}
