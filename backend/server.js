const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { port, libraryRoot } = require('./config');
const { scanLibrary, getAlbums, getAlbumById, getTrackById } = require('./libraryScanner');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac']);
const COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

let scanReady = scanLibrary();

const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const albumId = req.params.id || sanitizeName(req.body && req.body.name);
    if (!albumId) {
      return cb(new Error('Album name is required'));
    }

    const targetDir = path.join(libraryRoot, albumId);

    if (req.params.id && !fs.existsSync(targetDir)) {
      return cb(new Error('Album not found'));
    }

    ensureAlbumFolder(targetDir);
    req.albumUploadPath = targetDir;
    return cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const normalizedExt = file.fieldname === 'cover' && ext === '.jpeg' ? '.jpg' : ext;
    const baseName =
      file.fieldname === 'cover'
        ? 'cover'
        : sanitizeName(path.basename(file.originalname, ext)) || 'file';
    const targetDir = req.albumUploadPath ||
      path.join(libraryRoot, req.params.id || sanitizeName(req.body && req.body.name) || 'uploads');
    let candidate = `${baseName}${normalizedExt}`;
    if (fs.existsSync(path.join(targetDir, candidate))) {
      const timestamp = Date.now();
      candidate = `${baseName}-${timestamp}${normalizedExt}`;
      let counter = 1;
      while (fs.existsSync(path.join(targetDir, candidate))) {
        candidate = `${baseName}-${timestamp}-${counter}${normalizedExt}`;
        counter += 1;
      }
    }
    cb(null, candidate);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'cover') {
      if (!COVER_EXTENSIONS.has(ext)) {
        return cb(new Error('Unsupported cover file type'));
      }
      return cb(null, true);
    }

    if (!AUDIO_EXTENSIONS.has(ext)) {
      return cb(new Error(`Unsupported file type: ${ext}`));
    }
    return cb(null, true);
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

function buildCoverUrl(album) {
  if (!album.coverFileName) {
    return null;
  }
  return `/covers/${encodeURIComponent(album.id)}/${encodeURIComponent(album.coverFileName)}`;
}

function formatAlbum(album, withTracks = false) {
  const base = {
    id: album.id,
    title: album.title,
    description: album.description,
    coverUrl: buildCoverUrl(album),
    trackCount: album.trackCount,
  };

  if (!withTracks) {
    return base;
  }

  return {
    ...base,
    tracks: album.tracks.map((track) => ({
      id: track.id,
      albumId: track.albumId,
      title: track.title,
      order: track.order,
      duration: track.duration,
    })),
  };
}

function sanitizeName(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const normalized = value.normalize('NFKC').trim();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_');
}

function ensureAlbumFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function cleanupUploadedFiles(files) {
  if (!files) return;
  const list = Array.isArray(files) ? files : Object.values(files).flat();
  list.forEach((file) => {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.warn('Failed to cleanup uploaded file:', err);
      }
    }
  });
}

function normalizeCoverFile(albumPath, file) {
  if (!file || !file.originalname || !file.path) {
    throw new Error('Invalid cover upload');
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!COVER_EXTENSIONS.has(ext)) {
    throw new Error('Unsupported cover file type');
  }

  ensureAlbumFolder(albumPath);
  const targetPath = path.join(albumPath, `cover${ext === '.jpeg' ? '.jpg' : ext}`);
  if (file.path !== targetPath) {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(file.path, targetPath);
  }
  return targetPath;
}

function writeMetadata(albumPath, title, description) {
  const metadataPath = path.join(albumPath, 'album.json');
  const metadata = {};
  if (title) {
    metadata.title = title;
  }
  if (description) {
    metadata.description = description;
  }
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

function fileToMime(ext) {
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}

function handleUploadError(res, error) {
  if (/unsupported/i.test(error.message) || /invalid/i.test(error.message)) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: 'Upload failed' });
}

app.get('/api/albums', async (req, res) => {
  await scanReady;
  const albums = (await getAlbums()).map((album) => formatAlbum(album, false));
  res.json({ albums });
});

app.get('/api/albums/:id', async (req, res) => {
  await scanReady;
  const album = await getAlbumById(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }
  return res.json({ album: formatAlbum(album, true) });
});

