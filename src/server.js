import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { promises as fsp } from "fs";
import { runPdfAgent } from "./agent/runAgent.js";
import { createZipFromFiles } from "./tools/createZip.js";

dotenv.config();

const FRONTEND_ORIGINS = new Set(
  (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const ensureFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

ensureFolder("uploads");
ensureFolder("temp");

const cleanupPaths = async (paths = []) => {
  for (const filePath of paths) {
    if (!filePath) continue;

    try {
      await fsp.unlink(filePath);
    } catch {
      // Ignore cleanup failures so they do not break the user flow.
    }
  }
};

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && (FRONTEND_ORIGINS.size === 0 || FRONTEND_ORIGINS.has(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" ||
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdf) {
    return cb(new Error("Only PDF files are allowed"));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 2,
    fileSize: 20 * 1024 * 1024,
  },
});

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "PDF agent server is running" });
});

app.post("/upload", upload.array("files", 2), (req, res) => {
  const files = (req.files || []).map((file, index) => ({
    fileId: `file_${index + 1}`,
    originalName: file.originalname,
    storedName: file.filename,
    path: file.path,
  }));

  res.json({
    message: "Files uploaded successfully",
    count: files.length,
    files,
  });
});

app.post("/execute", upload.array("files", 2), async (req, res, next) => {
  try {
    const prompt = req.body?.prompt?.trim();

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const files = req.files || [];
    const result = await runPdfAgent(prompt, files);

    if (Array.isArray(result.output) && result.output.length > 1) {
      const zipPath = await createZipFromFiles(result.output);

      return res.download(zipPath, "result.zip", async () => {
        await cleanupPaths(result.cleanupPaths);
        await cleanupPaths(result.output);
        await cleanupPaths([zipPath]);
      });
    }

    const singleOutput = Array.isArray(result.output)
      ? result.output[0]
      : result.output;

    return res.download(singleOutput, "result.pdf", async () => {
      await cleanupPaths(result.cleanupPaths);
      await cleanupPaths([singleOutput]);
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message || "Upload failed" });
  }

  next();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
