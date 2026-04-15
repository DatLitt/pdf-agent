import { mergePDFs } from "./merge.js";
import { deletePDF } from "./delete.js";
import { insertPDF } from "./insert.js";
import { reorderPDF } from "./reorder.js";
import { splitPDF } from "./split.js";

export async function executePdfAction(action, files) {
  if (!action || typeof action !== "object") {
    throw new Error("Invalid action payload");
  }

  if (action.operation === "merge") {
    return mergePDFs(files);
  }

  if (action.operation === "split") {
    const file = files?.[0];
    const ranges = action?.options?.ranges;
    return splitPDF(file, ranges);
  }

  if (action.operation === "insert") {
    const position = action?.options?.position;
    return insertPDF(files, position);
  }

  if (action.operation === "delete") {
    const file = files?.[0];
    const pages = action?.options?.pages;
    return deletePDF(file, pages);
  }

  if (action.operation === "reorder") {
    const file = files?.[0];
    const pages = action?.options?.pages;
    return reorderPDF(file, pages);
  }

  throw new Error(`Operation not supported yet: ${action.operation}`);
}
