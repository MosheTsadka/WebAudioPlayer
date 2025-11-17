# WebAudioPlayer

WebAudioPlayer is a simple home-server audio library that lets you browse albums, stream tracks, and manage uploads from a browser on the same network. The backend is built with Node.js and Express for scanning and streaming the on-disk library, and the frontend is a React + Vite app for the album list, details, uploads, and player experience.

## Prerequisites
- Node.js 18+ (LTS recommended)
- npm (comes with Node.js)

## Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

## Configuration
The backend reads configuration from environment variables:
- `LIBRARY_ROOT`: absolute path to the folder where albums live. Each subfolder is treated as an album.
- `PORT`: port for the Express server (defaults to 3000 if unset).

You can set them inline when starting the server, or create an `.env` file inside `backend/`:
```bash
# backend/.env
LIBRARY_ROOT=/path/to/your/music
PORT=3000
```

## Running
From the `backend` directory:
```bash
npm start
```

From the `frontend` directory:
```bash
npm run dev
```

## Specification
The full feature and API specification is documented in `SPEC_WebAudioPlayer.md` at the project root.
