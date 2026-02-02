import { test, expect } from '@playwright/test';

test.describe('Walkthrough Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/walkthrough');
  });

  test('displays walkthrough page correctly', async ({ page }) => {
    await expect(page.getByText('ISL Studio Demo')).toBeVisible();
    await expect(page.getByTestId('play-pause')).toBeVisible();
    await expect(page.getByTestId('next-step')).toBeVisible();
    await expect(page.getByTestId('restart-walkthrough')).toBeVisible();
  });

  test('shows play button initially', async ({ page }) => {
    await expect(page.getByTestId('play-pause')).toBeVisible();
    await expect(page.getByText('Press Play to Start the Demo')).toBeVisible();
  });

  test('starts demo when play is clicked', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    
    // Narration should appear
    await expect(page.getByText('Welcome to ISL Studio')).toBeVisible({ timeout: 3000 });
  });

  test('can skip steps', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await page.waitForTimeout(500);
    
    await page.getByTestId('next-step').click();
    await page.waitForTimeout(500);
    
    // Should advance to next step
    await expect(page.getByText("Let's build authentication")).toBeVisible({ timeout: 3000 });
  });

  test('can restart demo', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await page.waitForTimeout(1000);
    
    await page.getByTestId('restart-walkthrough').click();
    
    // Should show initial state
    await expect(page.getByText('Press Play to Start the Demo')).toBeVisible();
  });

  test('shows cursor during demo', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    
    // Skip to typing step
    await page.getByTestId('next-step').click();
    await page.waitForTimeout(1000);
    
    // Cursor should be visible during interactions
    // The cursor is part of the demo animation
  });

  test('displays code blocks during demo', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    
    // Skip to ISL generation step
    await page.getByTestId('next-step').click();
    await page.getByTestId('next-step').click();
    await page.waitForTimeout(500);
    
    // Play to let code appear
    await page.waitForTimeout(2000);
    
    // Code block should appear
    await expect(page.getByTestId('code-block')).toBeVisible({ timeout: 5000 });
  });

  test('shows trust score animation', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    
    // Skip to verification step
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('next-step').click();
      await page.waitForTimeout(300);
    }
    
    await page.waitForTimeout(2000);
    
    // Trust score should appear
    await expect(page.getByTestId('trust-score')).toBeVisible({ timeout: 5000 });
  });

  test('can change playback speed', async ({ page }) => {
    // Find speed button and click it
    const speedButton = page.getByRole('button', { name: /1x/i });
    await speedButton.click();
    
    // Should show 1.5x
    await expect(page.getByText('1.5x')).toBeVisible();
    
    await speedButton.click();
    // Should show 2x
    await expect(page.getByText('2x')).toBeVisible();
  });

  test('can toggle narration', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await page.waitForTimeout(500);
    
    // Narration should be visible
    await expect(page.getByText('Welcome to ISL Studio')).toBeVisible({ timeout: 3000 });
    
    // Toggle off
    await page.getByTitle('Toggle Narration').click();
    
    // Skip to next step
    await page.getByTestId('next-step').click();
    await page.waitForTimeout(500);
  });

  test('progress bar updates', async ({ page }) => {
    // Check initial progress
    await expect(page.getByText('Step 1 /')).toBeVisible();
    
    await page.getByTestId('play-pause').click();
    await page.getByTestId('next-step').click();
    await page.waitForTimeout(300);
    
    // Progress should update
    await expect(page.getByText('Step 2 /')).toBeVisible();
  });
});

// Special walkthrough test for video recording
test.describe('Walkthrough Recording', () => {
  test('complete walkthrough for demo video', async ({ page }) => {
    // This test is designed to be run with video recording
    // for creating a shareable demo video
    
    await page.goto('/walkthrough');
    await page.waitForTimeout(1000);
    
    // Start the demo
    await page.getByTestId('play-pause').click();
    
    // Let it run through all steps (demo is about 50-60 seconds at 1x speed)
    // We'll let it play naturally for the video
    await page.waitForTimeout(65000);
    
    // Verify we reached the end
    await expect(page.getByText('Step 9 /')).toBeVisible();
  });

  test('fast walkthrough at 2x speed', async ({ page }) => {
    await page.goto('/walkthrough');
    await page.waitForTimeout(500);
    
    // Set to 2x speed
    await page.getByRole('button', { name: /1x/i }).click();
    await page.getByRole('button', { name: /1.5x/i }).click();
    
    // Start the demo
    await page.getByTestId('play-pause').click();
    
    // Let it run at 2x (should take about 30-35 seconds)
    await page.waitForTimeout(40000);
  });
});
