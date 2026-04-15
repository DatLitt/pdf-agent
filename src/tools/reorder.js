import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

const OUTPUT_DIR = "temp";

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const buildOutputPath = () => {
  const name = `reorder-${Date.now()}.pdf`;
  return path.join(OUTPUT_DIR, name);
};

export async function reorderPDF(file, pages = []) {
  if (!file || !file.path) {
    throw new Error("Reorder requires one input PDF file");
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("Reorder requires a non-empty pages array");
  }

  const inputBytes = await fs.readFile(file.path);
  const inputPdf = await PDFDocument.load(inputBytes);
  const totalPages = inputPdf.getPageCount();

  const uniquePages = [...new Set(pages)];

  if (uniquePages.length !== totalPages) {
    throw new Error("Reorder pages must include every page exactly once");
  }

  const zeroBasedPages = uniquePages.map((page) => {
    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      throw new Error("Invalid page number in reorder operation");
    }

    return page - 1;
  });

  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(inputPdf, zeroBasedPages);

  for (const page of copiedPages) {
    outputPdf.addPage(page);
  }

  const pdfBytes = await outputPdf.save();
  await ensureOutputDir();

  const outputPath = buildOutputPath();
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}
