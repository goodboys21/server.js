const axios = require("axios");

// ==================================================
// HANDLER /file/[filename]
// ==================================================
module.exports = async (req, res) => {
  try {
    // Ambil parameter filename dari URL path
    let filename = req.query.filename;
    
    // Jika tidak ada di query, coba dari path parameter
    if (!filename && req.url) {
      const match = req.url.match(/^\/file\/(.+)$/);
      if (match) {
        filename = decodeURIComponent(match[1]);
      }
    }
    
    // Validasi parameter filename wajib diisi
    if (!filename || filename.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Filename wajib diisi di URL",
        example: "/file/qFQNo.jpg"
      });
    }

    console.log("Fetching file:", filename);

    // URL RAW GitHub
    const githubUrl = `https://raw.githubusercontent.com/bagus-api/storage/master/${filename}`;
    
    // Fetch file dari GitHub
    const response = await axios.get(githubUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        "Accept": "image/*, application/*"
      }
    });

    // Tentukan content type berdasarkan ekstensi file
    let contentType = response.headers["content-type"] || "application/octet-stream";
    
    // Fallback content type berdasarkan ekstensi
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg'
    };
    
    if (mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }
    
    // Set header response
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache 1 hari
    
    // Kirim file langsung
    return res.send(Buffer.from(response.data));

  } catch (err) {
    console.error("File Fetch Error:", err.message);
    
    if (err.response && err.response.status === 404) {
      return res.status(404).json({
        success: false,
        message: "File tidak ditemukan di storage"
      });
    }
    
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        message: "Request timeout, server GitHub tidak merespon"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil file",
      error: err.message
    });
  }
};
