const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const cors = require('cors');
const AdmZip = require('adm-zip');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fflate = require('fflate');
const qs = require('qs');
const cheerio = require('cheerio');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types'); 
const { Readable } = require('stream');
const upload = multer();
function generateId() {
  return Math.random().toString(36).substring(2, 7);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const app = express();
const PORT = 3000;

app.set('json spaces', 2);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '100mb' }));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // ambil config dari JSONBlob
    const configRes = await fetch(
      "https://jsonblob.com/api/jsonBlob/1422601050829021184"
    );
    const config = await configRes.json();
    const { github, cdn } = config;

    const file = req.file;
    const ext = path.extname(file.originalname) || ".bin";
    const randomId = generateId();
    const newFileName = `${randomId}${ext}`;

    // convert buffer ke base64 untuk upload ke github
    const contentBase64 = file.buffer.toString("base64");

    // push file ke github
    const githubApi = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${newFileName}`;
    const uploadRes = await fetch(githubApi, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${github.token}`,
        "Content-Type": "application/json",
        "User-Agent": "cloudgood-uploader",
      },
      body: JSON.stringify({
        message: `Upload ${newFileName}`,
        content: contentBase64,
        branch: github.branch,
      }),
    });

    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok) {
      return res.status(400).json({
        success: false,
        error: uploadJson.message || "Failed to upload to GitHub",
      });
    }

    // hasil final
    res.json({
      success: true,
      url: `https://raw.githubusercontent.com/codegood21/file/refs/heads/main/${newFileName}`,
      size: formatBytes(file.size),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});
        
