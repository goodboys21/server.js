import express from "express";
import multer from "multer";
import crypto from "crypto";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const BASE_URL = process.env.BASE_URL;

function generateId() {
  return crypto.randomBytes(3).toString("hex").slice(0, 5);
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const id = generateId();
    const ext = req.file.originalname.split(".").pop();
    const filename = `${id}.${ext}`;
    const path = `f/${filename}`;

    const content = req.file.buffer.toString("base64");

    const githubUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
    const uploadRes = await fetch(githubUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `upload ${filename}`,
        content: content,
        branch: GITHUB_BRANCH,
      }),
    });

    const data = await uploadRes.json();

    if (!uploadRes.ok) {
      return res.status(500).json({ success: false, error: data });
    }

    const sizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      url: `${BASE_URL}/${filename}`,
      size: `${sizeMB} MB`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔑 Vercel handler
export default app;
