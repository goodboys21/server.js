const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');
const path = require('path');

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

async function uploadToSnipi(buffer, originalName) {
  const formData = new FormData();
  const fileName = path.basename(originalName);
  formData.append('file', buffer, fileName);

  const res = await fetch('https://cdn.snipi.my.id/upload.php', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error(`Upload gagal: ${res.status} ${res.statusText}`);

  const json = await res.json();
  if (json.status !== "success" || !json.download)
    throw new Error('Gagal mendapatkan URL download');

  // ambil size dari file upload
  const size = formatBytes(buffer.length);

  return { url: json.download, size };
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const file = req.file;

    const result = await uploadToSnipi(file.buffer, file.originalname);

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
