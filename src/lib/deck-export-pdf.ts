import jsPDF from 'jspdf';
import type { FlashCard } from './spaced-repetition';
import { RANGE_LABEL, describeCard, metaLine, type EntryParts, type ExportRange } from './deck-export';

/**
 * The deck as a PDF a person would want to read: one word per entry, the
 * Arabic large on the right, the English and the details beside it.
 *
 * Arabic is the reason this file isn't a plain table. A PDF's built-in fonts
 * have no Arabic at all, and jsPDF does not join Arabic letters into words
 * (the letters would come out separate and back to front). The browser does
 * both perfectly, so the Arabic is drawn here on a canvas, in the same Amiri
 * font the app uses, and placed in the page as an image. Everything in
 * English stays real, selectable PDF text.
 */

// -- Page --------------------------------------------------------------------

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const RIGHT = PAGE_W - MARGIN;
const NUM_X = MARGIN;
const TEXT_X = 24;
const TOP = 18;
const BOTTOM = PAGE_H - 18;

const MM_PER_PT = 25.4 / 72;
/** Canvas pixels per point of type: about 215 dpi, sharp when zoomed or printed. */
const PX_PER_PT = 3;
const PX_PER_MM = PX_PER_PT / MM_PER_PT;

const INK = '#111111';
const GREY = '#6b6b6b';

// -- Arabic as pictures ------------------------------------------------------

const ARABIC_FONT = '"AmiriExport", "Amiri", "Noto Naskh Arabic", "Geeza Pro", "Traditional Arabic", serif';
const LATIN_FONT = 'Helvetica, Arial, sans-serif';

let fontReady: Promise<void> | null = null;

/** Loads the app's own Arabic font once, so the picture matches the cards. */
function loadArabicFont(): Promise<void> {
  fontReady ??= (async () => {
    try {
      const face = new FontFace('AmiriExport', 'url(/fonts/Amiri-Regular.ttf)');
      document.fonts.add(await face.load());
    } catch {
      // Falls back to whichever Arabic font the device has.
    }
  })();
  return fontReady;
}

interface Picture {
  url: string;
  /** Size on the page, in millimetres. */
  w: number;
  h: number;
}

function scratch(): CanvasRenderingContext2D {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the Arabic for a PDF.');
  return ctx;
}

function canvasFor(wMm: number, hMm: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(wMm * PX_PER_MM));
  canvas.height = Math.max(1, Math.ceil(hMm * PX_PER_MM));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the Arabic for a PDF.');
  return { canvas, ctx };
}

/** Line height, in points, that leaves room for vowel marks above and below. */
const LINE = 1.85;

interface TextPictureOptions {
  text: string;
  pt: number;
  /** Widest the picture may be, in mm; longer text wraps. */
  maxW: number;
  rtl: boolean;
  color?: string;
}

/** A run of text, wrapped to a width, drawn with the right base direction. */
function textPicture({ text, pt, maxW, rtl, color = INK }: TextPictureOptions): Picture {
  const font = `${pt * PX_PER_PT}px ${rtl ? ARABIC_FONT : `${LATIN_FONT}, ${ARABIC_FONT}`}`;
  const m = scratch();
  m.font = font;
  m.direction = rtl ? 'rtl' : 'ltr';
  const maxPx = maxW * PX_PER_MM;

  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && m.measureText(tryLine).width > maxPx) {
      lines.push(line);
      line = word;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);

  const widest = Math.min(maxPx, Math.max(...lines.map((l) => m.measureText(l).width)));
  const w = widest / PX_PER_MM + 0.5;
  const lh = pt * LINE * MM_PER_PT;
  const h = lines.length * lh;

  const { canvas, ctx } = canvasFor(w, h);
  ctx.font = font;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = rtl ? 'right' : 'left';
  lines.forEach((l, i) => {
    ctx.fillText(l, rtl ? canvas.width : 0, (i + 0.5) * lh * PX_PER_MM);
  });
  return { url: canvas.toDataURL('image/png'), w, h };
}

