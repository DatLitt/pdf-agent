import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

const OUTPUT_DIR = "temp";

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const buildOutputPath = () => {
  const name = `delete-${Date.now()}.pdf`;
  return path.join(OUTPUT_DIR, name);
};

export async function deletePDF(file, pages = []) {
  if (!file || !file.path) {
    throw new Error("Delete requires one input PDF file");
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("Delete requires a non-empty pages array");
  }

  const inputBytes = await fs.readFile(file.path);
  const inputPdf = await PDFDocument.load(inputBytes);
  const totalPages = inputPdf.getPageCount();

  const uniquePages = [...new Set(pages)];
  const deleteSet = new Set();

  for (const page of uniquePages) {
    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      throw new Error("Invalid page number in delete operation");
    }
    deleteSet.add(page - 1);
  }

  const outputPdf = await PDFDocument.create();
  const keepPages = [];

  for (let index = 0; index < totalPages; index += 1) {
    if (!deleteSet.has(index)) {
      keepPages.push(index);
    }
  }

  const copiedPages = await outputPdf.copyPages(inputPdf, keepPages);
  for (const page of copiedPages) {
    outputPdf.addPage(page);
  }

  const pdfBytes = await outputPdf.save();
  await ensureOutputDir();

  const outputPath = buildOutputPath();
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}
