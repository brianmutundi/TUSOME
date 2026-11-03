import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const hasCredentials = Boolean(EMAIL && PASSWORD);

async function signIn(page: Page) {
  await page.goto('/login?next=%2Fanalytics');
  await page.locator('#email').waitFor({ state: 'visible' });
  await page.locator('#email').fill(EMAIL!);
  await page.locator('#password').fill(PASSWORD!);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/analytics$/, { timeout: 30_000 });
}

test.describe('anonymous access', () => {
  test('homepage routes visitors to the sign-in gate', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login\?next=%2Fanalytics/);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('analytics dashboard is not readable without a session', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/login\?next=%2Fanalytics/);
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toHaveCount(0);
  });

  test('report cards are not readable without a session', async ({ page }) => {
    await page.goto('/analytics/report/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/login\?next=%2Fanalytics%2Freport%2F/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('invalid credentials get a generic error, not account details', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('not-a-real-user@example.invalid');
    await page.locator('#password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    const alert = page.locator('[role="alert"]').filter({ hasText: /Email or password is incorrect/i });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/not-a-real-user@example\.invalid/i)).toHaveCount(0);
  });
});

test.describe('authenticated analytics', () => {
  test.skip(
    !hasCredentials,
    'Set E2E_EMAIL and E2E_PASSWORD (an authorised account) to run authenticated checks.'
  );

  test('authorised user can use the shell and sign out', async ({ page }) => {
    await signIn(page);

    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    await expect(page.locator('select')).toHaveCount(4);

    // Session survives a reload.
    await page.reload();
    await expect(page).toHaveURL(/\/analytics$/);
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/login\?next=%2Fanalytics/);
  });
});
