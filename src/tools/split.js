import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

const OUTPUT_DIR = "temp";

const ensureOutputDir = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const buildSplitOutputPath = (index) => {
  const name = `split-${Date.now()}-${index + 1}.pdf`;
  return path.join(OUTPUT_DIR, name);
};

export async function splitPDF(file, ranges) {
  if (!file || !file.path) {
    throw new Error("Split requires one input PDF file");
  }

  if (!Array.isArray(ranges) || ranges.length === 0) {
    throw new Error("Split requires at least one range");
  }

  const inputBytes = await fs.readFile(file.path);
  const inputPdf = await PDFDocument.load(inputBytes);
  const totalPages = inputPdf.getPageCount();
  const outputs = [];

  await ensureOutputDir();

  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];

    if (!Array.isArray(range) || range.length !== 2) {
      throw new Error("Each split range must be [start, end]");
    }

    const [start, end] = range;

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > totalPages
    ) {
      throw new Error("Invalid split range");
    }

    const splitPdf = await PDFDocument.create();
    const pageIndices = [];

    for (let page = start - 1; page <= end - 1; page += 1) {
      pageIndices.push(page);
    }

    const copiedPages = await splitPdf.copyPages(inputPdf, pageIndices);

    for (const page of copiedPages) {
      splitPdf.addPage(page);
    }

    const pdfBytes = await splitPdf.save();
    const outputPath = buildSplitOutputPath(i);
    await fs.writeFile(outputPath, pdfBytes);
    outputs.push(outputPath);
  }

  return outputs;
}
