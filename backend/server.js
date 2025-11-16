const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { port, libraryRoot } = require('./config');
const { scanLibrary, getAlbums, getAlbumById, getTrackById } = require('./libraryScanner');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac']);
const COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

scanLibrary();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  return value
    .normalize('NFKD')
    .replace(/[^\w\-\s\.]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function ensureAlbumFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function ensureUniqueFilePath(targetDir, baseName) {
  const ext = path.extname(baseName);
  const nameWithoutExt = path.basename(baseName, ext);
  let candidate = `${nameWithoutExt}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(targetDir, candidate))) {
    candidate = `${nameWithoutExt}-${counter}${ext}`;
    counter += 1;
  }
  return path.join(targetDir, candidate);
}

function writeUploadedFile(targetDir, file, allowedExtensions) {
  if (!file || !file.originalname || !file.buffer) {
    throw new Error('Invalid file upload');
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  ensureAlbumFolder(targetDir);
  const sanitizedName = sanitizeName(path.basename(file.originalname, ext)) || 'file';
  const fullPath = ensureUniqueFilePath(targetDir, `${sanitizedName}${ext}`);
  fs.writeFileSync(fullPath, file.buffer);
  return fullPath;
}

function writeCoverFile(albumPath, file) {
  if (!file || !file.originalname || !file.buffer) {
    throw new Error('Invalid cover upload');
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!COVER_EXTENSIONS.has(ext)) {
    throw new Error('Unsupported cover file type');
  }
  ensureAlbumFolder(albumPath);
  const targetPath = path.join(albumPath, `cover${ext === '.jpeg' ? '.jpg' : ext}`);
  fs.writeFileSync(targetPath, file.buffer);
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

app.get('/api/albums', (req, res) => {
  const albums = getAlbums().map((album) => formatAlbum(album, false));
  res.json({ albums });
});

app.get('/api/albums/:id', (req, res) => {
  const album = getAlbumById(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }
  return res.json({ album: formatAlbum(album, true) });
});

app.get('/api/tracks/:trackId/stream', (req, res) => {
  const track = getTrackById(req.params.trackId);
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

app.post(
  '/api/albums',
  upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'tracks', maxCount: 50 },
  ]),
  (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Album name is required' });
    }

    const folderName = sanitizeName(name);
    if (!folderName) {
      return res.status(400).json({ error: 'Album name is invalid' });
    }

    const albumPath = path.join(libraryRoot, folderName);
    if (fs.existsSync(albumPath)) {
      return res.status(409).json({ error: 'Album already exists' });
    }

    try {
      ensureAlbumFolder(albumPath);
      const coverFile = req.files && req.files.cover ? req.files.cover[0] : null;
      if (coverFile) {
        writeCoverFile(albumPath, coverFile);
      }

      const trackFiles = (req.files && req.files.tracks) || [];
      if (trackFiles.length === 0) {
        return res.status(400).json({ error: 'At least one track is required' });
      }

      trackFiles.forEach((file) => writeUploadedFile(albumPath, file, AUDIO_EXTENSIONS));
      writeMetadata(albumPath, name.trim(), description ? description.trim() : undefined);

      scanLibrary();
      const album = getAlbumById(folderName);
      return res.status(201).json({ album: formatAlbum(album, true) });
    } catch (error) {
      console.error('Failed to create album:', error);
      return handleUploadError(res, error);
    }
  },
);

app.post('/api/albums/:id/tracks', upload.array('tracks', 50), (req, res) => {
  const album = getAlbumById(req.params.id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const trackFiles = req.files || [];
  if (trackFiles.length === 0) {
    return res.status(400).json({ error: 'No tracks uploaded' });
  }

  try {
    trackFiles.forEach((file) => writeUploadedFile(album.folderPath, file, AUDIO_EXTENSIONS));
    scanLibrary();
    const updatedAlbum = getAlbumById(req.params.id);
    return res.json({ album: formatAlbum(updatedAlbum, true) });
  } catch (error) {
    console.error('Failed to add tracks:', error);
    return handleUploadError(res, error);
  }
});

app.post('/api/library/rescan', (req, res) => {
  const albums = scanLibrary();
  res.json({ albums: albums.map((album) => formatAlbum(album, false)) });
});

app.get('/covers/:albumId/:fileName', (req, res) => {
  const album = getAlbumById(req.params.albumId);
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
  app.listen(port, () => {
    console.log(`WebAudioPlayer server listening on port ${port}`);
  });
}

module.exports = app;
