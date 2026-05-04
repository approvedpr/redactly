"use client";

import type { ChangeEvent } from "react";

type PDFLandingProps = {
  busy: boolean;
  onPickFile: (e: ChangeEvent<HTMLInputElement>) => void;
};

const steps = [
  ["1", "Upload"],
  ["2", "Redact"],
  ["3", "Export"],
] as const;

const features = [
  [
    "Private by design",
    "Open PDFs locally in your browser and make edits without sending files to a server.",
  ],
  [
    "Safer redactions",
    "Blackout marked areas and export flattened pages so covered content is not selectable.",
  ],
  [
    "Keep what matters",
    "Choose the pages you need and preserve selectable text on pages that do not need blackouts.",
  ],
] as const;

const questions = [
  [
    "Are files uploaded?",
    "No. The editor runs in your browser, so your PDF stays on your device.",
  ],
  [
    "Can I remove pages?",
    "Yes. Uncheck pages you do not want before exporting the clean copy.",
  ],
  [
    "Can text be recovered?",
    "Pages with blackouts are flattened on export, so covered text is not left underneath.",
  ],
] as const;

export default function PDFLanding({ busy, onPickFile }: PDFLandingProps) {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-4xl border border-stone-950/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(55,45,30,0.12)] backdrop-blur sm:p-8">
          <div className="absolute -top-10 right-8 h-36 w-36 rounded-full bg-sky-200 blur-2xl" />
          <h2 className="relative max-w-2xl text-4xl font-black leading-none tracking-[-0.06em] text-stone-950 sm:text-6xl">
            Clean PDFs without the fuss.
          </h2>
          <p className="relative mt-5 max-w-xl text-base leading-7 text-stone-600">
            Pick a file, mark the pages you want, cover private details, and
            download a fresh copy.
          </p>
          <label className="relative mt-7 inline-flex cursor-pointer items-center justify-center rounded-full bg-stone-950 px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-stone-800">
            {busy ? "Working..." : "Upload PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={busy}
              onChange={onPickFile}
            />
          </label>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
            {steps.map(([step, label]) => (
              <div
                key={step}
                className="rounded-3xl border border-stone-950/10 bg-stone-50 p-4"
              >
                <p className="flex size-9 items-center justify-center rounded-full bg-lime-200 text-lg font-black text-stone-950">
                  {step}
                </p>
                <p className="mt-3 text-sm font-bold text-stone-700">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-4xl border border-stone-950/10 bg-lime-200 p-6 shadow-[0_24px_80px_rgba(55,45,30,0.12)]">
          <p className="text-sm font-bold text-stone-600">Good to know</p>
          <div className="mt-5 space-y-3 text-sm font-medium text-stone-700">
            <div className="rounded-3xl bg-white/80 p-4">
              Your PDF stays in your browser.
            </div>
            <div className="rounded-3xl bg-white/80 p-4">
              Pages with blackouts are flattened so hidden text is not left
              underneath.
            </div>
            <div className="rounded-3xl bg-white/80 p-4">
              Pages without blackouts keep selectable text and smaller files.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {features.map(([title, copy]) => (
          <article
            key={title}
            className="rounded-4xl border border-stone-950/10 bg-white/75 p-5 shadow-[0_16px_50px_rgba(55,45,30,0.08)] backdrop-blur"
          >
            <h3 className="text-lg font-black tracking-[-0.03em] text-stone-950">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">{copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-4xl border border-stone-950/10 bg-white/75 p-6 shadow-[0_16px_50px_rgba(55,45,30,0.08)] backdrop-blur">
        <p className="text-sm font-bold text-stone-500">Questions</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {questions.map(([question, answer]) => (
            <div key={question} className="rounded-3xl bg-stone-50 p-4">
              <h3 className="text-sm font-black text-stone-950">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
