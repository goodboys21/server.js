const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const FormData = require('form-data');

const upload = multer();
const app = express();
const PORT = 3000;

// === Fungsi upload langsung ke Clugo ===
async function uploadToClugo(buffer, originalName) {
  const formData = new FormData();
  formData.append("file", buffer, originalName);

  const uploadRes = await fetch("https://www.clugo.my.id/upload", {
    method: "POST",
    body: formData
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal upload ke Clugo (${uploadRes.status}): ${errText.slice(0, 100)}`);
  }

  // ⬇️ langsung balikin respon asli dari server Clugo
  return await uploadRes.json();
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

    // ⏳ Delay 5 detik sebelum kirim respon (biar sama kayak sebelumnya)
    setTimeout(() => {
      res.json(result); // langsung kirim respon Clugo
    }, 5000);

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
