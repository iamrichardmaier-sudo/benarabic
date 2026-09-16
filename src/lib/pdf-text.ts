/**
 * Getting the words out of a PDF.
 *
 * Two kinds arrive. A PDF made from a document carries its text, and pdf.js
 * hands it straight over. A PDF made from a scanner or a phone camera carries
 * pictures of text and no text at all — those pages come back empty, and the
 * only way to read them is to look at them.
 *
 * pdf.js is imported on demand: it is a large library and this is a one-off
 * utility most sessions never open.
 */

/** Below this many characters, a page is a picture rather than a document. */
const SCANNED_THRESHOLD = 40;

/** How much bigger than screen size to render a page being read by eye. */
const OCR_SCALE = 2;

export interface PdfPage {
  /** 1-based, as a reader would count them. */
  number: number;
  text: string;
  /** True when the page carried no usable text and has to be looked at. */
  needsOcr: boolean;
}

export interface PdfExtract {
  pages: PdfPage[];
  /** Pages that came back empty, in reading order. */
  scannedPages: number[];
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
};

type PdfPageProxy = {
  getTextContent: () => Promise<{ items: { str?: string }[] }>;
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: Record<string, unknown>) => { promise: Promise<void> };
};

let docPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function pdfjs() {
  if (!docPromise) {
    docPromise = (async () => {
      const lib = await import('pdfjs-dist');
      // Vite gives the worker its own URL; without it pdf.js falls back to
      // running on the main thread and locks the page up on a long document.
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return docPromise;
}

/** Open a PDF the reader picked. */
export async function openPdf(file: File): Promise<PdfDoc> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return (await lib.getDocument({ data }).promise) as unknown as PdfDoc;
}

/** Whatever text the pages carry, and which ones carry none. */
export async function extractText(
  doc: PdfDoc,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfExtract> {
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((i) => i.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ number: n, text, needsOcr: text.length < SCANNED_THRESHOLD });
    onProgress?.(n, doc.numPages);
  }
  return { pages, scannedPages: pages.filter((p) => p.needsOcr).map((p) => p.number) };
}

/**
 * One page as a picture, for the pages that have to be read by eye.
 *
 * JPEG rather than PNG: a scanned page is a photograph, and a PNG of one runs
 * to several megabytes where a JPEG is a few hundred kilobytes — which matters
 * when every page is being sent over the wire.
 */
export async function renderPageImage(doc: PdfDoc, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot render the page to read it.');
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** The pages joined into one reading, in order, blank pages dropped. */
export function joinPages(pages: PdfPage[]): string {
  return pages
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n');
}
