"use client";

import dynamic from "next/dynamic";
import PDFLanding from "@/features/PDF/components/PDFLanding";
import { usePDFDocument } from "@/features/PDF/hooks/usePDFDocument";

const PDFEditor = dynamic(() => import("@/features/PDF/components/PDFEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#fffaf1] text-sm font-semibold text-stone-700">
      Loading editor...
    </div>
  ),
});

export default function Home() {
  const {
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
  } = usePDFDocument();

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 text-stone-950 sm:px-6 lg:px-8">
      {error && (
        <p
          className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {arrayBuffer && pdfDoc && numPages > 0 ? (
        <PDFEditor
          key={documentKey}
          arrayBuffer={arrayBuffer}
          busy={busy}
          fileName={fileName}
          numPages={numPages}
          onPickFile={onPickFile}
          pdfDoc={pdfDoc}
          setBusy={setBusy}
          setError={setError}
        />
      ) : (
        <PDFLanding busy={busy} onPickFile={onPickFile} />
      )}
    </main>
  );
}
