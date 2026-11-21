import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve('tmp/initial-round/screens');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function shot(name, locator = page) {
  await page.evaluate(() => document.fonts.ready);
  const dismiss = page.getByRole('button', { name: 'Dismiss notification', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  if (locator === page)
    await page.evaluate(async () => {
      window.scrollTo(0, 0);
      await new Promise(requestAnimationFrame);
    });
  await locator.screenshot({
    path: resolve(dir, `${name}.png`),
    animations: 'disabled',
    ...(locator === page ? { fullPage: true } : {}),
  });
}
async function nav(name) {
  await page.getByRole('button', { name, exact: typeof name === 'string' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
}
try {
  await page.goto('http://127.0.0.1:5174');
  await expect(
    page.getByRole('heading', { name: 'Aurum investment fraud', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.entity-node').first()).toBeVisible();
  await shot('01-overview');
  await shot('trail-detail', page.locator('.caseboard'));
  await nav('Money trail');
  await expect(page.getByLabel('Starting transaction / UTR')).toHaveValue('SYN2611160001');
  await shot('03-money-trail');
  await page.getByRole('button', { name: 'Inspect transfer SYN2611160001', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await shot('transfer-detail', page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await nav('Account analysis');
  await page.getByRole('button', { name: 'Inspect Aster Trading', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Rapid onward transfers');
  await shot('04-account-analysis');
  await shot('account-detail', page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await nav('Infrastructure');
  await expect(
    page.getByRole('heading', { name: 'aurum-invest.example', exact: true }),
  ).toBeVisible();
  await shot('05-infrastructure');
  await page.getByRole('button', { name: 'Relationships', exact: true }).click();
  await expect(page.locator('.entity-node').first()).toBeVisible();
  await shot('06-relationships');
  await shot('infra-detail', page.locator('.infra-graph'));
  await nav(/Cross-case links/);
  await expect(page.getByText('Meridian trading complaint', { exact: true })).toBeVisible();
  await shot('07-cross-case');
  await nav('Reports & requests');
  await page.getByRole('button', { name: 'Generate draft', exact: true }).click();
  await expect(page.getByLabel('Information request draft')).toHaveValue(
    /DRAFT FOR INVESTIGATOR REVIEW/,
  );
  await shot('08-reports');
  await nav('Statements');
  await page
    .getByLabel('Upload statement', { exact: true })
    .setInputFiles({
      name: 'synthetic-review.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'timestamp,account,counterparty,direction,amount,balance,utr,narration\n2026-11-16T10:02:00+05:30,SYN-A1042,SYN-V001,credit,240000,240000,SYN2611160001,Synthetic investment payment\n2026-11-16T10:06:00+05:30,SYN-A1042,SYN-B2081,debit,140000,100000,SYN2611160002,Synthetic onward transfer',
      ),
    });
  await expect(
    page.getByRole('heading', { name: 'Review before importing', exact: true }),
  ).toBeVisible();
  await shot('02-statement-review');
  if (errors.length) throw new Error(errors.join('\n'));

  // Verify the exact packaged artifact in a fresh context with no network access.
  const offline = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await offline.setOffline(true);
  const preview = await offline.newPage();
  const offlineErrors = [];
  const externalRequests = [];
  preview.on('pageerror', (e) => offlineErrors.push(e.message));
  preview.on('request', (r) => {
    if (/^https?:/.test(r.url())) externalRequests.push(r.url());
  });
  await preview.goto(pathToFileURL(resolve('submission/Trace-X-prototype.html')).href);
  await expect(preview.getByText(/Interactive submission preview/)).toBeVisible();
  await preview.getByRole('button', { name: 'Explore trail', exact: true }).click();
  await preview
    .getByRole('button', { name: 'Inspect transfer SYN2611160001', exact: true })
    .click();
  await expect(preview.getByRole('dialog')).toContainText('SYN-V001');
  await preview.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await preview.getByRole('button', { name: 'Reports & requests', exact: true }).click();
  await preview.getByRole('button', { name: 'Generate draft', exact: true }).click();
  await expect(preview.getByLabel('Information request draft')).toHaveValue(
    /DRAFT FOR INVESTIGATOR REVIEW/,
  );
  if (offlineErrors.length || externalRequests.length)
    throw new Error(JSON.stringify({ offlineErrors, externalRequests }));
  await writeFile(
    resolve('tmp/initial-round/browser-verification.json'),
    JSON.stringify(
      {
        screens: 8,
        applicationErrors: errors,
        offlineErrors,
        externalRequests,
        offlineWorkflow: 'passed',
      },
      null,
      2,
    ),
  );
  console.log(
    'Captured eight screens and three details. Exact HTML artifact passed offline workflow with zero external requests.',
  );
} finally {
  await browser.close();
}
