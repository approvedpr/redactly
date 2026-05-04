import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const from = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs");
const toDir = join(root, "public");
const to = join(toDir, "pdf.worker.mjs");

if (existsSync(from)) {
  mkdirSync(toDir, { recursive: true });
  copyFileSync(from, to);
}
