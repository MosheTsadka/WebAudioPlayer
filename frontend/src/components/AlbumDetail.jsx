import { useEffect, useState } from 'react'

const AlbumDetail = ({ albumId, onBack, onPlayTrack }) => {
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!albumId) {
      setAlbum(null)
      return
    }

    let isMounted = true
    const fetchAlbum = async () => {
      setLoading(true)
      setError('')
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
        </div>
      </div>
      <ol className="track-list">
        {album.tracks?.map((track) => (
          <li key={track.id} className="track-item">
            <div>
              <p className="track-title">{track.title}</p>
              <p className="muted">Track {track.order}</p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => onPlayTrack?.(track, album)}
            >
              Play
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default AlbumDetail
