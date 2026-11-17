import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ImportRow, Transaction } from '../shared/types';

export const FIELDS = [
  'timestamp',
  'account',
  'counterparty',
  'direction',
  'amount',
  'debit',
  'credit',
  'balance',
  'utr',
  'narration',
  'from',
  'to',
] as const;
const aliases: Record<string, string[]> = {
  timestamp: ['timestamp', 'date', 'datetime', 'transactiondate', 'txndate', 'valuedate'],
  account: ['account', 'accountreference', 'accountnumber', 'accountno'],
  counterparty: ['counterparty', 'beneficiary', 'counterpartyaccount', 'beneficiaryaccount'],
  direction: ['direction', 'type', 'drcr', 'debitcredit'],
  amount: ['amount', 'transactionamount'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'debitamount'],
  credit: ['credit', 'deposit', 'deposits', 'creditamount'],
  balance: ['balance', 'closingbalance', 'runningbalance'],
  utr: ['utr', 'reference', 'transactionid', 'refno', 'referencenumber'],
  narration: ['narration', 'description', 'particulars', 'remarks'],
  from: ['from', 'sender', 'fromaccount'],
  to: ['to', 'recipient', 'toaccount'],
};
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function autoMapping(columns: string[]) {
  return Object.fromEntries(
    FIELDS.map((f) => [f, columns.find((c) => aliases[f].includes(clean(c))) || '']),
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
function cellString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().replace(/Z$/, '');
  if (typeof value === 'object') {
    if ('result' in value) return cellString(value.result as ExcelJS.CellValue);
    if ('text' in value) return value.text;
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    return '';
  }
  return String(value);
}
export type RawRow = {
  row: number;
  location: string;
  raw: Record<string, string>;
  originalRaw?: Record<string, string>;
};
export async function extractRows(
  buffer: Buffer,
  name: string,
): Promise<{ columns: string[]; rows: RawRow[]; warnings: string[] }> {
  let grid: string[][] = [];
  let locations: string[] = [];
  const warnings: string[] = [];
  if (/\.csv$/i.test(name)) {
    grid = parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    locations = grid.map((_, i) => `row ${i + 1}`);
  } else if (/\.xlsx$/i.test(name)) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('The workbook has no worksheets.');
    if (workbook.worksheets.length > 1)
      warnings.push(
        `Only the first worksheet (${sheet.name}) is imported. Export other worksheets separately.`,
      );
    sheet.eachRow((row, n) => {
      if (grid.length > 5001) throw new Error('Limit exceeded: 5,000 transaction rows per upload.');
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        values[col - 1] = cellString(cell.value);
      });
      grid.push(values);
      locations.push(`${sheet.name} · row ${n}`);
    });
    warnings.push('Excel date cells have no timezone; the selected statement timezone is used.');
  } else if (/\.pdf$/i.test(name)) {
    const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const doc = await task.promise;
    try {
      if (doc.numPages > 100) throw new Error('Limit exceeded: 100 PDF pages per upload.');
      for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
        const page = await doc.getPage(pageNo);
        const content = await page.getTextContent();
        const lines = new Map<number, { x: number; text: string }[]>();
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const y = Math.round(item.transform[5] / 3) * 3;
          const a = lines.get(y) || [];
          a.push({ x: item.transform[4], text: item.str });
          lines.set(y, a);
        }
        for (const [y, items] of [...lines].sort((a, b) => b[0] - a[0])) {
          items.sort((a, b) => a.x - b.x);
          const text = items.map((i) => i.text).join(' ');
          const cells = text.includes('|')
            ? text.split('|').map((s) => s.trim())
            : items.map((i) => i.text.trim());
          grid.push(cells);
          locations.push(`page ${pageNo} · y ${y}`);
        }
      }
    } finally {
      await task.destroy();
    }
    if (!grid.length)
      throw new Error(
        'No selectable text found. Scanned PDFs need OCR; export the statement as Excel/CSV or a text-based PDF.',
      );
    warnings.push(
      'PDF table extraction is layout-dependent. Review mapped fields and excluded rows before importing.',
    );
  } else
    throw new Error(
      'Use CSV, XLSX or a text-based PDF. Legacy XLS and scanned PDF OCR are not supported yet.',
    );
  const headerIndex = grid.findIndex(
    (row) => Object.values(autoMapping(row)).filter(Boolean).length >= 3,
  );
  if (headerIndex < 0)
    throw new Error(
      'Could not find a table header. Use the downloadable template or headers such as timestamp, counterparty, direction, amount and UTR.',
    );
  const columns = grid[headerIndex].map((s, i) => s.trim() || `Column ${i + 1}`);
  if (new Set(columns).size !== columns.length)
    throw new Error('Duplicate column headers found. Give each column a unique name.');
  const rows = grid
    .slice(headerIndex + 1)
    .map((values, i) => ({
      row: headerIndex + i + 2,
      location: locations[headerIndex + i + 1],
      raw: Object.fromEntries(columns.map((c, j) => [c, values[j] || ''])),
    }))
    .filter((r) => !columns.every((c) => r.raw[c] === c));
  if (rows.length > 5000) throw new Error('Limit exceeded: 5,000 transaction rows per upload.');
  if (!rows.length) throw new Error('The statement contains a header but no transaction rows.');
  return { columns, rows, warnings };
}

