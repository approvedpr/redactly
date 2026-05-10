"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildExportedPDF } from "../lib/exportPDF";
import type { Blackout } from "../types";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

const MAX_VIEW_WIDTH = 900;
const MIN_BOX = 0.01;

type NormRect = { x: number; y: number; w: number; h: number };
type DraftRect = NormRect | null;
type BoxInteraction = {
  id: string;
  mode: "move" | "resize";
  start: { nx: number; ny: number };
  original: NormRect;
} | null;
type PageItem = { id: string; pageIndex: number };

type PDFEditorProps = {
  arrayBuffer: ArrayBuffer;
  busy: boolean;
  fileName: string;
  numPages: number;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pdfDoc: PDFDocumentProxy;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};

function normFromPointer(
  el: HTMLElement,
  clientX: number,
  clientY: number
): { nx: number; ny: number } {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { nx: 0, ny: 0 };
  return {
    nx: (clientX - r.left) / r.width,
    ny: (clientY - r.top) / r.height,
  };
}

function makeNormRect(
  a: { nx: number; ny: number },
  b: { nx: number; ny: number }
) {
  const x = Math.max(0, Math.min(a.nx, b.nx, 1));
  const y = Math.max(0, Math.min(a.ny, b.ny, 1));
  const x2 = Math.min(1, Math.max(a.nx, b.nx, 0));
  const y2 = Math.min(1, Math.max(a.ny, b.ny, 0));
  return {
    x,
    y,
    w: Math.max(0, x2 - x),
    h: Math.max(0, y2 - y),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export default function PDFEditor({
  arrayBuffer,
  busy,
  fileName,
  numPages,
  onPickFile,
  pdfDoc,
  setBusy,
  setError,
}: PDFEditorProps) {
  const [viewPage, setViewPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(Array.from({ length: numPages }, (_, i) => i))
  );
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [draft, setDraft] = useState<DraftRect>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const drawStartRef = useRef<{ nx: number; ny: number } | null>(null);
  const boxInteractionRef = useRef<BoxInteraction>(null);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    const p = viewPage;
    if (p < 0 || p >= numPages) return;
    let cancelled = false;

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      const page = await pdfDoc.getPage(p + 1);
      if (cancelled) return;
      const at1 = page.getViewport({ scale: 1 });
      const fitScale = Math.min(MAX_VIEW_WIDTH / at1.width, 2);
      const viewport = page.getViewport({ scale: fitScale });
      if (cancelled) return;
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      if (cancelled) return;
      const renderVp = page.getViewport({
        scale: fitScale * (canvas.width / viewport.width),
      });
      if (cancelled) return;
      renderTaskRef.current?.cancel();
      const t = page.render({
        canvas,
        canvasContext: ctx,
        viewport: renderVp,
      });
      renderTaskRef.current = t;
      try {
        await t.promise;
      } catch (e) {
        if (cancelled) return;
        if ((e as Error)?.name !== "RenderingCancelledException") {
          console.error(e);
        }
        return;
      } finally {
        if (renderTaskRef.current === t) renderTaskRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDoc, numPages, viewPage]);

  const selectedSorted = useMemo(
    () =>
      Array.from(selected)
        .filter((i) => i < numPages)
        .sort((a, b) => a - b),
    [selected, numPages]
  );

  const pages = useMemo<PageItem[]>(
    () =>
      Array.from({ length: numPages }, (_, pageIndex) => ({
        id: `page-${pageIndex + 1}`,
        pageIndex,
      })),
    [numPages]
  );

  const currentBlackouts = useMemo(
    () => blackouts.filter((b) => b.pageIndex === viewPage),
    [blackouts, viewPage]
  );

  const blackoutCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const blackout of blackouts) {
      counts.set(blackout.pageIndex, (counts.get(blackout.pageIndex) ?? 0) + 1);
    }
    return counts;
  }, [blackouts]);

  const onExport = useCallback(async () => {
    if (selectedSorted.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const out = await buildExportedPDF(
        arrayBuffer,
        selectedSorted,
        blackouts
      );
      const copy = new Uint8Array(out.byteLength);
      copy.set(out);
      const blob = new Blob([copy], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}-edited.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError("Export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, [arrayBuffer, blackouts, fileName, selectedSorted, setBusy, setError]);

  const toggle = useCallback((i: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }, []);

  const openPage = useCallback((i: number) => {
    setViewPage(i);
    drawStartRef.current = null;
    setDraft(null);
  }, []);

  const onOverlayPointer = useCallback(
    (ev: React.PointerEvent) => {
      const el = overlayRef.current;
      if (!el) return;
      if (ev.type === "pointerdown" && ev.button !== 0) return;
      const current = normFromPointer(el, ev.clientX, ev.clientY);

      if (boxInteractionRef.current) {
        const interaction = boxInteractionRef.current;

        if (ev.type === "pointermove") {
          const dx = current.nx - interaction.start.nx;
          const dy = current.ny - interaction.start.ny;
          const next =
            interaction.mode === "move"
              ? {
                  x: clamp(
                    interaction.original.x + dx,
                    0,
                    Math.max(0, 1 - interaction.original.w)
                  ),
                  y: clamp(
                    interaction.original.y + dy,
                    0,
                    Math.max(0, 1 - interaction.original.h)
                  ),
                  w: interaction.original.w,
                  h: interaction.original.h,
                }
              : {
                  x: interaction.original.x,
                  y: interaction.original.y,
                  w: clamp(
                    interaction.original.w + dx,
                    MIN_BOX,
                    1 - interaction.original.x
                  ),
                  h: clamp(
                    interaction.original.h + dy,
                    MIN_BOX,
                    1 - interaction.original.y
                  ),
                };

          setBlackouts((boxes) =>
            boxes.map((box) =>
              box.id === interaction.id ? { ...box, ...next } : box
            )
          );
          return;
        }

        if (ev.type === "pointerup" || ev.type === "pointercancel") {
          boxInteractionRef.current = null;
          return;
        }
      }

      if (ev.type === "pointerdown") {
        (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
        drawStartRef.current = current;
        setDraft(null);
      } else if (ev.type === "pointermove" && drawStartRef.current) {
        const p0 = drawStartRef.current;
        setDraft(makeNormRect(p0, current));
      } else if (ev.type === "pointerup" || ev.type === "pointercancel") {
        const p0 = drawStartRef.current;
        drawStartRef.current = null;
        if (!p0) return;
        const r = makeNormRect(p0, current);
        if (r.w < MIN_BOX || r.h < MIN_BOX) {
          setDraft(null);
          return;
        }
        setBlackouts((b) => [
          ...b,
          {
            id: crypto.randomUUID(),
            pageIndex: viewPage,
            ...r,
          },
        ]);
        setDraft(null);
      }
    },
    [viewPage]
  );

  const onKey = useCallback((ev: React.KeyboardEvent) => {
    if (ev.key === "Escape") {
      drawStartRef.current = null;
      boxInteractionRef.current = null;
      setDraft(null);
    }
  }, []);

  const remove = useCallback((id: string) => {
    setBlackouts((b) => b.filter((x) => x.id !== id));
  }, []);
  const undo = useCallback(() => {
    setBlackouts((b) => b.slice(0, -1));
  }, []);
  const startBoxInteraction = useCallback(
    (
      ev: React.PointerEvent<HTMLElement>,
      box: Blackout,
      mode: "move" | "resize"
    ) => {
      if (ev.button !== 0) return;
      const el = overlayRef.current;
      if (!el) return;
      ev.preventDefault();
      ev.stopPropagation();
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
      drawStartRef.current = null;
      setDraft(null);
      boxInteractionRef.current = {
        id: box.id,
        mode,
        start: normFromPointer(el, ev.clientX, ev.clientY),
        original: { x: box.x, y: box.y, w: box.w, h: box.h },
      };
    },
    []
  );
  return (
    <div
      className="relative flex w-full flex-col text-stone-950"
      onKeyDown={onKey}
      aria-label="PDF editor"
      role="region"
      tabIndex={0}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[1.75rem] border border-stone-950/10 bg-white/75 p-3 shadow-[0_18px_60px_rgba(55,45,30,0.1)] backdrop-blur">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-stone-800">
          {busy ? "Working..." : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={onPickFile}
          />
        </label>
        <button
          type="button"
          disabled={selectedSorted.length === 0 || busy}
          onClick={onExport}
          className="rounded-full border border-stone-950/10 bg-lime-200 px-5 py-3 text-sm font-bold text-stone-950 transition enabled:hover:-translate-y-0.5 enabled:hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export Redacted Copy
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={blackouts.length === 0}
          className="rounded-full px-4 py-3 text-sm font-semibold text-stone-500 transition enabled:hover:bg-stone-100 enabled:hover:text-stone-950 disabled:opacity-35"
        >
          Undo
        </button>
        <p className="ml-auto max-w-full truncate px-2 text-sm font-medium text-stone-500">
          {fileName}.pdf
        </p>
      </div>

      {numPages > 0 && (
        <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="shrink-0">
            <div className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-stone-500">
              <span>Pages</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-stone-950 underline decoration-lime-400 decoration-2 underline-offset-4"
                  onClick={() =>
                    setSelected(
                      new Set(Array.from({ length: numPages }, (_, i) => i))
                    )
                  }
                >
                  all
                </button>
                <button
                  type="button"
                  className="text-stone-950 underline decoration-lime-400 decoration-2 underline-offset-4"
                  onClick={() => setSelected(new Set())}
                >
                  none
                </button>
              </div>
            </div>
            <ol className="max-h-[min(62vh,620px)] space-y-2 overflow-y-auto rounded-[1.75rem] border border-stone-950/10 bg-white/75 p-2 text-sm shadow-[0_16px_50px_rgba(55,45,30,0.08)] backdrop-blur">
              {pages.map(({ id, pageIndex }) => {
                const blackoutCount = blackoutCounts.get(pageIndex) ?? 0;
                return (
                  <li
                    key={id}
                    className={`group flex cursor-pointer items-center gap-3 rounded-full border px-3 py-2 transition ${
                      viewPage === pageIndex
                        ? "border-stone-950 bg-lime-200 text-stone-950 shadow-[0_6px_0_rgba(23,19,15,0.18)]"
                        : "border-transparent bg-white text-stone-600 hover:bg-sky-100 hover:text-stone-950"
                    }`}
                    onClick={() => openPage(pageIndex)}
                    onKeyDown={(ev) => {
                      if (ev.target !== ev.currentTarget) return;
                      if (ev.key !== "Enter" && ev.key !== " ") return;
                      ev.preventDefault();
                      openPage(pageIndex);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-stone-950"
                      checked={selected.has(pageIndex)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(pageIndex)}
                    />
                    <span className="font-bold">
                      Page {pageIndex + 1}
                      {blackoutCount > 0 && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                            viewPage === pageIndex
                              ? "bg-stone-950 text-white"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {blackoutCount}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-stone-950/10 bg-white/75 p-3 shadow-[0_16px_50px_rgba(55,45,30,0.08)] backdrop-blur">
              <p className="px-2 text-sm font-semibold text-stone-600">
                Page <span className="text-stone-950">{viewPage + 1}</span> of{" "}
                {numPages}
                {currentBlackouts.length > 0
                  ? ` · ${currentBlackouts.length} blackout${
                      currentBlackouts.length === 1 ? "" : "s"
                    }`
                  : null}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={viewPage <= 0}
                  onClick={() => openPage(Math.max(0, viewPage - 1))}
                  className="rounded-full border border-stone-950/10 bg-white px-4 py-2 text-sm font-bold text-stone-700 transition enabled:hover:bg-sky-100 disabled:opacity-35"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={viewPage >= numPages - 1}
                  onClick={() => openPage(Math.min(numPages - 1, viewPage + 1))}
                  className="rounded-full border border-stone-950/10 bg-white px-4 py-2 text-sm font-bold text-stone-700 transition enabled:hover:bg-sky-100 disabled:opacity-35"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="relative w-fit max-w-full overflow-hidden rounded-4xl border border-stone-950/10 bg-white p-3 shadow-[0_30px_90px_rgba(55,45,30,0.16)]">
              <canvas
                ref={canvasRef}
                className="block max-w-full rounded-[1.4rem]"
              />
              <div
                ref={overlayRef}
                className="absolute top-3 left-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]"
                onPointerDown={onOverlayPointer}
                onPointerMove={onOverlayPointer}
                onPointerUp={onOverlayPointer}
                onPointerCancel={onOverlayPointer}
                style={{
                  touchAction: "none",
                  cursor: "crosshair",
                }}
              >
                {currentBlackouts.map((b) => (
                  <div
                    key={b.id}
                    className="group absolute touch-none cursor-move rounded-xl border-2 border-stone-950 bg-stone-950 shadow-[0_8px_0_rgba(23,19,15,0.18)]"
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.w * 100}%`,
                      height: `${b.h * 100}%`,
                    }}
                    onPointerDown={(ev) => startBoxInteraction(ev, b, "move")}
                  >
                    <button
                      type="button"
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        remove(b.id);
                      }}
                      className="absolute top-1 right-1 z-10 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-stone-950 opacity-0 shadow-lg transition group-hover:opacity-100"
                    >
                      remove
                    </button>
                    <button
                      type="button"
                      aria-label="Resize blackout box"
                      onPointerDown={(ev) => startBoxInteraction(ev, b, "resize")}
                      className="absolute right-0 bottom-0 z-10 size-5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-white bg-lime-300 shadow-lg"
                    />
                  </div>
                ))}
                {draft && (
                  <div
                    className="absolute rounded-xl border-2 border-dashed border-stone-950 bg-lime-300/30"
                    style={{
                      left: `${draft.x * 100}%`,
                      top: `${draft.y * 100}%`,
                      width: `${draft.w * 100}%`,
                      height: `${draft.h * 100}%`,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>

            <p className="mt-4 max-w-3xl rounded-3xl bg-white/70 px-4 py-3 text-sm leading-6 text-stone-600 shadow-[0_12px_40px_rgba(55,45,30,0.08)]">
              Drag empty space to draw a black box. Drag a box to move it, pull
              the green corner to resize it, or use remove on the box. Escape
              cancels the active action.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