app.get('/api/tracks/:trackId/stream', async (req, res) => {
  await scanReady;
  const track = await getTrackById(req.params.trackId);
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  fs.stat(track.filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).json({ error: 'Track file missing' });
    }

    const ext = path.extname(track.filePath).toLowerCase();
    const mimeType = fileToMime(ext);
    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': mimeType,
      });
      fs.createReadStream(track.filePath).pipe(res);
      return;
    }

    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    let start = Number(startStr);
    let end = endStr ? Number(endStr) : stats.size - 1;

    if (Number.isNaN(start)) {
      start = 0;
    }
    if (Number.isNaN(end) || end >= stats.size) {
      end = stats.size - 1;
    }
    if (start > end) {
      start = 0;
    }

    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
    });

    fs.createReadStream(track.filePath, { start, end }).pipe(res);
  });
});

app.delete('/api/albums/:id', async (req, res) => {
  await scanReady;
  const album = await getAlbumById(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  try {
    await fsp.rm(album.folderPath, { recursive: true, force: true });
    scanReady = scanLibrary();
    await scanReady;
    return res.json({ message: 'Album deleted' });
  } catch (error) {
    console.error('Failed to delete album:', error);
    return res.status(500).json({ error: 'Failed to delete album' });
  }
});

app.post(
  '/api/albums',
  upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'tracks', maxCount: 50 },
  ]),
  async (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'Album name is required' });
    }

    const folderName = sanitizeName(name);
    if (!folderName) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'Album name is invalid' });
    }

    const albumPath = path.join(libraryRoot, folderName);
    if (fs.existsSync(albumPath)) {
      cleanupUploadedFiles(req.files);
      return res.status(409).json({ error: 'Album already exists' });
    }

    try {
      ensureAlbumFolder(albumPath);
      const coverFile = req.files && req.files.cover ? req.files.cover[0] : null;
      if (coverFile) {
        normalizeCoverFile(albumPath, coverFile);
      }

      const trackFiles = (req.files && req.files.tracks) || [];
      if (trackFiles.length === 0) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ error: 'At least one track is required' });
      }

      writeMetadata(albumPath, name.trim(), description ? description.trim() : undefined);

      scanReady = scanLibrary();
      await scanReady;
      const album = await getAlbumById(folderName);
      return res.status(201).json({ album: formatAlbum(album, true) });
    } catch (error) {
      console.error('Failed to create album:', error);
      cleanupUploadedFiles(req.files);
      return handleUploadError(res, error);
    }
  },
);

app.post('/api/albums/:id/tracks', upload.array('tracks', 50), async (req, res) => {
  await scanReady;
  const album = await getAlbumById(req.params.id);
  if (!album) {
    cleanupUploadedFiles(req.files);
    return res.status(404).json({ error: 'Album not found' });
  }

  const trackFiles = req.files || [];
  if (trackFiles.length === 0) {
    cleanupUploadedFiles(req.files);
    return res.status(400).json({ error: 'No tracks uploaded' });
  }

  try {
    scanReady = scanLibrary();
    await scanReady;
    const updatedAlbum = await getAlbumById(req.params.id);
  return res.json({ album: formatAlbum(updatedAlbum, true) });
  } catch (error) {
    console.error('Failed to add tracks:', error);
    cleanupUploadedFiles(req.files);
    return handleUploadError(res, error);
  }
});

app.delete('/api/albums/:albumId/tracks/:trackId', async (req, res) => {
  await scanReady;
  const { albumId, trackId } = req.params;
  const track = await getTrackById(trackId);
  if (!track || track.albumId !== albumId) {
    return res.status(404).json({ error: 'Track not found' });
  }

  try {
    await fsp.unlink(track.filePath).catch((err) => {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    });
    scanReady = scanLibrary();
    await scanReady;
    const updatedAlbum = await getAlbumById(albumId);
    if (!updatedAlbum) {
      return res.json({ message: 'Track deleted, album removed' });
    }
    return res.json({ album: formatAlbum(updatedAlbum, true) });
  } catch (error) {
    console.error('Failed to delete track:', error);
    return res.status(500).json({ error: 'Failed to delete track' });
  }
});

app.post('/api/library/rescan', async (req, res) => {
  scanReady = scanLibrary();
  const albums = await scanReady;
  res.json({ albums: albums.map((album) => formatAlbum(album, false)) });
});

app.use((err, req, res, next) => {
  if (err) {
    console.error('Upload error:', err.message);
    return handleUploadError(res, err);
  }
  return next();
});

app.get('/covers/:albumId/:fileName', async (req, res) => {
  await scanReady;
  const album = await getAlbumById(req.params.albumId);
  if (!album || album.coverFileName !== req.params.fileName) {
    return res.status(404).end();
  }

  res.sendFile(album.coverImagePath);
});

const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

if (require.main === module) {
  (async () => {
    await scanReady;
    app.listen(port, () => {
      console.log(`WebAudioPlayer server listening on port ${port}`);
    });
  })();
}

module.exports = app;
