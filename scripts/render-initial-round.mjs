import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const dir = resolve('tmp/initial-round/rendered');
await mkdir(dir, { recursive: true });
for (const stem of ['Trace-X-Action-Plan', 'Trace-X-Wireframes']) {
  const task = getDocument({
    data: new Uint8Array(await readFile(resolve('submission/initial-round', `${stem}.pdf`))),
    useSystemFonts: true,
  });
  const document = await task.promise;
  for (let p = 1; p <= document.numPages; p++) {
    const page = await document.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
    await writeFile(
      resolve(dir, `${stem}-${String(p).padStart(2, '0')}.png`),
      canvas.toBuffer('image/png'),
    );
  }
  console.log(`${stem}: rendered all ${document.numPages} pages.`);
  await task.destroy();
}
