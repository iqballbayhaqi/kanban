const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

// Folder penyimpanan gambar yang diupload user (wallpaper board).
// Tidak masuk git (lihat .gitignore) dan tidak tersentuh `git pull` saat deploy.
const UPLOAD_DIR = path.join(__dirname, '../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const router = express.Router();

// File disajikan publik (nama acak 32 hex, tidak bisa ditebak) karena
// CSS background-image tidak bisa mengirim header Authorization.
router.use('/', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, index: false }));

// Upload: body mentah berupa gambar, Content-Type = tipe gambarnya.
// Frontend sudah mengecilkan gambar sebelum dikirim (nginx default membatasi body 1MB).
router.post(
  '/',
  authenticateToken,
  express.raw({ type: Object.keys(EXT), limit: '5mb' }),
  (req, res) => {
    const ext = EXT[req.headers['content-type']];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WebP or GIF images are allowed' });
    }
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
    res.status(201).json({ url: `/api/uploads/${name}` });
  }
);

module.exports = router;
