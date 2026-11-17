import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { Analysis, CaseData } from '../shared/types';

const money = (p: number) =>
  `INR ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
export function reportPdf(c: CaseData, a: Analysis): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      info: {
        Title: `Trace-X | ${c.id}`,
        Author: 'Trace-X',
        Subject: 'Investigation findings and evidence references',
      },
    });
    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    const safe = (s: string) =>
      s
        .replace(/₹/g, 'INR ')
        .replace(/[–—]/g, '-')
        .replace(/[^\x20-\x7E\n]/g, ' ');
    const ensure = (height = 60) => {
      if (doc.y + height > doc.page.height - 70) doc.addPage();
    };
    const title = (s: string) => {
      ensure(180);
      doc.moveDown(0.7).font('Helvetica-Bold').fontSize(14).fillColor('#14253d').text(safe(s));
      doc.moveDown(0.45);
    };
    const para = (s: string, size = 10) => {
      const text = safe(s);
      ensure(Math.min(150, doc.heightOfString(text, { width: 499 })) + 12);
      doc.font('Helvetica').fontSize(size).fillColor('#3b4657').text(text, { lineGap: 3 });
      doc.moveDown(0.55);
    };
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#087f8c')
      .text('TRACE-X  /  INVESTIGATION REPORT');
    doc.moveDown();
    doc.fontSize(26).fillColor('#14253d').text(safe(c.title));
    doc.moveDown(0.5);
    para(
      `${c.id} | Generated ${new Date().toISOString()} | ${c.synthetic ? 'SYNTHETIC DEMONSTRATION' : 'USER-SUPPLIED CASE'}`,
    );
    para(c.description);
    title('1. Scope and starting transaction');
    para(
      a.trace.root
        ? `Starting reference: ${a.trace.root.utr}\nAmount: ${money(a.trace.root.amountPaise)}\nFrom: ${a.trace.root.from}\nTo: ${a.trace.root.to}\nTime (UTC): ${a.trace.root.timestamp}\nOriginal: ${a.trace.root.originalTimestamp} (${a.trace.root.timezone})`
        : 'No unique starting UTR is available.',
    );
    para(
      `${c.transactions.length} normalized transfers; ${c.accounts.length} account identifiers; ${c.evidence.length} evidence items. Risk rules version 0.1; settings: ${JSON.stringify(a.rules)}.`,
    );
    for (const warning of a.trace.warnings) para(warning);
    title('2. Explainable account findings');
    for (const risk of a.risks.filter((r) => r.rules.length)) {
      const account = c.accounts.find((x) => x.id === risk.accountId)!;
      ensure(75);
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(safe(`${account.label} (${account.id}) | ${risk.level} | ${risk.score}/100`));
      for (const rule of risk.rules)
        para(
          `${rule.title} (+${rule.points}): ${rule.description}\nSupporting transfers: ${rule.transactionIds.join(', ')}`,
        );
    }
    if (!a.risks.some((r) => r.rules.length))
      para(
        'No configured rules triggered in the available records. This does not establish absence of fraud.',
      );
    title('3. Candidate money trail');
    for (const t of a.trace.transactions) {
      para(
        `${t.id} | ${t.from} -> ${t.to} | ${money(t.amountPaise)}\n${t.timestamp} | precision: ${t.precision} | UTR: ${t.utr || 'not supplied'}\nSources: ${t.sources.map((s) => `${s.file}, ${s.location} [${s.evidenceId}]`).join('; ')}`,
      );
    }
    title('4. Digital infrastructure observations');
    if (!c.lookups.length) para('No infrastructure lookups recorded.');
    for (const l of c.lookups) {
      para(
        `${l.indicator} | ${l.mode === 'fixture' ? 'SYNTHETIC FIXTURE' : 'LIVE PUBLIC LOOKUP'} | observed ${l.observedAt} | ${l.status}\n${Object.entries(
          l.fields,
        )
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')}`,
      );
      for (const r of l.records.filter((r) => !['RDAP', 'BGP'].includes(r.type)))
        para(`${r.type}: ${r.value}\nSource: ${r.source}`, 9);
      for (const warning of l.warnings) para(warning, 9);
    }
    title('5. Cross-case identifiers');
    for (const link of a.links)
      para(`${link.kind}: ${link.value} | ${link.caseId}, ${link.caseTitle}\n${link.explanation}`);
    if (!a.links.length) para('No exact identifier matches in the available local cases.');
    title('6. Evidence gaps and limitations');
    const missing = c.accounts.filter(
      (acc) => a.trace.accountIds.includes(acc.id) && !acc.statementAvailable,
    );
    para(
      missing.length
        ? `Statements missing for: ${missing.map((x) => x.id).join(', ')}. Onward activity cannot be assessed beyond the supplied records.`
        : 'Statement availability is recorded per account; completeness and coverage still need investigator review.',
    );
    para(
      'Risk scores prioritize review and are not probabilities or findings of guilt. Candidate onward paths do not allocate commingled money. Date-only transactions have uncertain intra-day order. Current DNS and IP data cannot establish historical allocation. Shared infrastructure and geography do not establish a person’s identity. Non-public subscriber and login records require the applicable lawful process.',
    );
    title('7. Evidence register');
    for (const e of c.evidence)
      para(
        `${e.id} | ${e.name}\nRecorded: ${e.createdAt}\nSHA-256: ${e.sha256 || 'Not computed'}\n${e.summary}`,
        9,
      );
    if (c.notes.length) {
      title('8. Analyst notes');
      for (const note of c.notes) para(`${note.createdAt}: ${note.text}`);
    }
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#718096')
        .text(
          `${c.id}  |  Trace-X  |  ${c.synthetic ? 'Synthetic data  |  ' : ''}${i + 1} / ${pages.count}`,
          48,
          doc.page.height - 40,
          { lineBreak: false },
        );
    }
    doc.end();
  });
}

