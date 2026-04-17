const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const crypto = require('crypto');

const upload = multer();
const app = express();
const PORT = 3000;

// Konfigurasi GitHub
const GITHUB_USERNAME = "bagus-api";
const GITHUB_REPO_STORAGE = "storage";
const GITHUB_REPO_DB = "storage-db";
const DB_FILE = "database.json";

// === Fungsi ambil token GitHub ===
async function getGitHubToken() {
  try {
    const tokenRes = await fetch("https://json.link/RqiRdVnRL0.json");
    const tokenJson = await tokenRes.json();
    return tokenJson.token;
  } catch (error) {
    console.error("Error ambil token:", error);
    throw new Error("Gagal mengambil token GitHub");
  }
}

// === Fungsi baca database.json dari GitHub ===
async function readDatabase(token) {
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO_DB}/contents/${DB_FILE}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `token ${token}`,
        "User-Agent": "upload-script"
      }
    });
    
    if (response.status === 404) {
      return { files: {} };
    }
    
    if (!response.ok) {
      throw new Error(`Gagal baca database: ${response.status}`);
    }
    
    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error("Error baca database:", error);
    return { files: {} };
  }
}

// === Fungsi write/update database.json ke GitHub ===
async function writeDatabase(token, database) {
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO_DB}/contents/${DB_FILE}`;
  const content = Buffer.from(JSON.stringify(database, null, 2)).toString('base64');
  
  // Ambil SHA terlebih dahulu jika file sudah ada
  let sha = null;
  try {
    const checkRes = await fetch(url, {
      headers: {
        "Authorization": `token ${token}`,
        "User-Agent": "upload-script"
      }
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      sha = data.sha;
    }
  } catch (error) {
    console.log("File database belum ada, akan dibuat baru");
  }
  
  const body = {
    message: `Update database: menambah file hash`,
    content: content
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `token ${token}`,
      "User-Agent": "upload-script"
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal write database: ${response.status} - ${errText}`);
  }
  
  return await response.json();
}

// === Fungsi cek hash di database ===
async function checkFileExists(token, fileHash) {
  try {
    const database = await readDatabase(token);
    return database.files[fileHash] || null;
  } catch (error) {
    console.error("Error check file exists:", error);
    return null;
  }
}

// === Fungsi simpan hash ke database ===
async function saveFileHash(token, fileHash, fileData) {
  const database = await readDatabase(token);
  database.files[fileHash] = {
    ...fileData,
    uploadedAt: new Date().toISOString()
  };
  await writeDatabase(token, database);
}

// === Fungsi upload file ke GitHub storage ===
async function uploadToStorage(token, buffer, originalName) {
  const random = Array.from({ length: 5 }, () =>
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      .charAt(Math.floor(Math.random() * 62))
  ).join("");

  const ext = originalName.includes(".")
    ? originalName.split(".").pop()
    : "";

  const finalName = ext ? `${random}.${ext}` : random;
  const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO_STORAGE}/contents/${finalName}`;
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

// === Fungsi hash file ===
function getFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// format byte → MB
function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

// === ENDPOINT UPLOAD ===
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file uploaded" 
      });
    }

    const file = req.file;
    const fileHash = getFileHash(file.buffer);
    console.log("File hash:", fileHash);
    
    const token = await getGitHubToken();
    console.log("Token GitHub berhasil didapat");
    
    // Cek apakah file sudah pernah diupload
    const existingFile = await checkFileExists(token, fileHash);
    console.log("Existing file:", existingFile);
    
    if (existingFile) {
      return res.json({
        success: true,
        url: existingFile.url,
        size: existingFile.size,
        filename: existingFile.filename,
        fromCache: true,
        message: "File sudah pernah diupload"
      });
    }
    
    // Upload file baru
    console.log("Uploading file ke GitHub storage...");
    const uploadResult = await uploadToStorage(token, file.buffer, file.originalname);
    const url = `https://www.gobox.my.id/${uploadResult.filename}`;
    const sizeFormatted = formatSize(uploadResult.size);
    
    // Simpan ke database
    const fileData = {
      filename: uploadResult.filename,
      url: url,
      size: sizeFormatted,
      originalName: file.originalname,
      hash: fileHash
    };
    
    console.log("Menyimpan ke database...");
    await saveFileHash(token, fileHash, fileData);
    
    res.json({
      success: true,
      url: url,
      size: sizeFormatted,
      filename: uploadResult.filename,
      fromCache: false,
      message: "File berhasil diupload"
    });
    
  } catch (err) {
    console.error("Error detail:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server running" 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
