import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { CaseData, ImportPreview } from '../shared/types';
const dir = mkdtempSync(join(tmpdir(), 'trace-x-api-'));
process.env.TRACE_DATA_DIR = dir;
let server: Server, base: string;
before(async () => {
  const { app } = await import('../server/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  const { db } = await import('../server/store');
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
async function call(path: string, body?: unknown, method = 'POST') {
  return fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
test('real upload, preview, correction, commit, trace and export workflow', async () => {
  const c: CaseData = await (
    await call('/api/cases', { title: 'Integration test case', victimUtr: 'R-001' })
  ).json();
  const csv =
    'timestamp,account,counterparty,direction,amount,utr\n2026-11-16T10:00:00+05:30,A,VICTIM,credit,1000,R-001\n2026-11-16T10:05:00+05:30,A,B,debit,broken,R-002';
  const form = new FormData();
  form.append('file', new Blob([csv]), 'case.csv');
  const previewResponse = await fetch(`${base}/api/cases/${c.id}/import`, {
    method: 'POST',
    body: form,
  });
  assert.equal(previewResponse.status, 200);
  const preview: ImportPreview = await previewResponse.json();
  assert.equal(preview.rows.filter((r) => r.errors.length).length, 1);
  const blocked = await call(`/api/cases/${c.id}/import/${preview.id}/commit`, { excluded: [] });
  assert.equal(blocked.status, 400);
  const corrected = await call(
    `/api/cases/${c.id}/import/${preview.id}`,
    { correction: { row: 3, column: 'amount', value: '950' } },
    'PATCH',
  );
  assert.equal(corrected.status, 200);
  const result = await call(`/api/cases/${c.id}/import/${preview.id}/commit`, { excluded: [] });
  assert.equal(result.status, 200);
  const committed = await result.json();
  assert.equal(committed.added, 2);
  assert.equal(committed.case.evidence[0].sha256.length, 64);
  const analysis = await (await fetch(`${base}/api/cases/${c.id}/analysis`)).json();
  assert.equal(analysis.trace.transactions.length, 2);
  assert.equal(analysis.risks.find((r: any) => r.accountId === 'A').score, 35);
  const pdf = await fetch(`${base}/api/cases/${c.id}/report/pdf`);
  assert.equal(pdf.status, 200);
  const pdfBuffer = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF');
  const xlsx = await fetch(`${base}/api/cases/${c.id}/report/xlsx`);
  assert.equal(xlsx.status, 200);
  assert.equal(
    Buffer.from(await xlsx.arrayBuffer())
      .subarray(0, 2)
      .toString(),
    'PK',
  );
  const audit = await (await fetch(`${base}/api/cases/${c.id}/audit`)).json();
  assert.ok(audit.some((a: any) => a.detail.includes('broken')));
  const source = await fetch(
    `${base}/api/cases/${c.id}/evidence/${committed.case.evidence[0].id}/download`,
  );
  assert.equal(await source.text(), csv);
});
test('API rejects foreign origins and invalid rule settings', async () => {
  const bad = await fetch(`${base}/api/cases`, {
    method: 'POST',
    headers: { Origin: 'https://unrelated.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(bad.status, 403);
  const settings = await call('/api/settings', { rapidMinutes: -1 }, 'PUT');
  assert.equal(settings.status, 400);
});
test('exported PDF, Excel and CSV synthetic samples can all be parsed', async () => {
  const { extractRows, normalizeRows, autoMapping } = await import('../server/ingestion');
  for (const format of ['csv', 'xlsx', 'pdf']) {
    const response = await fetch(`${base}/api/samples/${format}`);
    assert.equal(response.status, 200);
    const extracted = await extractRows(
      Buffer.from(await response.arrayBuffer()),
      `sample.${format}`,
    );
    const normalized = normalizeRows(
      extracted.rows,
      autoMapping(extracted.columns),
      'SYN-A1042',
      '+05:30',
      'EV',
      'sample',
    );
    assert.equal(
      normalized.filter((r) => r.transaction).length,
      12,
      `${format} should contain twelve valid account observations`,
    );
  }
});
