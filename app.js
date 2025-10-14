// index.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // v2.x recommended for CommonJS
const FormData = require('form-data');
const path = require('path');

const upload = multer(); // memory storage
const app = express();
const PORT = 3000;

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Upload to target (smkn1nganjuk) — mirrors the working curl
async function uploadToTarget(buffer, originalName) {
  const form = new FormData();
  const fileName = path.basename(originalName || "file");

  // Important: use field name "file" (sesuai curl yang work)
  form.append('file', buffer, {
    filename: fileName,
    contentType: 'application/octet-stream'
  });

  // getHeaders() -> includes multipart boundary
  const headers = form.getHeaders();
  // plugin sometimes expects X-Requested-With
  headers['X-Requested-With'] = 'XMLHttpRequest';

  // Optional: If you want to set a User-Agent similar to curl:
  headers['User-Agent'] = 'curl/8.15.0';

  // Send request
  const resp = await fetch('https://smkn1nganjuk.sch.id/wp-content/plugins/supportboard/supportboard/include/upload.php', {
    method: 'POST',
    headers,
    body: form,
    // don't set 'Content-Length' manually; form-data will stream it
  });

  const text = await resp.text();

  // Log raw response for debugging
  console.log('--- remote raw response ---');
  console.log(text);
  console.log('--- http status ---', resp.status);

  if (!resp.ok) {
    throw new Error(`Upload gagal: ${resp.status} ${resp.statusText} | body: ${text}`);
  }

  // Server returns array like ["success","https:\/\/...\/file.mp4"]
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json) && json[0] === "success") {
      const uploadedUrl = json[1].replace(/\\\//g, "/");
      return { url: uploadedUrl, size: formatBytes(buffer.length) };
    } else {
      throw new Error(`Respon unexpected: ${text}`);
    }
  } catch (err) {
    // jika tidak valid JSON, bubble up
    throw new Error(`Gagal parse respon: ${err.message} | raw: ${text}`);
  }
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true }));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const file = req.file;

    // debug: show info about incoming file
    console.log('Incoming file:', { originalname: file.originalname, size: file.size });

    const result = await uploadToTarget(file.buffer, file.originalname);

    res.json({
      success: true,
      url: result.url,
      size: result.size
    });
  } catch (err) {
    console.error('Error upload:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
