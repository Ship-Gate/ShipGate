import { test, expect } from '@playwright/test';

test.describe('Three Big Lies Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/three-big-lies');
  });

  test('displays page correctly', async ({ page }) => {
    await expect(page.getByText('The 3 Biggest Lies AI Tells')).toBeVisible();
    await expect(page.getByText('And how ISL catches every single one')).toBeVisible();
    await expect(page.getByTestId('play-pause')).toBeVisible();
    await expect(page.getByTestId('next-step')).toBeVisible();
    await expect(page.getByTestId('restart')).toBeVisible();
  });

  test('shows play button initially', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Play Demo/i })).toBeVisible();
  });

  test('starts demo when play is clicked', async ({ page }) => {
    await page.getByTestId('play-pause').click();

    await expect(
      page.getByText(/The 3 biggest lies AI tells when generating code/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows Lie 1 code and gate result', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('next-step').click();
    await page.waitForTimeout(6000);

    await expect(page.getByTestId('three-lies-code')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('from.balance -= amount')).toBeVisible();

    await page.waitForTimeout(5000);

    await expect(page.getByTestId('gate-result')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('NO-SHIP')).toBeVisible();
  });

  test('can skip through all lies', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('next-step').click();
    await page.waitForTimeout(300);
    await page.getByTestId('next-step').click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Lie 2: Security')).toBeVisible({ timeout: 3000 });
  });

  test('can restart demo', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await page.waitForTimeout(2000);
    await page.getByTestId('restart').click();

    await expect(page.getByText('Step 1 /')).toBeVisible();
    await expect(page.getByRole('button', { name: /Play Demo/i })).toBeVisible();
  });

  test('shows summary at end', async ({ page }) => {
    await page.getByTestId('play-pause').click();

    for (let i = 0; i < 5; i++) {
      await page.getByTestId('next-step').click();
      await page.waitForTimeout(400);
    }

    await page.waitForTimeout(12000);

    await expect(page.getByText('3/3 lies caught')).toBeVisible({ timeout: 5000 });
  });
});

// Recording test - run with: pnpm demo:three-lies:record
test.describe('Three Big Lies Recording', () => {
  test('complete demo for video recording', async ({ page }) => {
    test.setTimeout(150000);

    await page.goto('/three-big-lies');
    await page.waitForTimeout(1000);

    await page.getByTestId('play-pause').click();

    await page.waitForTimeout(120000);
  });
});
