"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

let workerConfigured = false;
async function ensurePDFWorker() {
  if (typeof window === "undefined" || workerConfigured) return;
  const { GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL(
    "/pdf.worker.mjs",
    window.location.origin
  ).toString();
  workerConfigured = true;
}

export function usePDFDocument() {
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("document");
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [documentKey, setDocumentKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  const onPickFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const fileData = buf.slice(0);
      await ensurePDFWorker();
      const { getDocument } = await import("pdfjs-dist");
      const task = getDocument({ data: new Uint8Array(buf) });
      const doc = await task.promise;

      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
      }
      pdfDocRef.current = doc;
      setPdfDoc(doc);
      setArrayBuffer(fileData);
      setFileName(f.name.replace(/\.[^.]+$/, "") || "document");
      setNumPages(doc.numPages);
      setDocumentKey((key) => key + 1);
    } catch (err) {
      console.error(err);
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      setError("Could not read that PDF. Try another file.");
      setArrayBuffer(null);
      setFileName("document");
      setNumPages(0);
      setPdfDoc(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      const doc = pdfDocRef.current;
      if (doc) void doc.destroy();
    };
  }, []);

  return {
    arrayBuffer,
    busy,
    documentKey,
    error,
    fileName,
    numPages,
    onPickFile,
    pdfDoc,
    setBusy,
    setError,
  };
}
