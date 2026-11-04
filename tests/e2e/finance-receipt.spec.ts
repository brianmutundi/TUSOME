import { test, expect } from '@playwright/test';

test('pay -> receipt -> sms -> statement', async ({ page }) => {
  const email = process.env.E2E_EMAIL || 'bursar@demo.school';
  const password = process.env.E2E_PASSWORD || 'Bursar2026';
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

  await page.goto(`${base}/login`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/analytics/);

  await page.goto(`${base}/analytics/finance`);
  await page.getByRole('button', { name: 'Payments' }).click();
  await page.getByRole('combobox', { name: /Student:/ }).selectOption({ label: 'ADM-5A-005 — Amina Otieno' }).catch(() => {});

  // open record payment modal
  await page.getByRole('button', { name: 'Record Payment' }).click();
  await page.getByLabel('Amount (KES)').fill('100');
  await page.getByRole('button', { name: 'Record Payment' }).click();

  // receipt modal should appear
  await expect(page.getByText('Receipt')).toBeVisible();
  await expect(page.getByText(/Amount paid:/)).toBeVisible();

  // print button present
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
  // view statement
  await page.getByRole('button', { name: 'View fee statement' }).click();
  await expect(page).toHaveURL(/\/analytics\/finance\/statement/);
});
