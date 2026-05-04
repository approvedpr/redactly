import { PDFDocument } from "pdf-lib";
import type { PDFPageProxy } from "pdfjs-dist";
import type { Blackout } from "../types";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const RASTER_LONG_EDGE = 2200;
const RASTER_MAX_SCALE = 2.5;

/**
 * Renders a page in the browser to a bitmap, draws blackouts, embeds the image
 * as the new page. Underlying text is not copyable (flattened to pixels).
 */
async function addRasterizedPage(
  out: PDFDocument,
  page: PDFPageProxy,
  blackouts: Blackout[]
) {
  const v1 = page.getViewport({ scale: 1 });
  const wPt = v1.width;
  const hPt = v1.height;
  const longEdge = Math.max(wPt, hPt);
  const baseScale = Math.min(RASTER_MAX_SCALE, RASTER_LONG_EDGE / longEdge);
  const vLoose = page.getViewport({ scale: baseScale });
  const cw = Math.max(1, Math.floor(vLoose.width));
  const ch = Math.max(1, Math.floor(vLoose.height));
  const renderVp = page.getViewport({
    scale: baseScale * (cw / vLoose.width),
  });

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not get canvas context");

  await page.render({ canvas, canvasContext: ctx, viewport: renderVp }).promise;

  ctx.save();
  ctx.fillStyle = "#000000";
  for (const b of blackouts) {
    const x = clamp(b.x, 0, 1) * cw;
    const y = clamp(b.y, 0, 1) * ch;
    const w = clamp(b.w, 0, 1) * cw;
    const h = clamp(b.h, 0, 1) * ch;
    if (w < 1 || h < 1) continue;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  const blob = await new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("PNG export"))),
      "image/png"
    );
  });
  const pngData = new Uint8Array(await blob.arrayBuffer());
  const png = await out.embedPng(pngData);
  const p = out.addPage([wPt, hPt]);
  p.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });
}

/**
 * Produces a new PDF with the chosen page order. Pages with blackouts are
 * fully rasterized so no text is selectable in those areas (and nothing under
 * the box can be copied). Unredacted pages stay as vectors for smaller size.
 *
 * Always opens a fresh PDF.js `getDocument` for export. Reusing the viewer
 * document can break after React/Turbopack refresh (null worker `sendWithPromise`).
 */
export async function buildExportedPDF(
  fileData: ArrayBuffer,
  pageIndices: number[],
  blackouts: Blackout[]
): Promise<Uint8Array> {
  if (typeof window === "undefined") {
    throw new Error("Export must run in the browser");
  }

  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  // Always re-set: avoids stale/empty transport when worker was reloaded
  GlobalWorkerOptions.workerSrc = new URL(
    "pdf.worker.mjs",
    window.location.origin
  ).toString();

  const dataCopy = new Uint8Array(fileData.slice(0));
  const loadingTask = getDocument({ data: dataCopy });
  const pdfjsDoc = await loadingTask.promise;

  const srcPDF = await PDFDocument.load(fileData);
  const n = srcPDF.getPageCount();
  const out = await PDFDocument.create();

  try {
    for (const pageIdx of pageIndices) {
      if (pageIdx < 0 || pageIdx >= n) continue;
      const pageBlackouts = blackouts.filter((b) => b.pageIndex === pageIdx);
      if (pageBlackouts.length > 0) {
        const p = await pdfjsDoc.getPage(pageIdx + 1);
        await addRasterizedPage(out, p, pageBlackouts);
      } else {
        const [copied] = await out.copyPages(srcPDF, [pageIdx]);
        out.addPage(copied);
      }
    }
  } finally {
    void pdfjsDoc.destroy();
  }

  return out.save();
}
