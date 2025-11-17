const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { libraryRoot } = require('./config');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac']);
const COVER_FILE_CANDIDATES = ['cover.jpg', 'cover.png'];

let albumIndex = new Map();
let trackIndex = new Map();

async function ensureLibraryRoot() {
  await fsp.mkdir(libraryRoot, { recursive: true });
}

async function readAlbumMetadata(metadataPath) {
  try {
    const contents = await fsp.readFile(metadataPath, 'utf8');
    const parsed = JSON.parse(contents);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Failed to parse metadata at ${metadataPath}:`, error.message);
    }
    return {};
  }
}

function normalizeFilename(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function findCoverFile(dirEntries) {
  for (const candidate of COVER_FILE_CANDIDATES) {
    const entry = dirEntries.find(
      (dirent) => dirent.isFile() && dirent.name.toLowerCase() === candidate,
    );
    if (entry) {
      return entry.name;
    }
  }
  return null;
}

function getAudioFiles(dirEntries) {
  return dirEntries
    .filter((dirent) => dirent.isFile() && AUDIO_EXTENSIONS.has(path.extname(dirent.name).toLowerCase()))
    .map((dirent) => dirent.name);
}

function buildTrackOrder(audioFiles, metadata) {
  const normalizedAudioMap = new Map(
    audioFiles.map((fileName) => [normalizeFilename(fileName), fileName]),
  );

  const orderedFiles = [];
  const usedFiles = new Set();

  if (Array.isArray(metadata.tracks)) {
    metadata.tracks.forEach((track) => {
      const lookupName = normalizeFilename(
        track.file || track.filename || track.path || track.name,
      );
      if (!lookupName) {
        return;
      }
      const actualName = normalizedAudioMap.get(lookupName);
      if (actualName && !usedFiles.has(actualName)) {
        orderedFiles.push({ fileName: actualName, metadata: track });
        usedFiles.add(actualName);
      }
    });
  }

  audioFiles
    .filter((fileName) => !usedFiles.has(fileName))
    .sort()
    .forEach((fileName) => {
      orderedFiles.push({ fileName, metadata: null });
    });

  return orderedFiles;
}

function buildTracks(albumId, albumPath, orderedFiles) {
  return orderedFiles.map(({ fileName, metadata }, index) => {
    const id = `${albumId}:${fileName}`;
    const filePath = path.join(albumPath, fileName);
    const titleFromMeta =
      (metadata &&
        (metadata.title || metadata.displayName || metadata.name || metadata.label)) ||
      null;

    const duration = metadata && typeof metadata.duration === 'number' ? metadata.duration : null;
    const trackNumber =
      metadata && typeof metadata.order === 'number' ? metadata.order : index + 1;

    return {
      id,
      albumId,
      filename: fileName,
      title: titleFromMeta || path.parse(fileName).name,
      filePath,
      order: trackNumber,
      duration,
    };
  });
}

async function scanLibrary() {
  await ensureLibraryRoot();

  const newAlbumIndex = new Map();
  const newTrackIndex = new Map();

  let dirEntries = [];
  try {
    dirEntries = await fsp.readdir(libraryRoot, { withFileTypes: true });
  } catch (error) {
    console.error('Failed to read library root:', error.message);
    albumIndex = newAlbumIndex;
    trackIndex = newTrackIndex;
    return [];
  }

  for (const dirent of dirEntries.filter((entry) => entry.isDirectory())) {
    const albumId = dirent.name;
    const albumPath = path.join(libraryRoot, albumId);
    let albumEntries = [];
    try {
      albumEntries = await fsp.readdir(albumPath, { withFileTypes: true });
    } catch (error) {
      console.warn(`Unable to read album folder ${albumPath}:`, error.message);
      continue;
    }

    const metadataPath = path.join(albumPath, 'album.json');
    const metadata = await readAlbumMetadata(metadataPath);
    const coverFileName = findCoverFile(albumEntries);
    const audioFiles = getAudioFiles(albumEntries);
    const orderedTrackFiles = buildTrackOrder(audioFiles, metadata);
    const tracks = buildTracks(albumId, albumPath, orderedTrackFiles);

    const albumTitle =
      typeof metadata.title === 'string' && metadata.title.trim().length > 0
        ? metadata.title.trim()
        : albumId;
    const albumDescription =
      typeof metadata.description === 'string' && metadata.description.trim().length > 0
        ? metadata.description.trim()
        : null;

    const album = {
      id: albumId,
      title: albumTitle,
      description: albumDescription,
      folderPath: albumPath,
      coverImagePath: coverFileName ? path.join(albumPath, coverFileName) : null,
      coverFileName,
      tracks,
      trackCount: tracks.length,
    };

    newAlbumIndex.set(album.id, album);
    tracks.forEach((track) => newTrackIndex.set(track.id, track));
  }

  albumIndex = newAlbumIndex;
  trackIndex = newTrackIndex;

  return getAlbums();
}

async function getAlbums() {
  return Array.from(albumIndex.values());
}

async function getAlbumById(id) {
  return albumIndex.get(id) || null;
}

async function getTrackById(trackId) {
  return trackIndex.get(trackId) || null;
}

module.exports = {
  scanLibrary,
  getAlbums,
  getAlbumById,
  getTrackById,
};
