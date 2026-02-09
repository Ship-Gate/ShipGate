/**
 * Open Billing - URL handlers for billing and upgrade flows
 * 
 * Provides methods to open billing-related URLs in the user's browser.
 */

import * as vscode from 'vscode';

// ============================================================================
// Constants
// ============================================================================

const BILLING_BASE_URL = 'https://app.shipgateai.dev';

export const BillingUrls = {
  BILLING: `${BILLING_BASE_URL}/billing`,
  PLANS: `${BILLING_BASE_URL}/plans`,
  UPGRADE: `${BILLING_BASE_URL}/upgrade`,
  CHECKOUT: `${BILLING_BASE_URL}/checkout`,
  PORTAL: `${BILLING_BASE_URL}/portal`,
  CONTACT: `${BILLING_BASE_URL}/contact`,
} as const;

// ============================================================================
// Open Billing
// ============================================================================

/**
 * Open the billing page in the default browser
 */
export async function openBilling(): Promise<boolean> {
  return openUrl(BillingUrls.BILLING);
}

/**
 * Open the plans/pricing page
 */
export async function openPlans(): Promise<boolean> {
  return openUrl(BillingUrls.PLANS);
}

/**
 * Open the upgrade flow
 */
export async function openUpgrade(source?: string): Promise<boolean> {
  const url = source
    ? `${BillingUrls.UPGRADE}?source=${encodeURIComponent(source)}`
    : BillingUrls.UPGRADE;
  return openUrl(url);
}

/**
 * Open the checkout page with optional plan pre-selected
 */
export async function openCheckout(plan?: 'pro' | 'team'): Promise<boolean> {
  const url = plan
    ? `${BillingUrls.CHECKOUT}?plan=${plan}`
    : BillingUrls.CHECKOUT;
  return openUrl(url);
}

/**
 * Open the customer portal for existing subscribers
 */
export async function openPortal(): Promise<boolean> {
  return openUrl(BillingUrls.PORTAL);
}

/**
 * Open the contact/sales page
 */
export async function openContact(): Promise<boolean> {
  return openUrl(BillingUrls.CONTACT);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Open a URL in the default browser
 */
async function openUrl(url: string): Promise<boolean> {
  try {
    const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
    return opened;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open ${url}`);
    return false;
  }
}

/**
 * Create a billing command handler
 */
export function createBillingCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('isl.openBilling', openBilling);
}

/**
 * Create an upgrade command handler with source tracking
 */
export function createUpgradeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('isl.upgrade', (source?: string) => {
    return openUpgrade(source);
  });
}
