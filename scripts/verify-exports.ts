import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import ExcelJS from 'exceljs';

const dir = resolve('tmp/verification');
await mkdir(dir, { recursive: true });
const response = await fetch('http://127.0.0.1:8000/api/cases/TX-2026-001/report/pdf');
if (!response.ok) throw new Error(await response.text());
const pdf = Buffer.from(await response.arrayBuffer());
await writeFile(resolve(dir, 'investigation-report.pdf'), pdf);
const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
const doc = await task.promise;
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({
    canvas: canvas as any,
    canvasContext: canvas.getContext('2d') as any,
    viewport,
  }).promise;
  await writeFile(resolve(dir, `report-page-${n}.png`), canvas.toBuffer('image/png'));
  const text = await page.getTextContent();
  console.log(
    `Page ${n}: ${text.items
      .filter((x) => 'str' in x)
      .map((x) => (x as any).str)
      .join(' ')
      .slice(0, 100)}`,
  );
}
console.log(`Rendered ${doc.numPages} report pages for visual inspection.`);
await task.destroy();
const workbookResponse = await fetch('http://127.0.0.1:8000/api/cases/TX-2026-001/report/xlsx');
if (!workbookResponse.ok) throw new Error(await workbookResponse.text());
const bytes = Buffer.from(await workbookResponse.arrayBuffer());
await writeFile(resolve(dir, 'evidence-workbook.xlsx'), bytes);
const book = new ExcelJS.Workbook();
await book.xlsx.load(bytes as never);
const transactions = book.getWorksheet('Transactions');
if (transactions?.rowCount !== 18)
  throw new Error(`Expected 17 transactions, got ${transactions?.rowCount}`);
console.log(
  `Workbook verified: ${book.worksheets.length} sheets, ${transactions.rowCount - 1} transactions.`,
);
