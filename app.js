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

// === Daftar URL upload target ===
const TARGET_URLS = [
  "https://lama.bg/wp-content/plugins/supportboard/supportboard/include/upload.php",
  "https://tavanpajouhan.com/wp-content/plugins/supportboard/supportboard/include/upload.php",
  "https://vibe.md/wp-content/plugins/supportboard/supportboard/include/upload.php",
  "https://westgallery.ir/wp-content/plugins/supportboard/supportboard/include/upload.php",
  "https://zorone.ir/wp-content/plugins/supportboard/supportboard/include/upload.php",
  "https://mymim.net/egov/wp-content/plugins/supportboard/supportboard/include/upload.php",
  "https://smkn1nganjuk.sch.id/wp-content/plugins/supportboard/supportboard/include/upload.php"
];

function getRandomUrl() {
  return TARGET_URLS[Math.floor(Math.random() * TARGET_URLS.length)];
}

function randomId(length = 3) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function uploadToRandom(buffer, originalName) {
  const randomUrl = getRandomUrl();

  // Ambil ekstensi file
  const ext = path.extname(originalName) || '.jpg';
  const fileName = `bagus_${randomId(3)}${ext}`;

  const formData = new FormData();
  formData.append('file', buffer, fileName);

  const res = await fetch(randomUrl, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error(`Upload gagal (${res.status} ${res.statusText}) ke ${randomUrl}`);

  const text = await res.text();

  // parsing hasil (karena output berupa array string)
  let fileUrl;
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json) && json[0] === "success" && typeof json[1] === "string") {
      fileUrl = json[1].replace(/\\\//g, "/"); // hilangkan escape slashes
    }
  } catch {
    throw new Error(`Respon tidak valid dari server: ${text.slice(0, 200)}...`);
  }

  if (!fileUrl) throw new Error("Gagal mendapatkan URL upload");

  const size = formatBytes(buffer.length);

  return { url: fileUrl, size };
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const file = req.file;

    const result = await uploadToRandom(file.buffer, file.originalname);

    res.json({
      success: true,
      url: result.url,
      size: result.size
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
  console.log(`Server berjalan pada http://localhost:${PORT}`);
});
