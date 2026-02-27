import { test, expect } from '@playwright/test';

test.describe('Pipeline Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pipeline');
  });

  test('displays pipeline page correctly', async ({ page }) => {
    await expect(page.getByTestId('pipeline-title')).toBeVisible();
    await expect(page.getByTestId('step-indicator')).toBeVisible();
    await expect(page.getByTestId('intent-input')).toBeVisible();
    await expect(page.getByTestId('run-pipeline')).toBeVisible();
  });

  test('can select example prompts', async ({ page }) => {
    const exampleButton = page.getByTestId('example-prompt-0');
    await exampleButton.click();
    
    const input = page.getByTestId('intent-input');
    await expect(input).not.toBeEmpty();
  });

  test('runs the full pipeline for counter', async ({ page }) => {
    // Enter intent
    const input = page.getByTestId('intent-input');
    await input.fill('Create a counter that increments and decrements, but never goes negative');
    
    // Run pipeline
    await page.getByTestId('run-pipeline').click();
    
    // Wait for ISL output
    await expect(page.getByTestId('isl-output')).toBeVisible({ timeout: 10000 });
    
    // Wait for code output
    await expect(page.getByTestId('code-output')).toBeVisible({ timeout: 10000 });
    
    // Wait for verification results
    await expect(page.getByTestId('verification-results')).toBeVisible({ timeout: 15000 });
    
    // Check trust score is displayed
    await expect(page.getByTestId('trust-score')).toBeVisible();
  });

  test('runs pipeline for authentication', async ({ page }) => {
    const input = page.getByTestId('intent-input');
    await input.fill('Build user authentication with email/password login');
    
    await page.getByTestId('run-pipeline').click();
    
    // Wait for completion
    await expect(page.getByTestId('verification-results')).toBeVisible({ timeout: 15000 });
    
    // Verify rate limiting check appears for auth
    const rateLimitCheck = page.getByTestId('verification-rate-limiting');
    await expect(rateLimitCheck).toBeVisible();
  });

  test('runs pipeline for payments', async ({ page }) => {
    const input = page.getByTestId('intent-input');
    await input.fill('Implement a payment processor with card validation');
    
    await page.getByTestId('run-pipeline').click();
    
    // Wait for completion
    await expect(page.getByTestId('verification-results')).toBeVisible({ timeout: 15000 });
    
    // Verify PCI compliance check appears for payments
    const pciCheck = page.getByTestId('verification-pci-compliance');
    await expect(pciCheck).toBeVisible();
  });

  test('can reset the pipeline', async ({ page }) => {
    const input = page.getByTestId('intent-input');
    await input.fill('Test input');
    
    await page.getByTestId('reset-pipeline').click();
    
    await expect(input).toHaveValue('');
  });

  test('step indicator updates during pipeline', async ({ page }) => {
    const input = page.getByTestId('intent-input');
    await input.fill('Create a counter');
    
    await page.getByTestId('run-pipeline').click();
    
    // Initial step should become active
    await expect(page.getByTestId('step-input')).toHaveAttribute('data-status', 'completed', { timeout: 5000 });
    
    // Parse step should complete
    await expect(page.getByTestId('step-parse')).toHaveAttribute('data-status', 'completed', { timeout: 10000 });
  });
});
