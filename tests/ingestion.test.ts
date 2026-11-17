import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  autoMapping,
  extractRows,
  normalizeRows,
  parseCsv,
  parseMoney,
  parseTimestamp,
} from '../server/ingestion';

test('money is converted exactly into integer paise and rejects ambiguous formats', () => {
  assert.equal(parseMoney('₹ 1,23,456.78'), 12345678);
  assert.equal(parseMoney('0.01'), 1);
  assert.equal(parseMoney(''), undefined);
  assert.throws(() => parseMoney('-50'));
  assert.throws(() => parseMoney('12.345'));
  assert.throws(() => parseMoney('abc'));
  assert.equal(parseMoney('-500.25', true), -50025);
});
test('timezone normalization preserves precision and validates calendar dates', () => {
  assert.deepEqual(parseTimestamp('16/11/2026 10:02:00', '+05:30'), {
    timestamp: '2026-11-16T04:32:00.000Z',
    precision: 'second',
    timezone: 'UTC+05:30',
  });
  assert.equal(parseTimestamp('2026-11-16', '+05:30').precision, 'day');
  assert.equal(parseTimestamp('2026-11-16T10:02Z', '+05:30').timestamp, '2026-11-16T10:02:00.000Z');
  assert.throws(() => parseTimestamp('31/02/2026', '+05:30'));
  assert.throws(() => parseTimestamp('16/11/2026 25:01', '+05:30'));
  assert.equal(
    parseTimestamp('2026-11-16T10:02:00.123+05:30', 'Z').timestamp,
    '2026-11-16T04:32:00.123Z',
  );
  assert.throws(() => parseTimestamp('2026-11-16', '+14:30'));
});
test('conflicting direction and amount fields are rejected instead of silently choosing one', () => {
  const raw = {
    timestamp: '2026-11-16',
    account: 'A',
    counterparty: 'B',
    amount: '100',
    debit: '200',
    direction: 'debit',
  };
  const normalize = (value: Record<string, string>) =>
    normalizeRows(
      [{ row: 2, location: 'row 2', raw: value }],
      autoMapping(Object.keys(value)),
      '',
      '+05:30',
      'EV',
      'test.csv',
    )[0];
  assert.match(normalize(raw).errors[0], /Amount conflicts/);
  assert.match(
    normalize({ ...raw, amount: '200', direction: 'credit' }).errors[0],
    /Direction conflicts/,
  );
  assert.match(
    normalize({ timestamp: '2026-11-16', account: 'A', from: 'B', to: 'C', amount: '10' })
      .errors[0],
    /neither the sender/,
  );
});
test('CSV parser handles quoted commas, quotes and newlines', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x,y","line 1\nline 2"\r\n"a""b",3'), [
    ['a', 'b'],
    ['x,y', 'line 1\nline 2'],
    ['a"b', '3'],
  ]);
  assert.throws(() => parseCsv('a,"unclosed'));
});
test('debit and credit columns are normalized and conflicting rows are blocked', () => {
  const columns = ['Date', 'Account', 'Counterparty', 'Debit', 'Credit', 'UTR'];
  const mapping = autoMapping(columns);
  const rows = [
    {
      row: 2,
      location: 'row 2',
      raw: {
        Date: '16/11/2026',
        Account: 'A',
        Counterparty: 'B',
        Debit: '500',
        Credit: '',
        UTR: 'REF1',
      },
    },
    {
      row: 3,
      location: 'row 3',
      raw: {
        Date: '16/11/2026',
        Account: 'A',
        Counterparty: 'B',
        Debit: '100',
        Credit: '100',
        UTR: 'REF2',
      },
    },
  ];
  const result = normalizeRows(rows, mapping, '', '+05:30', 'EV', 'file.csv');
  assert.equal(result[0].transaction?.from, 'A');
  assert.equal(result[0].transaction?.to, 'B');
  assert.equal(result[0].transaction?.amountPaise, 50000);
  assert.ok(result[0].warnings.some((w) => w.includes('Date only')));
  assert.match(result[1].errors[0], /Both debit and credit/);
});
test('review corrections retain original row evidence', () => {
  const raw = { timestamp: '2026-11-16', from: 'A', to: 'B', amount: '10', utr: 'REF' };
  const result = normalizeRows(
    [{ row: 2, location: 'row 2', raw, originalRaw: { ...raw, amount: 'broken' } }],
    autoMapping(Object.keys(raw)),
    '',
    '+05:30',
    'EV',
    'x.csv',
  );
  assert.equal(result[0].transaction?.amountPaise, 1000);
  assert.match(result[0].transaction!.sources[0].raw!, /broken/);
});
test('Excel import preserves identifiers stored as text and accepts the first sheet', async () => {
  const b = new ExcelJS.Workbook();
  const s = b.addWorksheet('Statement');
  s.addRow(['timestamp', 'from', 'to', 'amount', 'utr']);
  s.addRow(['2026-11-16T10:00:00+05:30', '00001234', '00005678', 500.25, 'UTR-001']);
  const result = await extractRows(Buffer.from(await b.xlsx.writeBuffer()), 'sample.xlsx');
  assert.equal(result.rows[0].raw.from, '00001234');
  const normalized = normalizeRows(
    result.rows,
    autoMapping(result.columns),
    '',
    '+05:30',
    'EV',
    'sample.xlsx',
  );
  assert.equal(normalized[0].transaction?.amountPaise, 50025);
});
test('text PDF table ingestion extracts columns and source page references', async () => {
  const bytes = await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (b) => chunks.push(b));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const xs = [30, 220, 310, 400, 470];
    doc.fontSize(10);
    ['timestamp', 'from', 'to', 'amount', 'utr'].forEach((v, i) =>
      doc.text(v, xs[i], 80, { lineBreak: false }),
    );
    ['2026-11-16T10:00:00+05:30', 'A', 'B', '125.50', 'PDF-REF'].forEach((v, i) =>
      doc.text(v, xs[i], 105, { lineBreak: false }),
    );
    doc.end();
  });
  const result = await extractRows(bytes, 'sample.pdf');
  const normalized = normalizeRows(
    result.rows,
    autoMapping(result.columns),
    '',
    '+05:30',
    'EV',
    'sample.pdf',
  );
  assert.equal(normalized[0].transaction?.amountPaise, 12550);
  assert.match(normalized[0].location, /page 1/);
});
