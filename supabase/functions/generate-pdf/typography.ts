import { PDFDocument, PDFFont, PDFPage, PDFPageDrawTextOptions } from "https://esm.sh/pdf-lib@1.17.1";

const fallbacks = new WeakMap<PDFFont, PDFFont>();
const international = /[^\u0000-\u024f\u2000-\u206f\u20a0-\u20cf]/u;
let brandBytes: Promise<Uint8Array[]> | undefined;

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("Report fonts could not be loaded. Please try again.");
  return new Uint8Array(await response.arrayBuffer());
}

export async function embedReportFonts(document: PDFDocument, text: string) {
  brandBytes ??= Promise.all([400, 700].map(weight => download(`https://cdn.jsdelivr.net/npm/@fontsource/geist@5.2.6/files/geist-latin-${weight}-normal.woff`))).catch(error => {
    brandBytes = undefined;
    throw error;
  });
  const [regularBytes, boldBytes] = await brandBytes;
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const characters = [...new Set(Array.from(text).filter(character => international.test(character)))].join("");
  if (characters) {
    const response = await fetch(`https://fonts.googleapis.com/css?family=Noto+Sans+SC&text=${encodeURIComponent(characters)}`, { signal: AbortSignal.timeout(30000) });
    const url = /url\((https:[^)]+)\)/.exec(await response.text())?.[1];
    if (!response.ok || !url) throw new Error("Couldn’t prepare the international report font.");
    // Google already subsets this font. Keep its glyph indices intact.
    const fallback = await document.embedFont(await download(url), { subset: false });
    fallbacks.set(regular, fallback);
    fallbacks.set(bold, fallback);
  }
  return { regular, bold };
}

function runs(text: string, font: PDFFont): Array<{ text: string; font: PDFFont }> {
  const fallback = fallbacks.get(font);
  const result: Array<{ text: string; font: PDFFont }> = [];
  for (const character of text) {
    const selected = fallback && international.test(character) ? fallback : font;
    const last = result[result.length - 1];
    if (last?.font === selected) last.text += character;
    else result.push({ text: character, font: selected });
  }
  return result;
}

export function textWidth(text: string, font: PDFFont, size: number): number {
  return runs(text, font).reduce((width, run) => width + run.font.widthOfTextAtSize(run.text, size), 0);
}

export function drawText(page: PDFPage, text: string, options: PDFPageDrawTextOptions) {
  const font = options.font;
  if (!font) throw new Error("Report text requires an explicit font.");
  const size = options.size ?? 12;
  text.split(/\r?\n/).forEach((line, index) => {
    let x = options.x ?? 0;
    const y = (options.y ?? 0) - index * (options.lineHeight ?? size * 1.3);
    for (const run of runs(line, font)) {
      page.drawText(run.text, { ...options, x, y, font: run.font });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
  });
}