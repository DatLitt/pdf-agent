import express from "express";
import dotenv from "dotenv";
import fs from "fs";

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