/** "Root  ك ت ب   Plural  بُيُوت": small grey labels, each followed by its Arabic. */
function factsPicture(facts: EntryParts['facts'], pt: number, maxW: number): Picture {
  const labelPt = pt * 0.55;
  const labelFont = `${labelPt * PX_PER_PT}px ${LATIN_FONT}`;
  const valueFont = `${pt * PX_PER_PT}px ${ARABIC_FONT}`;
  const gapLabel = 1.6 * PX_PER_MM;
  const gapItem = 6 * PX_PER_MM;
  const maxPx = maxW * PX_PER_MM;

  const m = scratch();
  const items = facts.map((f) => {
    m.font = labelFont;
    m.direction = 'ltr';
    const lw = m.measureText(f.label).width;
    m.font = valueFont;
    m.direction = 'rtl';
    const vw = m.measureText(f.value).width;
    return { ...f, lw, vw, w: lw + gapLabel + vw };
  });

  // Lay the items out left to right, starting a new line when one would not fit.
  const rows: { item: (typeof items)[number]; x: number }[][] = [[]];
  let x = 0;
  for (const item of items) {
    if (x > 0 && x + item.w > maxPx) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push({ item, x });
    x += item.w + gapItem;
  }

  const w = Math.min(maxPx, Math.max(...rows.map((r) => r.length ? r[r.length - 1].x + r[r.length - 1].item.w : 0))) / PX_PER_MM + 0.5;
  const lh = pt * LINE * MM_PER_PT;
  const { canvas, ctx } = canvasFor(w, rows.length * lh);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  rows.forEach((row, r) => {
    const y = (r + 0.5) * lh * PX_PER_MM;
    for (const { item, x: ix } of row) {
      ctx.font = labelFont;
      ctx.direction = 'ltr';
      ctx.fillStyle = GREY;
      ctx.fillText(item.label, ix, y);
      ctx.font = valueFont;
      ctx.direction = 'rtl';
      ctx.fillStyle = INK;
      ctx.fillText(item.value, ix + item.lw + gapLabel, y);
    }
  });
  return { url: canvas.toDataURL('image/png'), w, h: rows.length * lh };
}

// -- Entries -----------------------------------------------------------------

/** One thing on the page: how tall it is, and how to draw it at a given top edge. */
interface Block {
  h: number;
  draw: (doc: jsPDF, y: number) => void;
}

/** What a built-in PDF font can show. Anything else is drawn as a picture. */
const LATIN_SAFE = /^[ -~ -ÿ–—‘’“”…]*$/;

interface LatinOptions {
  text: string;
  x: number;
  maxW: number;
  pt: number;
  bold?: boolean;
  italic?: boolean;
  color: [number, number, number];
  hex: string;
}

