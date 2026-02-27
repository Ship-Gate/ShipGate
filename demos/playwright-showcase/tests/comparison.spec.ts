import { test, expect } from '@playwright/test';

test.describe('Comparison Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/comparison');
  });

  test('displays comparison page correctly', async ({ page }) => {
    await expect(page.getByTestId('comparison-title')).toBeVisible();
    await expect(page.getByTestId('domain-auth')).toBeVisible();
    await expect(page.getByTestId('domain-payments')).toBeVisible();
  });

  test('shows side-by-side comparison', async ({ page }) => {
    // Wait for data to load
    await expect(page.getByTestId('regular-ai-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('isl-studio-panel')).toBeVisible();
  });

  test('regular AI panel shows security issues', async ({ page }) => {
    await expect(page.getByTestId('regular-ai-panel')).toBeVisible({ timeout: 5000 });
    
    // Should show issues
    await expect(page.getByTestId('issue-0')).toBeVisible();
    
    // Should have red border/styling
    await expect(page.getByTestId('regular-ai-panel')).toHaveClass(/red-500/);
  });

  test('ISL Studio panel shows verified features', async ({ page }) => {
    await expect(page.getByTestId('isl-studio-panel')).toBeVisible({ timeout: 5000 });
    
    // Should show security features
    await expect(page.getByTestId('feature-0')).toBeVisible();
    await expect(page.getByTestId('feature-1')).toBeVisible();
    
    // Should have green border/styling
    await expect(page.getByTestId('intentos-panel')).toHaveClass(/green-500/);
  });

  test('can switch to payments domain', async ({ page }) => {
    await page.getByTestId('domain-payments').click();
    
    // Wait for new data
    await page.waitForTimeout(500);
    
    // Should still show comparison panels
    await expect(page.getByTestId('regular-ai-panel')).toBeVisible();
    await expect(page.getByTestId('isl-studio-panel')).toBeVisible();
  });

  test('shows summary statistics', async ({ page }) => {
    await expect(page.getByTestId('issues-found')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('issues-fixed')).toBeVisible();
    await expect(page.getByTestId('score-improvement')).toBeVisible();
  });

  test('trust scores show difference', async ({ page }) => {
    await expect(page.getByTestId('regular-ai-panel')).toBeVisible({ timeout: 5000 });
    
    // Both panels should have trust scores
    const regularPanel = page.getByTestId('regular-ai-panel');
    const islStudioPanel = page.getByTestId('isl-studio-panel');
    
    await expect(regularPanel.getByTestId('trust-score')).toBeVisible();
    await expect(islStudioPanel.getByTestId('trust-score')).toBeVisible();
  });

  test('auth domain shows specific issues', async ({ page }) => {
    await expect(page.getByTestId('regular-ai-panel')).toBeVisible({ timeout: 5000 });
    
    // Check for auth-specific issues
    await expect(page.getByText('No email validation')).toBeVisible();
    await expect(page.getByText('plain text password')).toBeVisible();
  });

  test('payments domain shows specific issues', async ({ page }) => {
    await page.getByTestId('domain-payments').click();
    
    await expect(page.getByTestId('regular-ai-panel')).toBeVisible({ timeout: 5000 });
    
    // Wait for payment data
    await page.waitForTimeout(500);
    
    // Check for payments-specific issues
    await expect(page.getByText('Logging sensitive')).toBeVisible();
  });
});
