const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');

const upload = multer();
const app = express();
const PORT = 3000;

// === Ambil data GitHub dari JSON ===
const GITHUB_CONFIG_URL = "https://json.link/i3bIT3XHbS.json";

// === Helper Functions ===
function randomId(length = 3) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// === Fungsi upload ke GitHub ===
async function uploadToGitHub(buffer, originalName) {
  const githubData = await (await fetch(GITHUB_CONFIG_URL)).json();
  const { username, repo, folder, token } = githubData;

  const ext = path.extname(originalName) || '.jpg';
  const randomFileName = `${randomId(3)}${ext}`;
  const filePath = `${folder}/${randomFileName}`;

  const base64Content = buffer.toString('base64');
  const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`;

  const uploadRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "GoodUploader"
    },
    body: JSON.stringify({
      message: `Upload ${randomFileName}`,
      content: base64Content
    })
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal upload ke GitHub (${uploadRes.status}): ${errText.slice(0, 100)}`);
  }

  const size = formatBytes(buffer.length);

  // ✅ URL hasil akhir ke domain vercel
  const finalUrl = `https://files.clugo.my.id/file/${randomFileName}`;

  return { url: finalUrl, size };
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// === Endpoint upload ===
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const file = req.file;
    const result = await uploadToGitHub(file.buffer, file.originalname);

    // ⏳ Delay 4 detik sebelum respon
    setTimeout(() => {
      res.json({
        success: true,
        url: result.url,
        size: result.size
      });
    }, 4000);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
