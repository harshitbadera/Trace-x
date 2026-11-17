import { build } from 'vite';
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await build({ mode: 'submission' });
await copyFile(resolve('submission/index.html'), resolve('submission/Trace-X-prototype.html'));
await writeFile(
  resolve('submission/READ-ME.txt'),
  `TRACE-X — HACKATHON SUBMISSION\n\nOpen Trace-X-prototype.html directly in a modern browser.\nThis is a self-contained interactive preview with synthetic fixtures. It includes the investigation dashboard, money trail, account explanations, infrastructure observations, cross-case links, evidence inspection, editable notes, rules and request drafts.\n\nThe preview does not perform file ingestion or live internet lookups. Those actions are implemented in the local full application.\n\nFull application: https://github.com/harshitbadera/Trace-x\nRun: npm ci, then npm run dev\nOpen: http://127.0.0.1:5173\n\nDemo starting UTR: SYN2611160001\nReported payment: INR 240,000\nAll account identifiers, parties, domains and IP infrastructure in the demo are synthetic.\n\nSubmission deadline supplied by the participant: 24 November 2026, 11:59 pm IST.\n`,
);
const size = (await stat(resolve('submission/Trace-X-prototype.html'))).size;
if (size > 25 * 1024 * 1024) throw new Error('Submission exceeds 25 MB.');
console.log(
  `Self-contained prototype: submission/Trace-X-prototype.html (${(size / 1024 / 1024).toFixed(2)} MB)`,
);
