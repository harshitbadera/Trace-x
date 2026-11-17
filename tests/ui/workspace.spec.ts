import { test, expect } from '@playwright/test';
test('investigator can inspect a trail, review risk, follow a case link and draft a request', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Aurum investment fraud', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore trail' }).click();
  await expect(page.getByLabel('Starting transaction / UTR')).toHaveValue('SYN2611160001');
  await page.getByRole('button', { name: 'Inspect transfer SYN2611160001' }).click();
  await expect(page.getByRole('dialog', { name: 'Transfer evidence' })).toBeVisible();
  await expect(page.getByText('2026-11-16T04:32:00.000Z', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Account analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Aster Trading' }).click();
  await expect(page.getByRole('dialog')).toContainText('Rapid onward transfers');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: /Cross-case links/ }).click();
  await expect(page.getByText('Meridian trading complaint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Infrastructure', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'aurum-invest.example', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Relationships', exact: true }).click();
  await expect(page.getByText('Infrastructure relationships', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reports & requests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate draft', exact: true }).click();
  await expect(page.getByLabel('Information request draft')).toHaveValue(
    /DRAFT FOR INVESTIGATOR REVIEW/,
  );
  await page.screenshot({ path: 'test-results/reports-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('overview fits desktop and mobile and renders the graph', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Aurum investment fraud', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.entity-node').first()).toBeVisible();
  await page.getByRole('button', { name: 'Inspect event SYN2611160002', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Transfer evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('.transfer-edge-label.selected')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/overview-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Aurum investment fraud', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/overview-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.getByLabel('Open navigation').click();
  await page.getByRole('button', { name: 'Statements', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Statements & transactions' })).toBeVisible();
});

test('new case imports reviewed corrections, links a source and persists after reload', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'New case', exact: true }).click();
  await page.getByLabel('Case title').fill('UI verification investigation');
  await page.getByLabel('Complaint summary').fill('Synthetic case for end-to-end verification.');
  await page.getByLabel(/Victim transaction \/ UTR/).fill('UI-R1');
  await page.getByRole('button', { name: 'Create case', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'UI verification investigation', exact: true }),
  ).toBeVisible();
  const caseId = await page.getByLabel('Active case').inputValue();
  await page.getByRole('button', { name: 'Statements', exact: true }).click();
  await page
    .getByLabel('Upload statement', { exact: true })
    .setInputFiles({
      name: 'review-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'timestamp,account,counterparty,direction,amount,balance,utr\n2026-11-16T10:00:00+05:30,UI-A,UI-VICTIM,credit,1000,1000,UI-R1\n2026-11-16T10:05:00+05:30,UI-A,UI-B,debit,broken,50,UI-R2',
      ),
    });
  await expect(page.getByRole('heading', { name: 'Review before importing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  await page.getByLabel('Edit row 3', { exact: true }).click();
  await page.getByRole('dialog').getByLabel('amount', { exact: true }).fill('950');
  await page.getByRole('button', { name: 'Save reviewed correction' }).click();
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByRole('heading', { name: 'Review before importing' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Money trail', exact: true }).click();
  await expect(page.getByLabel('Starting transaction / UTR')).toHaveValue('UI-R1');
  await page.getByRole('button', { name: 'Inspect transfer UI-R2', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('reported balance ₹50');
  await expect(page.getByRole('dialog')).toContainText('broken');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Evidence & notes', exact: true }).click();
  await page.getByRole('button', { name: 'Add source', exact: true }).click();
  await page.getByLabel('Source title').fill('Synthetic complaint record');
  await page
    .getByLabel('Source text')
    .fill(
      'The synthetic complaint names training.example and account UI-A. This association requires corroboration.',
    );
  await page.getByLabel('Indicator Optional').fill('training.example');
  await page.getByLabel(/Associated account/).selectOption('UI-A');
  await page.getByRole('button', { name: 'Save evidence', exact: true }).click();
  await expect(page.getByText('Synthetic complaint record', { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByLabel('Active case').selectOption(caseId);
  await page.getByRole('button', { name: 'Infrastructure', exact: true }).click();
  await page.getByRole('button', { name: 'Relationships', exact: true }).click();
  await expect(page.locator('.entity-node').filter({ hasText: 'training.example' })).toBeVisible();
});
