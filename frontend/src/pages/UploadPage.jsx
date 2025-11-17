import { useEffect, useState } from 'react'

const UploadPage = () => {
  const [albums, setAlbums] = useState([])
  const [loadingAlbums, setLoadingAlbums] = useState(false)
  const [newAlbum, setNewAlbum] = useState({ name: '', description: '' })
  const [coverFile, setCoverFile] = useState(null)
  const [newTracks, setNewTracks] = useState([])
  const [appendTracks, setAppendTracks] = useState([])
  const [targetAlbum, setTargetAlbum] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('idle')

  const refreshAlbums = async () => {
    setLoadingAlbums(true)
    try {
      const response = await fetch('/api/albums')
      if (!response.ok) {
        throw new Error('Failed to load albums')
      }
      const data = await response.json()
      setAlbums(data.albums || data)
    } catch (err) {
      console.error('Unable to load albums', err)
    } finally {
      setLoadingAlbums(false)
    }
  }

  useEffect(() => {
    refreshAlbums()
  }, [])

  const handleNewAlbumSubmit = async (event) => {
    event.preventDefault()
    if (!newAlbum.name.trim() || newTracks.length === 0) {
      setStatusType('error')
      setStatusMessage('Album name and at least one track are required.')
      return
    }

    const formData = new FormData()
    formData.append('name', newAlbum.name.trim())
    if (newAlbum.description.trim()) {
      formData.append('description', newAlbum.description.trim())
    }
    if (coverFile) {
      formData.append('cover', coverFile)
    }
    Array.from(newTracks).forEach((track) => {
      formData.append('tracks', track)
    })

    try {
      const response = await fetch('/api/albums', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Failed to create album')
      }
      setStatusType('success')
      setStatusMessage('Album uploaded successfully.')
      setNewAlbum({ name: '', description: '' })
      setCoverFile(null)
      setNewTracks([])
      refreshAlbums()
    } catch (err) {
      setStatusType('error')
      setStatusMessage(err.message || 'Upload failed')
    }
  }

  const handleAppendTracks = async (event) => {
    event.preventDefault()
    if (!targetAlbum || appendTracks.length === 0) {
      setStatusType('error')
      setStatusMessage('Choose an album and add at least one track to upload.')
      return
    }

    const formData = new FormData()
    Array.from(appendTracks).forEach((track) => formData.append('tracks', track))

    try {
      const response = await fetch(`/api/albums/${targetAlbum}/tracks`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Failed to add tracks')
      }
      setStatusType('success')
      setStatusMessage('Tracks added successfully.')
      setAppendTracks([])
      refreshAlbums()
    } catch (err) {
      setStatusType('error')
      setStatusMessage(err.message || 'Unable to add tracks')
    }
  }

  return (
    <section className="upload-page">
      <h2>Upload Audio</h2>
      <p className="muted">
        Use this page to create a brand new album or append tracks to an existing folder.
      </p>

      {statusMessage ? (
        <div className={`status-banner ${statusType}`}>
          {statusMessage}
        </div>
      ) : null}

      <div className="form-grid">
        <form className="form-card" onSubmit={handleNewAlbumSubmit}>
          <h3>Create Album</h3>
          <label>
            Album name
            <input
              type="text"
              value={newAlbum.name}
              onChange={(event) => setNewAlbum((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={newAlbum.description}
              onChange={(event) =>
                setNewAlbum((prev) => ({ ...prev, description: event.target.value }))
              }
              rows="3"
              placeholder="Optional"
            />
          </label>
          <label>
            Cover image
            <input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files[0])} />
          </label>
          <label>
            Tracks
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => setNewTracks(event.target.files)}
              required
            />
          </label>
          <button type="submit" className="primary">
            Upload album
          </button>
        </form>

        <form className="form-card" onSubmit={handleAppendTracks}>
          <h3>Add Tracks to Album</h3>
          <label>
            Choose album
            <select
              value={targetAlbum}
              onChange={(event) => setTargetAlbum(event.target.value)}
              disabled={loadingAlbums || albums.length === 0}
            >
              <option value="">Select an album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tracks
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => setAppendTracks(event.target.files)}
            />
          </label>
          <button type="submit" className="secondary">
            Upload tracks
          </button>
        </form>
      </div>
    </section>
  )
}

export default UploadPage
