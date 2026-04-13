import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { callLLM } from "./agent/llm.js";

/////TESTING HEREEE //////
const res = await callLLM("Say hello in JSON format");
console.log(`Gemini says: ${res}`);
/////////////////////////

dotenv.config();

const ensureFolder = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
};

ensureFolder("uploads");
ensureFolder("temp");

const app = express();

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
