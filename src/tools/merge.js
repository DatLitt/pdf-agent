import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

const OUTPUT_DIR = "temp";

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const buildOutputPath = () => {
  const name = `output-${Date.now()}.pdf`;
  return path.join(OUTPUT_DIR, name);
};

export async function mergePDFs(files) {
  if (!Array.isArray(files) || files.length < 2) {
    throw new Error("Merge requires exactly 2 PDF files");
  }

  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const inputBytes = await fs.readFile(file.path);
    const inputPdf = await PDFDocument.load(inputBytes);
    const copiedPages = await mergedPdf.copyPages(
      inputPdf,
      inputPdf.getPageIndices()
    );

    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const pdfBytes = await mergedPdf.save();
  await ensureOutputDir();

  const outputPath = buildOutputPath();
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}
