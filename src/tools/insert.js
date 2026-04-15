import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

const OUTPUT_DIR = "temp";

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const buildOutputPath = () => {
  const name = `insert-${Date.now()}.pdf`;
  return path.join(OUTPUT_DIR, name);
};

export async function insertPDF(files, position = 1) {
  if (!Array.isArray(files) || files.length < 2) {
    throw new Error("Insert requires exactly 2 PDF files");
  }

  if (!Number.isInteger(position) || position < 1) {
    throw new Error("Insert position must be a positive integer");
  }

  const [baseFile, insertFile] = files;
  const baseBytes = await fs.readFile(baseFile.path);
  const insertBytes = await fs.readFile(insertFile.path);

  const basePdf = await PDFDocument.load(baseBytes);
  const insertPdf = await PDFDocument.load(insertBytes);
  const outputPdf = await PDFDocument.create();

  const basePages = basePdf.getPageIndices();
  const insertPages = insertPdf.getPageIndices();
  const insertIndex = Math.min(position - 1, basePages.length);

  const beforePages = basePages.slice(0, insertIndex);
  const afterPages = basePages.slice(insertIndex);

  const copiedBefore = await outputPdf.copyPages(basePdf, beforePages);
  for (const page of copiedBefore) {
    outputPdf.addPage(page);
  }

  const copiedInsert = await outputPdf.copyPages(insertPdf, insertPages);
  for (const page of copiedInsert) {
    outputPdf.addPage(page);
  }

  const copiedAfter = await outputPdf.copyPages(basePdf, afterPages);
  for (const page of copiedAfter) {
    outputPdf.addPage(page);
  }

  const pdfBytes = await outputPdf.save();
  await ensureOutputDir();

  const outputPath = buildOutputPath();
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}
