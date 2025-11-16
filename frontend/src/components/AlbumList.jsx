import { useEffect, useState } from 'react'

const AlbumList = ({ onSelectAlbum }) => {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchAlbums = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/albums')
        if (!response.ok) {
          throw new Error('Failed to load albums')
        }
        const data = await response.json()
        if (isMounted) {
          setAlbums(data.albums || data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load albums')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAlbums()
    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return <div className="album-list">Loading albums…</div>
  }

  if (error) {
    return (
      <div className="album-list error">
        <p>Something went wrong while loading albums.</p>
        <p className="muted">{error}</p>
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="album-list empty">
        <p>No albums found. Use the Upload page to add your first album.</p>
      </div>
    )
  }

  return (
    <section className="album-list">
      <h2>Albums</h2>
      <div className="album-grid">
        {albums.map((album) => (
          <button
            type="button"
            key={album.id}
            className="album-card"
            onClick={() => onSelectAlbum?.(album.id)}
          >
            <div className="album-card-cover">
              {album.coverUrl ? (
                <img src={album.coverUrl} alt={`${album.title} cover`} loading="lazy" />
              ) : (
                <div className="album-cover-placeholder">No cover</div>
              )}
            </div>
            <div className="album-card-body">
              <h3>{album.title}</h3>
              <p>{album.trackCount} track{album.trackCount === 1 ? '' : 's'}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default AlbumList
