import { test, expect } from '@playwright/test';

test.describe('Live API Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-api');
  });

  test('displays live API page correctly', async ({ page }) => {
    await expect(page.getByTestId('live-api-title')).toBeVisible();
    await expect(page.getByTestId('endpoint-register')).toBeVisible();
    await expect(page.getByTestId('endpoint-charge')).toBeVisible();
    await expect(page.getByTestId('request-body')).toBeVisible();
  });

  test('can switch between endpoints', async ({ page }) => {
    // Default is register
    await expect(page.getByTestId('endpoint-register')).toHaveClass(/intent-600/);
    
    // Click charge endpoint
    await page.getByTestId('endpoint-charge').click();
    await expect(page.getByTestId('endpoint-charge')).toHaveClass(/intent-600/);
    
    // Request body should update
    const requestBody = page.getByTestId('request-body');
    await expect(requestBody).toContainText('amount');
    await expect(requestBody).toContainText('card');
  });

  test('sends register request and shows verification', async ({ page }) => {
    // Use default register endpoint with valid data
    await page.getByTestId('send-request').click();
    
    // Wait for response
    await expect(page.getByTestId('verification-response')).toBeVisible({ timeout: 5000 });
    
    // Check preconditions are shown
    await expect(page.getByTestId('precondition-0')).toBeVisible();
    await expect(page.getByTestId('precondition-1')).toBeVisible();
    
    // Check postconditions are shown
    await expect(page.getByTestId('postcondition-0')).toBeVisible();
  });

  test('sends register request with invalid email', async ({ page }) => {
    // Modify request body to have invalid email
    const requestBody = page.getByTestId('request-body');
    await requestBody.fill(JSON.stringify({
      email: 'invalid-email',
      password: 'securePass123'
    }, null, 2));
    
    await page.getByTestId('send-request').click();
    
    // Wait for response
    await expect(page.getByTestId('verification-response')).toBeVisible({ timeout: 5000 });
    
    // First precondition should fail (email validation)
    const precondition = page.getByTestId('precondition-0');
    await expect(precondition).toBeVisible();
  });

  test('sends charge request and shows security checks', async ({ page }) => {
    // Switch to charge endpoint
    await page.getByTestId('endpoint-charge').click();
    
    await page.getByTestId('send-request').click();
    
    // Wait for response
    await expect(page.getByTestId('verification-response')).toBeVisible({ timeout: 5000 });
    
    // Check security verification is shown
    await expect(page.getByTestId('security-0')).toBeVisible();
    await expect(page.getByTestId('security-1')).toBeVisible();
  });

  test('displays trust score after request', async ({ page }) => {
    await page.getByTestId('send-request').click();
    
    // Wait for response
    await expect(page.getByTestId('verification-response')).toBeVisible({ timeout: 5000 });
    
    // Trust score should be visible
    await expect(page.getByTestId('trust-score')).toBeVisible();
  });

  test('shows ISL contract for each endpoint', async ({ page }) => {
    // Check register contract is displayed
    await expect(page.getByText('behavior register')).toBeVisible();
    
    // Switch to charge
    await page.getByTestId('endpoint-charge').click();
    
    // Check charge contract is displayed
    await expect(page.getByText('behavior charge')).toBeVisible();
    await expect(page.getByText('sensitive:')).toBeVisible();
  });
});
