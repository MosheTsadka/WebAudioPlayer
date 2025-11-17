import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../apiClient'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const mins = Math.floor(wholeSeconds / 60)
  const secs = wholeSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const AlbumDetail = ({ albumId, onBack, onPlayTrack, onAlbumDeleted, onTrackDeleted }) => {
  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [durationMap, setDurationMap] = useState({})

  useEffect(() => {
    if (!albumId) {
      setAlbum(null)
      setDurationMap({})
      return
    }

    let isMounted = true
    const fetchAlbum = async () => {
      setLoading(true)
      setError('')
      setActionError('')
      try {
        const response = await fetch(apiUrl(`/api/albums/${albumId}`))
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
          setDurationMap(() => {
            const next = {}
            tracks.forEach((track) => {
              if (Number.isFinite(track.duration)) {
                next[track.id] = track.duration
              }
            })
            return next
          })
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
      const response = await fetch(apiUrl(`/api/albums/${encodeURIComponent(album.id)}`), {
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

  useEffect(() => {
    if (!album?.tracks?.length) return undefined

    let cancelled = false
    const cleanupFns = []

    album.tracks.forEach((track) => {
      if (Number.isFinite(durationMap[track.id])) {
        return
      }

      const audio = new Audio()
      audio.preload = 'metadata'
      audio.src = apiUrl(`/api/tracks/${track.id}/stream`)

      const handleLoaded = () => {
        if (cancelled) return
        if (Number.isFinite(audio.duration)) {
          setDurationMap((prev) => ({ ...prev, [track.id]: audio.duration }))
        }
      }

      audio.addEventListener('loadedmetadata', handleLoaded)
      cleanupFns.push(() => {
        audio.removeEventListener('loadedmetadata', handleLoaded)
        audio.pause()
        audio.src = ''
      })
    })

    return () => {
      cancelled = true
      cleanupFns.forEach((fn) => fn())
    }
  }, [album?.tracks, durationMap])

  const getDurationLabel = useMemo(
    () => (trackId, fallback) => formatTime(durationMap[trackId] ?? fallback),
    [durationMap],
  )

  const handleDeleteTrack = async (track) => {
    if (!track) return
    const confirm = window.confirm('Delete this track?')
    if (!confirm) return
    setActionError('')

    try {
      const response = await fetch(
        apiUrl(`/api/albums/${encodeURIComponent(albumId)}/tracks/${encodeURIComponent(track.id)}`),
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
          <li
            key={track.id}
            className="track-item playable"
            role="button"
            tabIndex={0}
            onClick={() => onPlayTrack?.(track, album)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onPlayTrack?.(track, album)
              }
            }}
          >
            <div>
              <p className="track-title">{track.title}</p>
              <p className="muted">Track {track.order}</p>
            </div>
            <div className="track-actions">
              <span className="muted duration">{getDurationLabel(track.id, track.duration)}</span>
              <button
                type="button"
                className="primary"
                onClick={(event) => {
                  event.stopPropagation()
                  onPlayTrack?.(track, album)
                }}
              >
                Play
              </button>
              <button
                type="button"
                className="danger link-button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleDeleteTrack(track)
                }}
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
