const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { fileTypeFromBuffer } = require('file-type');
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

// fungsi upload ke top4top
async function uploadToTop4Top(buffer) {
  const origin = 'https://top4top.io';
  const f = await fileTypeFromBuffer(buffer);
  if (!f) throw new Error('Gagal mendapatkan ekstensi file/buffer');

  const data = new FormData();
  const fileName = `${Date.now()}.${f.ext}`;
  data.append('file_1_', new Blob([buffer]), fileName);
  data.append('submitr', '[ رفع الملفات ]');

  console.log('uploading file.. ' + fileName);
  const res = await fetch(origin + '/index.php', { method: 'POST', body: data });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  const html = await res.text();
  const matches = html.matchAll(/<input readonly="readonly" class="all_boxes" onclick="this.select\(\);" type="text" value="(.+?)" \/>/g);
  const arr = Array.from(matches);
  if (!arr.length) throw new Error('Gagal mengupload file');

  const downloadUrl = arr.map(v => v[1]).find(v => v.endsWith(f.ext));
  if (!downloadUrl) throw new Error('Tidak menemukan URL hasil upload');

  return downloadUrl;
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const file = req.file;
    const randomId = generateId();
    const ext = path.extname(file.originalname) || ".bin";
    const newFileName = `${randomId}${ext}`;

    // upload ke top4top
    const uploadedUrl = await uploadToTop4Top(file.buffer);

    res.json({
      success: true,
      url: uploadedUrl,
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
