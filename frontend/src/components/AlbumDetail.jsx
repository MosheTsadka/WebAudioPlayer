import { useEffect, useState } from 'react'

const AlbumDetail = ({ albumId, onBack, onPlayTrack, onAlbumDeleted, onTrackDeleted }) => {
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!albumId) {
      setAlbum(null)
      return
    }

    let isMounted = true
    const fetchAlbum = async () => {
      setLoading(true)
      setError('')
      setActionError('')
      try {
        const response = await fetch(`/api/albums/${albumId}`)
        if (!response.ok) {
          throw new Error('Unable to load album details')
        }
        const data = await response.json()
        if (isMounted) {
          const albumData = data.album || data
          const tracks = [...(albumData.tracks || [])].sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0),
          )
          setAlbum({ ...albumData, tracks })
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load album details')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAlbum()
    return () => {
      isMounted = false
    }
  }, [albumId])

  const handleDeleteAlbum = async () => {
    if (!album) return
    const confirm = window.confirm('Delete this album and all its tracks?')
    if (!confirm) return

    try {
      const response = await fetch(`/api/albums/${encodeURIComponent(album.id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to delete album')
      }
      setAlbum(null)
      onAlbumDeleted?.(album.id)
      onBack?.()
    } catch (err) {
      setActionError(err.message || 'Unable to delete album')
    }
  }

  const handleDeleteTrack = async (track) => {
    if (!track) return
    const confirm = window.confirm('Delete this track?')
    if (!confirm) return
    setActionError('')

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumId)}/tracks/${encodeURIComponent(track.id)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to delete track')
      }
      const payload = await response.json().catch(() => ({}))
      if (payload.album) {
        const tracks = [...(payload.album.tracks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        setAlbum({ ...payload.album, tracks })
      } else {
        setAlbum(null)
      }
      onTrackDeleted?.(albumId, track.id)
    } catch (err) {
      setActionError(err.message || 'Unable to delete track')
    }
  }

  if (!albumId) {
    return (
      <section className="album-detail placeholder">
        <p>Select an album to see its tracks.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="album-detail">
        <p>Loading album…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="album-detail error">
        <p>Could not load the album.</p>
        <p className="muted">{error}</p>
      </section>
    )
  }

  if (!album) {
    return (
      <section className="album-detail empty">
        <p>Album not found.</p>
        {onBack ? (
          <button type="button" className="link-button" onClick={onBack}>
            Back to albums
          </button>
        ) : null}
      </section>
    )
  }

  return (
    <section className="album-detail">
      <div className="album-detail-header">
        {onBack ? (
          <button type="button" className="link-button" onClick={onBack}>
            ← Back
          </button>
        ) : null}
        <div className="album-cover-large">
          {album.coverUrl ? (
            <img src={album.coverUrl} alt={`${album.title} cover`} />
          ) : (
            <div className="album-cover-placeholder">No cover</div>
          )}
        </div>
        <div>
          <h2>{album.title}</h2>
          {album.description ? <p className="muted">{album.description}</p> : null}
          <p className="muted">{album.trackCount} track{album.trackCount === 1 ? '' : 's'}</p>
          <div className="album-actions">
            <button type="button" className="danger" onClick={handleDeleteAlbum}>
              Delete album
            </button>
          </div>
          {actionError ? <p className="error-text">{actionError}</p> : null}
        </div>
      </div>
      <ol className="track-list">
        {album.tracks?.map((track) => (
          <li key={track.id} className="track-item">
            <div>
              <p className="track-title">{track.title}</p>
              <p className="muted">Track {track.order}</p>
            </div>
            <div className="track-actions">
              <button
                type="button"
                className="primary"
                onClick={() => onPlayTrack?.(track, album)}
              >
                Play
              </button>
              <button
                type="button"
                className="danger link-button"
                onClick={() => handleDeleteTrack(track)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default AlbumDetail