/** A paragraph of English: real PDF text when it can be, a picture when it can't. */
function latinBlock(doc: jsPDF, o: LatinOptions): Block {
  const lineMm = o.pt * MM_PER_PT * 1.4;
  if (!LATIN_SAFE.test(o.text)) {
    const pic = textPicture({ text: o.text, pt: o.pt, maxW: o.maxW, rtl: false, color: o.hex });
    return { h: pic.h, draw: (d, y) => d.addImage(pic.url, 'PNG', o.x, y, pic.w, pic.h, undefined, 'FAST') };
  }
  doc.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
  doc.setFontSize(o.pt);
  const lines: string[] = doc.splitTextToSize(o.text, o.maxW);
  return {
    h: lines.length * lineMm,
    draw: (d, y) => {
      d.setFont('helvetica', o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
      d.setFontSize(o.pt);
      d.setTextColor(...o.color);
      lines.forEach((l, i) => d.text(l, o.x, y + i * lineMm + o.pt * MM_PER_PT * 1.0));
    },
  };
}

function pictureBlock(pic: Picture, align: 'left' | 'right'): Block {
  return {
    h: pic.h,
    draw: (d, y) => d.addImage(pic.url, 'PNG', align === 'right' ? RIGHT - pic.w : TEXT_X, y, pic.w, pic.h, undefined, 'FAST'),
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Everything one word needs on the page, measured, and ready to be placed. */
function entryBlocks(doc: jsPDF, n: number, p: EntryParts): Block[] {
  const blocks: Block[] = [];
  const wordPic = textPicture({ text: p.arabic, pt: 22, maxW: 70, rtl: true });
  const englishW = RIGHT - TEXT_X - wordPic.w - 5;

  // Top row: number and English on the left, the Arabic word on the right.
  const english = latinBlock(doc, {
    text: p.english || '—', x: TEXT_X, maxW: englishW, pt: 12, bold: true, color: [17, 17, 17], hex: INK,
  });
  const rowH = Math.max(english.h, wordPic.h);
  blocks.push({
    h: rowH,
    draw: (d, y) => {
      d.setFont('helvetica', 'normal');
      d.setFontSize(8);
      d.setTextColor(150, 150, 150);
      d.text(String(n), NUM_X, y + 4);
      english.draw(d, y + (rowH - english.h) / 2);
      d.addImage(wordPic.url, 'PNG', RIGHT - wordPic.w, y + (rowH - wordPic.h) / 2, wordPic.w, wordPic.h, undefined, 'FAST');
    },
  });

  const meta = metaLine(p);
  if (meta) {
    blocks.push(latinBlock(doc, { text: meta, x: TEXT_X, maxW: RIGHT - TEXT_X, pt: 8.5, color: [107, 107, 107], hex: GREY }));
  }
  if (p.facts.length) {
    blocks.push(pictureBlock(factsPicture(p.facts, 13, RIGHT - TEXT_X), 'left'));
  }
  if (p.sentence) {
    blocks.push(pictureBlock(textPicture({ text: p.sentence.ar, pt: 14, maxW: RIGHT - TEXT_X, rtl: true }), 'right'));
    if (p.sentence.en) {
      blocks.push(latinBlock(doc, { text: p.sentence.en, x: TEXT_X, maxW: RIGHT - TEXT_X, pt: 9, italic: true, color: [107, 107, 107], hex: GREY }));
    }
  }
  if (p.quran) {
    blocks.push(pictureBlock(textPicture({ text: p.quran.ar, pt: 14, maxW: RIGHT - TEXT_X, rtl: true }), 'right'));
    const note = [p.quran.en, p.quran.ref ? `(${p.quran.ref})` : null].filter(Boolean).join(' ');
    if (note) {
      blocks.push(latinBlock(doc, { text: note, x: TEXT_X, maxW: RIGHT - TEXT_X, pt: 9, italic: true, color: [107, 107, 107], hex: GREY }));
    }
  }
  return blocks;
}

const GAP = 1.6;
const AFTER = 5;

export interface PdfOptions {
  range: ExportRange;
  now?: Date;
  /** Called as entries are built, so a long deck can show it is working. */
  onProgress?: (done: number, total: number) => void;
}

/** Builds the PDF and returns it as a file. */
export async function buildDeckPdf(cards: FlashCard[], { range, now = new Date(), onProgress }: PdfOptions): Promise<Blob> {
  await loadArabicFont();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const dateLabel = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getFullYear()}`;
  doc.setProperties({ title: 'My Arabic words', subject: `${cards.length} words, ${RANGE_LABEL[range]}`, creator: 'Wazn' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(17, 17, 17);
  doc.text('My Arabic words', MARGIN, TOP + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 107, 107);
  doc.text(`${cards.length} ${cards.length === 1 ? 'word' : 'words'} · ${RANGE_LABEL[range]} · exported ${dateLabel}`, MARGIN, TOP + 11);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, TOP + 15, RIGHT, TOP + 15);

  let y = TOP + 22;
  for (let i = 0; i < cards.length; i++) {
    const blocks = entryBlocks(doc, i + 1, describeCard(cards[i]));
    const height = sum(blocks.map((b) => b.h)) + GAP * (blocks.length - 1);

    // An entry never splits across pages; it moves to the next one whole.
    if (y + height > BOTTOM && y > TOP + 1) {
      doc.addPage();
      y = TOP;
    }
    let by = y;
    for (const b of blocks) {
      b.draw(doc, by);
      by += b.h + GAP;
    }
    y += height + AFTER / 2;
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.2);
    doc.line(TEXT_X, y, RIGHT, y);
    y += AFTER / 2;

    onProgress?.(i + 1, cards.length);
    // Let the page repaint now and then; a big deck takes a few seconds.
    if (i % 15 === 14) await new Promise((r) => setTimeout(r, 0));
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Wazn · page ${p} of ${pages}`, PAGE_W / 2, PAGE_H - 9, { align: 'center' });
  }

  return doc.output('blob');
}
