You are a senior full-stack developer.
Your task is to design and implement a simple web audio player that runs on a home server PC and is accessed from a
browser on the same network (and later possibly from outside).

The project is called: WebAudioPlayer.

You must:

Plan the architecture briefly.

Then write all the code for backend + frontend.

Explain how to run it.

Use a simple, common stack such as:

Backend: Node.js + Express

Frontend: Any modern framework (React / Vue) OR simple HTML/JS if you prefer, but it must be clean and organized.

1. Project Goal

Build a web app that:

Runs on a server PC and serves:

A web UI (frontend)

A simple API (backend)

Audio files and images from the disk

Allows the user to:

Browse a library of albums

See tracks inside each album

Play audio in the browser with a clear “Now Playing” bar

Easily upload new audio files and cover images

Optionally add tracks to an existing album

Focus on: simple, clear, easy to maintain, and easy to upload content.

2. File Storage Model (On Disk)

Use a folder-based library, not a complex database.

There is a single library root folder, for example:
D:\WebAudioLibrary (the exact path should be configurable, e.g. via env variable or config file).

Inside the library:

Each album is a folder:

Folder name = album name (or a safe version of it)

Example:

D:\WebAudioLibrary\Chill_Beats

D:\WebAudioLibrary\Torah_Shiurim_Rav_X

Inside each album folder:

One optional cover image file

For example: cover.jpg or cover.png

Multiple audio files

For example: .mp3, .wav, .flac

Optional metadata file (e.g. album.json) to store:

Display album title

Description

Custom track order, if needed

Track display names

The backend should:

On startup, scan the library root folder and:

Detect album folders

Detect audio files inside each album

Detect cover image if present

Build an in-memory index of:

Albums

Tracks

Paths for streaming

Provide an API endpoint to rescan the library without restarting the server.

3. Backend Responsibilities

Build a backend that:

Serves the frontend files (the web app).

Provides API endpoints to:

List all albums

Get details for a single album (tracks, cover, etc.)

Stream a track

Upload albums, tracks, and images

Trigger rescan of the library

Handles file operations:

Create album folders

Save uploaded audio and image files

Ensure unique file names

Update metadata if using a metadata file

Use any standard middleware needed (like multer for uploads if you use Node.js).

3.1. Required API Behaviors

Create endpoints (you choose exact routes) with these behaviors:

List all albums

Returns:

Album ID (can be folder name or generated ID)

Album title

Path/URL to cover image (if exists)

Number of tracks

Get album details

Input: album ID

Returns:

Album title

Description (if exists)

Cover image URL

List of tracks, each with:

Track ID

Track display name (from metadata or filename)

Duration (if you can calculate it, otherwise null)

Track number / order

Stream a track

Input: track ID

Behavior: stream the audio file in a way the browser <audio> element can play (support range requests if possible).

Upload a new album

Accepts:

Album name (text)

Optional album description

Optional cover image

One or more audio files

Behavior:

Create a new folder under the library root

Save the audio files inside

Save the cover image with a standard name (e.g., cover.jpg)

Optionally create/update album.json with metadata

Return the new album information

Upload tracks to an existing album

Input:

Target album ID

One or more new audio files

Behavior:

Save new files into the existing album folder

Update track list / metadata

Rescan library

Behavior:

Re-scan the library root folder

Update internal index of albums and tracks

4. Frontend – Pages and UI

Build a simple, clean UI with at least these screens / components:

4.1. Home / Library Page

Shows a grid or list of albums.

Each album card displays:

Cover image (or placeholder)

Album title

Number of tracks

Clicking an album opens the Album Detail page.

4.2. Album Detail Page

Shows:

Album cover

Album title

(Optional) Album description

Below, a track list:

One row per track

Columns:

Track number

Track title

(Optional) duration

A Play button (or row is clickable)

When a track is playing:

That row is visually highlighted

Optionally show a “playing” icon.

4.3. Global “Now Playing” Bar

A persistent player bar at bottom or top:

Shows:

Current album title

Current track title

Playback position (elapsed / total)

Controls:

Play / Pause

Previous track

Next track

Seek bar

Volume

Behavior:

“Next” goes to next track in the album

“Previous” goes to previous track

Selecting a track in the list updates the “Now Playing” bar and starts playback

The highlight in the track list updates according to the currently playing track

5. Upload Flow – Simple UX

Create an Upload Page with two sections:

Create New Album

Inputs:

Album name (required)

Optional description

Optional cover image (drag & drop)

Drag & drop multiple audio files

On confirm:

Call “upload new album” endpoint

Show upload progress

After success, show a link “Open this album”.

Add Tracks to Existing Album

Step 1: Select album from dropdown/search

Step 2: Drag & drop audio files

Step 3: Confirm upload

After success, show updated list or link to album.

Handle basic errors:

Unsupported file type

Album name already exists

Upload failures

6. State and Interaction Logic

Implement frontend state for:

List of albums

Selected album

Currently playing track (album ID + track ID)

Player state:

IsPlaying

CurrentTime

Duration

Simple playback behavior:

Tracks play in album order

After last track, stop playback by default (no loop).

If user switches albums while something is playing, you can either:

Stop current track and switch, OR

Keep playing but visually indicate current playing album/track

Pick one consistent behavior and implement it.

7. Configuration and Environment

Allow configuration via a simple config file or environment variables:

Library root folder path

Server port

Allowed audio extensions

Max upload size

The system should:

Run on a home PC (server)

Let user open the web app from other devices on the same network using the PC IP and port (
e.g., http://192.168.x.x:3000).

8. Output Format for This Task

Your response must include:

Short architecture overview

Backend stack & structure (folders, main files)

Frontend stack & structure

Backend code

Show file paths and full contents for each main file
(e.g., server.js, routes, config, library scanner, etc.)

Frontend code

Show file paths and full contents for each main file
(e.g., index.html or React components, main app file, player component, etc.)

Instructions to run

How to install dependencies

How to set the library root folder

How to start backend and frontend

How to open it in the browser

Make sure the code is coherent and consistent so it can be copy–pasted into a project and run with minimal fixes.