export function parseMoney(value: string, allowNegative = false): number | undefined {
  if (!value.trim()) return undefined;
  let cleaned = value.replace(/INR|₹|,/gi, '').trim();
  const negative = allowNegative && cleaned.startsWith('-');
  if (negative) cleaned = cleaned.slice(1);
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned))
    throw new Error(
      `Invalid monetary amount: ${value}. Use a positive INR amount with at most two decimal places.`,
    );
  const [whole, fraction = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise)) throw new Error('Amount exceeds supported precision.');
  return negative ? -paise : paise;
}
export function parseTimestamp(
  value: string,
  offset: string,
): { timestamp: string; precision: Transaction['precision']; timezone: string } {
  let input = value.trim();
  const dm = input.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(.*)$/);
  if (dm) input = `${dm[3]}-${dm[2]}-${dm[1]}${dm[4]}`;
  input = input.replace(' ', 'T');
  const match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:\d{2})?$/,
  );
  if (!match)
    throw new Error('Use YYYY-MM-DD or DD/MM/YYYY, optionally with HH:mm:ss and a timezone.');
  const [, y, m, d, h, min, sec, milliseconds, zone] = match;
  const check = new Date(Date.UTC(+y, +m - 1, +d));
  if (
    check.getUTCFullYear() !== +y ||
    check.getUTCMonth() !== +m - 1 ||
    check.getUTCDate() !== +d ||
    +(h || 0) > 23 ||
    +(min || 0) > 59 ||
    +(sec || 0) > 59
  )
    throw new Error('Invalid calendar date or time.');
  const tz = zone || offset;
  if (!/^(Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(tz))
    throw new Error('Select a valid UTC offset.');
  const timestamp = new Date(
    `${y}-${m}-${d}T${h || '00'}:${min || '00'}:${sec || '00'}.${(milliseconds || '0').padEnd(3, '0')}${tz}`,
  ).toISOString();
  return {
    timestamp,
    precision: !h ? 'day' : sec ? 'second' : 'minute',
    timezone: tz === 'Z' ? 'UTC' : `UTC${tz}`,
  };
}
export function normalizeRows(
  rows: RawRow[],
  mapping: Record<string, string>,
  account: string,
  timezone: string,
  evidenceId: string,
  file: string,
): ImportRow[] {
  return rows.map((row) => {
    const errors: string[] = [],
      warnings: string[] = [];
    let transaction: Transaction | undefined;
    const get = (key: string) => (row.raw[mapping[key]] || '').trim();
    try {
      const date = parseTimestamp(get('timestamp'), timezone);
      if (date.precision === 'day') warnings.push('Date only: intra-day ordering is unknown.');
      if (!/(Z|[+-]\d{2}:\d{2})$/.test(get('timestamp')))
        warnings.push(`Timezone assumed from import setting (${timezone}).`);
      let amount = parseMoney(get('amount'));
      const inputDirection = get('direction').toLowerCase();
      let direction = ['debit', 'dr', 'd', 'withdrawal'].includes(inputDirection)
        ? 'debit'
        : ['credit', 'cr', 'c', 'deposit'].includes(inputDirection)
          ? 'credit'
          : '';
      if (inputDirection && !direction)
        throw new Error('Unrecognized direction. Use debit/credit or DR/CR.');
      const debit = parseMoney(get('debit'));
      const credit = parseMoney(get('credit'));
      if ((debit || 0) > 0 && (credit || 0) > 0)
        throw new Error('Both debit and credit are positive; review this row.');
      const sideAmount = debit || credit;
      const sideDirection = debit ? 'debit' : credit ? 'credit' : '';
      if (amount !== undefined && sideAmount !== undefined && amount !== sideAmount)
        throw new Error('Amount conflicts with the mapped debit/credit value.');
      if (direction && sideDirection && direction !== sideDirection)
        throw new Error('Direction conflicts with the mapped debit/credit column.');
      amount ??= sideAmount;
      direction ||= sideDirection;
      if (!amount) throw new Error('A positive transfer amount is required.');
      const statementAccount = get('account') || account;
      let from = get('from'),
        to = get('to');
      if (Boolean(from) !== Boolean(to))
        throw new Error(
          'Map both from and to, or leave both unmapped and use account/counterparty.',
        );
      if (!from || !to) {
        if (!statementAccount) throw new Error('Provide the statement account identifier.');
        const counterparty = get('counterparty');
        if (!counterparty)
          throw new Error('Counterparty identifier is missing; review or exclude this row.');
        if (['debit', 'dr', 'd', 'withdrawal'].includes(direction)) {
          from = statementAccount;
          to = counterparty;
          direction = 'debit';
        } else if (['credit', 'cr', 'c', 'deposit'].includes(direction)) {
          from = counterparty;
          to = statementAccount;
          direction = 'credit';
        } else
          throw new Error(
            'Direction must be debit/credit or DR/CR, or map separate debit and credit columns.',
          );
      }
      if (statementAccount && from !== statementAccount && to !== statementAccount)
        throw new Error(
          'Statement account is neither the sender nor recipient. Review the mapped identifiers.',
        );
      if (statementAccount) {
        const inferred = from === statementAccount ? 'debit' : 'credit';
        if (direction && direction !== inferred)
          throw new Error('Direction conflicts with the statement account and transfer endpoints.');
        direction = inferred;
      }
      if (from === to)
        throw new Error('Sender and recipient are identical. Review the account mapping.');
      const utr = get('utr');
      if (!utr)
        warnings.push('No UTR: cross-statement automatic matching is disabled for this row.');
      const raw = JSON.stringify(row.originalRaw || row.raw);
      transaction = {
        id: createHash('sha256').update(`${evidenceId}:${row.location}`).digest('hex').slice(0, 20),
        from,
        to,
        amountPaise: amount,
        currency: 'INR',
        ...date,
        originalTimestamp: get('timestamp'),
        utr,
        narration: get('narration'),
        balancePaise: parseMoney(get('balance'), true),
        statementAccount: statementAccount || undefined,
        direction: direction === 'debit' || direction === 'credit' ? direction : undefined,
        sources: [
          {
            evidenceId,
            file,
            location: row.location,
            raw,
            statementAccount: statementAccount || undefined,
            direction: direction === 'debit' || direction === 'credit' ? direction : undefined,
            balancePaise: parseMoney(get('balance'), true),
          },
        ],
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Invalid row.');
    }
    return { ...row, errors, warnings, transaction };
  });
}