export async function reportXlsx(c: CaseData, a: Analysis) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Trace-X';
  book.created = new Date();
  function sheet(name: string, headers: string[], rows: (string | number)[][]) {
    const s = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    s.addRow(headers);
    s.addRows(rows);
    s.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    s.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15253D' } };
    s.columns = headers.map((h) => ({
      width: /narration|explanation|source|description|limitations/i.test(h)
        ? 55
        : Math.max(20, Math.min(40, h.length + 5)),
    }));
    s.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: headers.length },
    };
    s.eachRow((r, n) => {
      r.alignment = { vertical: 'top', wrapText: true };
      if (n > 1 && n % 2 === 0)
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
    return s;
  }
  sheet(
    'Case',
    ['Field', 'Value'],
    [
      ['Case', c.id],
      ['Title', c.title],
      ['Data', c.synthetic ? 'Synthetic demonstration' : 'User supplied'],
      ['Starting UTR', c.victimUtr],
      ['Generated UTC', new Date().toISOString()],
      [
        'Method',
        'Observed transactions; candidate onward paths; no allocation of commingled funds.',
      ],
      ['Score', 'Review priority, not a probability of criminality'],
      ['Rule settings', JSON.stringify(a.rules)],
      ['Limitations', a.trace.warnings.join(' ')],
    ],
  );
  const tx = sheet(
    'Transactions',
    [
      'ID',
      'Timestamp UTC',
      'Original timestamp',
      'Timezone',
      'Precision',
      'From',
      'To',
      'Amount INR',
      'UTR',
      'Narration',
      'Source references',
      'Statement account (first observation)',
      'Direction (first observation)',
      'Balance INR (first observation)',
    ],
    c.transactions.map((t) => [
      t.id,
      t.timestamp,
      t.originalTimestamp,
      t.timezone,
      t.precision,
      t.from,
      t.to,
      t.amountPaise / 100,
      t.utr,
      t.narration,
      t.sources.map((s) => `${s.evidenceId}: ${s.location}`).join('; '),
      t.statementAccount || '',
      t.direction || '',
      t.balancePaise !== undefined ? t.balancePaise / 100 : '',
    ]),
  );
  tx.getColumn(8).numFmt = '#,##0.00';
  tx.getColumn(14).numFmt = '#,##0.00';
  const observations = sheet(
    'Source observations',
    [
      'Transaction ID',
      'Evidence ID',
      'File',
      'Source location',
      'Statement account',
      'Direction',
      'Balance INR',
      'Original row',
    ],
    c.transactions.flatMap((t) =>
      t.sources.map((s) => [
        t.id,
        s.evidenceId,
        s.file,
        s.location,
        s.statementAccount || '',
        s.direction || '',
        s.balancePaise !== undefined ? s.balancePaise / 100 : '',
        s.raw || '',
      ]),
    ),
  );
  observations.getColumn(7).numFmt = '#,##0.00';
  sheet(
    'Account findings',
    ['Account', 'Priority score', 'Level', 'Incoming INR', 'Outgoing INR', 'Explanation'],
    a.risks.map((r) => [
      r.accountId,
      r.score,
      r.level,
      r.incomingPaise / 100,
      r.outgoingPaise / 100,
      r.rules.map((x) => x.description).join('\n'),
    ]),
  );
  sheet(
    'Evidence',
    ['ID', 'Name', 'SHA-256', 'Recorded UTC', 'Description'],
    c.evidence.map((e) => [e.id, e.name, e.sha256, e.createdAt, e.summary]),
  );
  sheet(
    'Infrastructure',
    ['Indicator', 'Mode', 'Observed UTC', 'Status', 'Fields', 'Warnings'],
    c.lookups.map((l) => [
      l.indicator,
      l.mode,
      l.observedAt,
      l.status,
      JSON.stringify(l.fields),
      l.warnings.join('\n'),
    ]),
  );
  return Buffer.from(await book.xlsx.writeBuffer());
}
export { requestDraft } from '../shared/requests';
