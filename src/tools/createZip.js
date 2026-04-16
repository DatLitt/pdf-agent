import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import archiver from "archiver";

const OUTPUT_DIR = "temp";

export async function createZipFromFiles(filePaths, zipName = null) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error("No files provided for zip creation");
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const outputName = zipName || `result-${Date.now()}.zip`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outputPath));
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const filePath of filePaths) {
      archive.file(filePath, { name: path.basename(filePath) });
    }

    archive.finalize();
  });
}
