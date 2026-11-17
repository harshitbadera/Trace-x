import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  allCases,
  getCase,
  saveCase,
  audit,
  auditLog,
  settings,
  saveSettings,
  dataDir,
} from './store';
import { analyseAccounts, traceFunds, crossCaseLinks, mergeTransactions } from '../shared/analysis';
import { demoCases } from '../shared/fixtures';
import { extractRows, autoMapping, normalizeRows, type RawRow } from './ingestion';
import { lookupIndicator } from './intelligence';
import { reportPdf, reportXlsx, requestDraft } from './reports';
import type { CaseData, ImportPreview, Analysis } from '../shared/types';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  const host = req.hostname;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
    res.status(403).json({ error: 'Local access only.' });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    try {
      const u = new URL(origin);
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) throw Error();
    } catch {
      res.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }
  }
  next();
});
app.use(express.json({ limit: '2mb' }));
const uploads = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(csv|xlsx|pdf)$/i.test(file.originalname)) {
      cb(new Error('Supported files: CSV, XLSX and text-based PDF.'));
      return;
    }
    cb(null, true);
  },
});
const pending = new Map<
  string,
  {
    caseId: string;
    buffer: Buffer;
    rows: RawRow[];
    preview: ImportPreview;
    created: number;
    corrections: string[];
  }
