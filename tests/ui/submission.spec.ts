import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('self-contained submission opens without network and supports the investigation workflow', async ({
  page,
}) => {
  const path = resolve('submission/Trace-X-prototype.html');
  test.skip(
    !existsSync(path),
    'Run npm run package:submission before testing the standalone artifact.',
  );
  const requests: string[] = [];
  const errors: string[] = [];
  await page.route(/^https?:/, (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path).href, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Interactive submission preview/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Aurum investment fraud', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore trail' }).click();
  await page.getByRole('button', { name: 'Inspect transfer SYN2611160001' }).click();
  await expect(page.getByRole('dialog')).toContainText('SYN-V001');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Evidence & notes', exact: true }).click();
  await page.getByRole('button', { name: 'Add source', exact: true }).click();
  await page.getByLabel('Source title').fill('Synthetic follow-up complaint');
  await page
    .getByLabel('Source text')
    .fill(
      'Synthetic follow-up complaint names follow-up.example. No account association is asserted.',
    );
  await page.getByLabel('Indicator Optional').fill('follow-up.example');
  await page.getByRole('button', { name: 'Save evidence', exact: true }).click();
  await expect(page.getByText('Synthetic follow-up complaint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reports & requests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate draft', exact: true }).click();
  await expect(page.getByLabel('Information request draft')).toHaveValue(
    /DRAFT FOR INVESTIGATOR REVIEW/,
  );
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
