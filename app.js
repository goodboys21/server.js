const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');

const upload = multer();
const app = express();
const PORT = 3000;

// === Fungsi upload langsung ke GitHub ===
async function uploadToClugo(buffer, originalName) {
  const tokenRes = await fetch("https://json.link/RqiRdVnRL0.json");
  const tokenJson = await tokenRes.json();
  const token = tokenJson.token;

  const random = Array.from({ length: 5 }, () =>
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      .charAt(Math.floor(Math.random() * 62))
  ).join("");

  const ext = originalName.includes(".")
    ? originalName.split(".").pop()
    : "";

  const finalName = ext ? `${random}.${ext}` : random;

  const username = "bagus-api";
  const repo = "storage";
  const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${finalName}`;
  const base64content = buffer.toString("base64");

  const uploadRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `token ${token}`,
      "User-Agent": "upload-script"
    },
    body: JSON.stringify({
      message: `Upload ${finalName}`,
      content: base64content
    })
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal upload ke GitHub (${uploadRes.status}): ${errText.slice(0, 100)}`);
  }

  return {
    filename: finalName,
    size: buffer.length
  };
}

// format byte → MB
function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
    const result = await uploadToClugo(file.buffer, file.originalname);

    // generate url RAW GitHub (diubah seolah domain Clugo)
    const url = `https://raw.githubusercontent.com/bagus-api/storage/master/${result.filename}`;

    res.json({
      success: true,
      url,
      size: formatSize(result.size)
    });

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