>();
const get = (id: string) => {
  const c = getCase(id);
  if (!c) throw new Error('Case not found.');
  return c;
};
const analyse = (c: CaseData, utr?: string): Analysis => ({
  risks: analyseAccounts(c, settings()),
  trace: traceFunds(c, utr || c.victimUtr),
  links: crossCaseLinks(c, allCases()),
  rules: settings(),
});
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', version: '0.1.0', mode: 'local', database: 'SQLite' }),
);
app.get('/api/cases', (_req, res) => res.json(allCases()));
app.get('/api/cases/:id', (req, res) => res.json(get(String(req.params.id))));
app.get('/api/cases/:id/analysis', (req, res) =>
  res.json(analyse(get(String(req.params.id)), String(req.query.utr || '') || undefined)),
);
app.get('/api/cases/:id/audit', (req, res) => {
  get(String(req.params.id));
  res.json(auditLog(req.params.id));
});
app.post('/api/cases', (req, res) => {
  const body = z
    .object({
      title: z.string().trim().min(3).max(100),
      description: z.string().max(2000).default(''),
      victimUtr: z.string().max(100).default(''),
    })
    .parse(req.body);
  const c: CaseData = {
    ...body,
    id: `TX-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'Active',
    synthetic: true,
    accounts: [],
    transactions: [],
    evidence: [],
    indicators: [],
    lookups: [],
    notes: [],
  };
  saveCase(c);
  audit(c.id, 'Case created', 'New synthetic-data investigation workspace.');
  res.status(201).json(c);
});
app.patch('/api/cases/:id', (req, res) => {
  const body = z
    .object({
      victimUtr: z.string().max(100).optional(),
      status: z.enum(['Active', 'Review']).optional(),
    })
    .parse(req.body);
  const c = get(String(req.params.id));
  Object.assign(c, body);
  saveCase(c);
  audit(c.id, 'Case updated', JSON.stringify(body));
  res.json(c);
});
app.post('/api/cases/:id/notes', (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(5000) }).parse(req.body);
  const c = get(String(req.params.id));
  c.notes.push({ id: randomUUID(), text, createdAt: new Date().toISOString() });
  saveCase(c);
  audit(c.id, 'Note added', text.slice(0, 150));
  res.json(c);
});
app.post('/api/cases/:id/evidence', (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(3).max(150),
      kind: z.enum(['complaint', 'note']),
      content: z.string().trim().min(10).max(10000),
      indicator: z
        .object({
          type: z.enum(['domain', 'ip', 'upi', 'phone']),
          value: z.string().trim().min(2).max(253),
          relatedAccount: z.string().max(100).optional(),
          relation: z.string().trim().min(5).max(500),
        })
        .optional(),
    })
    .parse(req.body);
  const c = get(String(req.params.id));
  if (
    body.indicator?.relatedAccount &&
    !c.accounts.some((a) => a.id === body.indicator!.relatedAccount)
  )
    throw new Error('Select an account already present in this case.');
  const id = `EV-${randomUUID().slice(0, 12)}`;
  c.evidence.push({
    id,
    name: body.name,
    kind: body.kind,
    content: body.content,
    sha256: createHash('sha256').update(body.content).digest('hex'),
    createdAt: new Date().toISOString(),
    summary: body.content.slice(0, 180),
    synthetic: true,
  });
  if (body.indicator) c.indicators.push({ id: randomUUID(), sourceId: id, ...body.indicator });
  saveCase(c);
  audit(
    c.id,
    'Source evidence added',
    `${body.name}${body.indicator ? `; submitted association: ${body.indicator.value} / ${body.indicator.relation}` : ''}`,
  );
  res.status(201).json(c);
});
app.get('/api/settings', (_req, res) => res.json(settings()));
app.put('/api/settings', (req, res) => {
  const body = z
    .object({
      rapidMinutes: z.number().int().min(1).max(1440),
      rapidPercent: z.number().int().min(1).max(100),
      fanInSenders: z.number().int().min(2).max(1000),
      roundMultipleRupees: z.number().int().min(1).max(10000000),
      roundCount: z.number().int().min(2).max(1000),
      repeatCount: z.number().int().min(2).max(1000),
      dormancyDays: z.number().int().min(1).max(3650),
    })
    .parse(req.body);
  saveSettings(body);
  for (const c of allCases()) audit(c.id, 'Rules updated', JSON.stringify(body));
  res.json(body);
});
app.post('/api/cases/:id/import', uploads.single('file'), async (req, res) => {
  const c = get(String(req.params.id));
  if (!req.file) throw new Error('Choose a statement file.');
  for (const [key, value] of pending)
    if (Date.now() - value.created > 30 * 60 * 1000) pending.delete(key);
  if (pending.size >= 12)
    throw new Error(
      'Too many pending uploads. Complete a preview or try again after previews expire.',
    );
  const name = basename(req.file.originalname);
  const sha256 = createHash('sha256').update(req.file.buffer).digest('hex');
  if (c.evidence.some((e) => e.sha256 === sha256))
    throw new Error('This exact file is already in the case.');
  const extracted = await extractRows(req.file.buffer, name);
  const mapping = autoMapping(extracted.columns);
  const id = randomUUID(),
    evidenceId = `EV-${sha256.slice(0, 12)}`;
  const account = String(req.body.account || '')
      .trim()
      .slice(0, 100),
    timezone = String(req.body.timezone || '+05:30');
  const preview: ImportPreview = {
    id,
    name,
    sha256,
    columns: extracted.columns,
    rows: normalizeRows(extracted.rows, mapping, account, timezone, evidenceId, name),
    warnings: extracted.warnings,
    account,
    timezone,
    mapping,
    evidenceId,
  };
  pending.set(id, {
    caseId: c.id,
    buffer: req.file.buffer,
    rows: extracted.rows,
    preview,
    created: Date.now(),
    corrections: [],
  });
  res.json(preview);
});
app.patch('/api/cases/:id/import/:upload', (req, res) => {
  const p = pending.get(req.params.upload);
  if (!p || p.caseId !== req.params.id || Date.now() - p.created > 30 * 60 * 1000)
    throw new Error('Upload preview expired. Upload the file again.');
  const body = z
    .object({
      mapping: z.record(z.string(), z.string()).optional(),
      account: z.string().max(100).optional(),
      timezone: z.enum(['+05:30', 'Z', '+00:00', '+08:00', '-05:00', '+01:00']).optional(),
      correction: z
        .object({ row: z.number().int(), column: z.string(), value: z.string().max(500) })
        .optional(),
    })
    .parse(req.body);
  if (body.mapping) p.preview.mapping = body.mapping;
  if (body.account !== undefined) p.preview.account = body.account;
  if (body.timezone) p.preview.timezone = body.timezone;
  if (body.correction) {
    const { row, column, value } = body.correction;
    const r = p.rows.find((x) => x.row === row);
    if (!r || !p.preview.columns.includes(column)) throw new Error('Unknown source row or column.');
    r.originalRaw ??= { ...r.raw };
    r.raw[column] = value;
    p.corrections.push(
      `Row ${row}, ${column}: ${JSON.stringify(r.originalRaw[column])} -> ${JSON.stringify(value)}`,
    );
  }
  p.preview.rows = normalizeRows(
    p.rows,
    p.preview.mapping,
    p.preview.account,
    p.preview.timezone,
    p.preview.evidenceId,
    p.preview.name,
  );
  res.json(p.preview);
});
app.post('/api/cases/:id/import/:upload/commit', (req, res) => {
  const p = pending.get(req.params.upload);
  if (!p || p.caseId !== req.params.id || Date.now() - p.created > 30 * 60 * 1000)
    throw new Error('Upload preview expired. Upload the file again.');
  const { excluded } = z
    .object({ excluded: z.array(z.number().int()).default([]) })
    .parse(req.body);
  const rows = p.preview.rows.filter((r) => !excluded.includes(r.row));
  if (!rows.length) throw new Error('Select at least one valid transaction.');
  if (rows.some((r) => r.errors.length))
    throw new Error('Correct or explicitly exclude invalid rows before importing.');
  const c = get(String(req.params.id));
  if (c.evidence.some((e) => e.sha256 === p.preview.sha256))
    throw new Error('This exact file has already been imported.');
  const merged = mergeTransactions(
    c.transactions,
    rows.map((r) => r.transaction!),
  );
  c.transactions = merged.transactions;
  for (const t of rows.map((r) => r.transaction!)) {
    for (const id of [t.from, t.to]) {
      const statementAvailable = id === (t.statementAccount || p.preview.account);
      const existing = c.accounts.find((a) => a.id === id);
      if (existing) {
        if (statementAvailable) existing.statementAvailable = true;
      } else
        c.accounts.push({
          id,
          label: id,
          bank: 'Not supplied',
          role: 'account',
          statementAvailable,
        });
    }
  }
  const uploadDir = resolve(dataDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const storedFile = resolve(
    uploadDir,
    `${p.preview.sha256}.${p.preview.name.split('.').pop()!.toLowerCase()}`,
  );
  writeFileSync(storedFile, p.buffer);
  c.evidence.push({
    id: p.preview.evidenceId,
    name: p.preview.name,
    kind: 'statement',
    sha256: p.preview.sha256,
    createdAt: new Date().toISOString(),
    summary: `${rows.length} accepted rows; ${excluded.length} explicitly excluded; ${merged.duplicates} matching transfers merged. Import timezone ${p.preview.timezone}. ${p.corrections.length} reviewed corrections.`,
    content: JSON.stringify(
      {
        mapping: p.preview.mapping,
        timezone: p.preview.timezone,
        corrections: p.corrections,
        excluded,
        rows: p.rows,
      },
      null,
      2,
    ),
    synthetic: true,
    storedFile,
    rows: rows.length,
  });
  saveCase(c);
  audit(
    c.id,
    'Statement imported',
    `${p.preview.name}; ${merged.added} new transfers; ${merged.duplicates} matched observations; excluded rows: ${excluded.join(', ') || 'none'}; corrections: ${p.corrections.join('; ') || 'none'}`,
  );
  pending.delete(req.params.upload);
  res.json({ case: c, added: merged.added, duplicates: merged.duplicates });
});
app.get('/api/cases/:id/evidence/:evidence/download', (req, res) => {
  const c = get(String(req.params.id));
  const e = c.evidence.find((e) => e.id === req.params.evidence);
  if (!e) throw new Error('Evidence not found.');
  if (e.storedFile) {
    res.download(e.storedFile, e.name);
  } else {
    res
      .attachment(`${e.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`)
      .type('text/plain')
      .send(e.content || e.summary);
  }
});
let activeLookups = 0;
app.post('/api/cases/:id/lookups', async (req, res) => {
  const { indicator } = z.object({ indicator: z.string().trim().min(2).max(253) }).parse(req.body);
  const c = get(String(req.params.id));
  const cached = c.lookups.find(
    (l) =>
      l.indicator.toLowerCase() === indicator.toLowerCase() &&
      l.mode === 'live' &&
      Date.now() - Date.parse(l.observedAt) < 3600000,
  );
  if (cached) {
    res.json({ lookup: cached, cached: true });
    return;
  }
  if (activeLookups >= 3) {
    res.status(429).json({ error: 'Three lookups are already running. Try again shortly.' });
    return;
  }
  activeLookups++;
  try {
    const lookup = await lookupIndicator(indicator);
    const fresh = get(c.id);
    fresh.lookups.unshift(lookup);
    const content = JSON.stringify(lookup, null, 2);
    fresh.evidence.push({
      id: `EV-${lookup.id}`,
      name: `${lookup.indicator} · public lookup`,
      kind: 'lookup',
      sha256: createHash('sha256').update(content).digest('hex'),
      createdAt: lookup.observedAt,
      summary: `${lookup.status} public intelligence observation.`,
      content,
      synthetic: false,
    });
    if (!fresh.indicators.some((i) => i.value === lookup.indicator))
      fresh.indicators.push({
        id: randomUUID(),
        type: lookup.type,
        value: lookup.indicator,
        sourceId: `EV-${lookup.id}`,
        relation: 'Investigator-supplied indicator; association unverified',
      });
    saveCase(fresh);
    audit(c.id, 'Public lookup', `${lookup.indicator}: ${lookup.status}`);
    res.json({ lookup, cached: false });
  } finally {
    activeLookups--;
  }
});
app.get('/api/cases/:id/report/:format', async (req, res) => {
  const c = get(String(req.params.id));
  const a = analyse(c);
  if (req.params.format === 'pdf') {
    res
      .attachment(`${c.id}-investigation.pdf`)
      .type('application/pdf')
      .send(await reportPdf(c, a));
  } else if (req.params.format === 'xlsx') {
    res
      .attachment(`${c.id}-evidence.xlsx`)
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(await reportXlsx(c, a));
  } else {
    res.status(400).json({ error: 'Choose PDF or XLSX.' });
    return;
  }
  audit(c.id, 'Report exported', req.params.format.toUpperCase());
});
app.post('/api/cases/:id/request', (req, res) => {
  const { recipient, identifier } = z
    .object({
      recipient: z.string().trim().min(2).max(200),
      identifier: z.string().trim().min(2).max(253),
    })
    .parse(req.body);
  const c = get(String(req.params.id));
  const text = requestDraft(c, recipient, identifier);
  audit(c.id, 'Request drafted', `${recipient}: ${identifier}. Draft only; not sent.`);
  res.json({ text });
});
app.get('/api/samples/:format', async (req, res) => {
  const c = demoCases()[0];
  const account = typeof req.query.account === 'string' ? req.query.account : 'SYN-A1042';
  const transactions = c.transactions.filter((t) => t.from === account || t.to === account);
  if (!transactions.length) throw new Error('No sample statement for this account.');
  const headers = [
    'timestamp',
    'account',
    'counterparty',
    'direction',
    'amount',
    'utr',
    'narration',
  ];
  const rows = transactions.map((t) => [
    t.originalTimestamp,
    account,
    t.from === account ? t.to : t.from,
    t.from === account ? 'debit' : 'credit',
    t.amountPaise / 100,
    t.utr,
    t.narration,
  ]);
  if (req.params.format === 'csv') {
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    res.attachment(`${account}-sample.csv`).type('text/csv').send(csv);
  } else if (req.params.format === 'xlsx') {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet('Synthetic statement');
    s.addRow(headers);
    s.addRows(rows);
    s.getRow(1).font = { bold: true };
    s.columns = headers.map((h) => ({ width: h === 'narration' ? 52 : 28 }));
    res
      .attachment(`${account}-sample.xlsx`)
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(Buffer.from(await book.xlsx.writeBuffer()));
  } else if (req.params.format === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
    res.attachment(`${account}-sample.pdf`).type('application/pdf');
    doc.pipe(res);
    doc.fontSize(14).text(`TRACE-X / SYNTHETIC STATEMENT / ${account}`);
    doc
      .fontSize(9)
      .text(
        'Synthetic demonstration only. Timestamps include UTC offsets. No real personal data.',
        28,
        53,
      );
    const xs = [28, 180, 275, 380, 445, 520];
    const columns = headers.slice(0, 6);
    let y = 85;
    const row = (values: (string | number)[], bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      values.forEach((v, i) => doc.text(String(v), xs[i], y, { lineBreak: false }));
      y += 22;
    };
    row(columns, true);
    for (const data of rows) row(data.slice(0, 6));
    doc.end();
  } else res.status(400).json({ error: 'Choose CSV, XLSX or PDF.' });
});
if (existsSync(resolve('dist/index.html'))) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Endpoint not found.' });
      return;
    }
    res.sendFile(resolve('dist/index.html'));
  });
}
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      : err.message;
  if (!res.headersSent)
    res
      .status(message === 'Case not found.' ? 404 : 400)
      .json({ error: message || 'Request could not be completed.' });
});
