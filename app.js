const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const upload = multer();
const app = express();
const PORT = 3000;

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// fungsi upload ke tmpfiles
async function uploadToTmpfiles(buffer, ext = '.bin') {
  const origin = 'https://tmpfiles.org';
  const r1 = await fetch(origin);
  const cookie = r1.headers.raw()['set-cookie'].map(v => v.split('; ')[0]).join('; ');
  const html = await r1.text();
  const token = html.match(/token" value="(.+?)"/)?.[1];
  if (!token) throw new Error('Gagal mendapatkan token upload');

  const fileName = `${Date.now()}${ext}`;
  const formData = new FormData();
  formData.append('_token', token);
  formData.append('upload', 'Upload');
  formData.append('file', new Blob([buffer]), fileName);

  const r2 = await fetch(origin, {
    method: 'POST',
    headers: { cookie },
    body: formData
  });

  const html2 = await r2.text();
  const url = html2.match(/URL(?:.+?)href="(.+?)"/s)?.[1];
  if (!url) throw new Error('Gagal mendapatkan URL download');
  const size = html2.match(/Size(?:.+?)<td>(.+?)<\/td>/s)?.[1] || 'Unknown';

  return { url, size };
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const file = req.file;
    const ext = path.extname(file.originalname) || '.bin';

    const result = await uploadToTmpfiles(file.buffer, ext);

    res.json({
      success: true,
      url: result.url,
      size: result.size
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});
