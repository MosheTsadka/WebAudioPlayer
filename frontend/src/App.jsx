import { useCallback, useEffect, useMemo, useState } from 'react'
import AlbumList from './components/AlbumList.jsx'
import AlbumDetail from './components/AlbumDetail.jsx'
import PlayerBar from './components/PlayerBar.jsx'
import UploadPage from './pages/UploadPage.jsx'
import './App.css'
import { apiUrl } from './apiClient'

const parseRouteFromHash = () => {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash || hash === '/') {
    return { view: 'albums', albumId: null }
  }

  const segments = hash.split('/').filter(Boolean)
  if (segments[0] === 'albums' && segments[1]) {
    return { view: 'albumDetail', albumId: segments[1] }
  }

  if (segments[0] === 'upload') {
    return { view: 'upload', albumId: null }
  }

  return { view: 'albums', albumId: null }
}

function App() {
  const [route, setRoute] = useState(() => parseRouteFromHash())
  const [currentTrack, setCurrentTrack] = useState(null)
  const [resumeState, setResumeState] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseRouteFromHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('webaudio:last-playback')
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved && saved.track && saved.track.id) {
        setCurrentTrack(saved.track)
        setResumeState({
          trackId: saved.track.id,
          position: Number.isFinite(saved.position) ? saved.position : 0,
          isPlaying: Boolean(saved.isPlaying),
          volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : undefined,
        })
      }
    } catch (err) {
      console.warn('Unable to restore playback state', err)
    }
  }, [])

  const navigate = useCallback((hash) => {
    window.location.hash = hash
  }, [])

  const handleSelectAlbum = useCallback(
    (albumId) => {
      if (albumId) {
        navigate(`/albums/${albumId}`)
      }
    },
    [navigate],
  )

  const handlePlayTrack = useCallback((track, album) => {
    if (!track) {
      return
    }
    setResumeState(null)
    setCurrentTrack({
      id: track.id,
      albumId: track.albumId,
      title: track.title,
      albumTitle: album?.title,
      coverUrl: album?.coverUrl,
      streamUrl: apiUrl(`/stream/${track.id}`),
    })
  }, [])

  const navigation = useMemo(
    () => [
      { id: 'albums', label: 'Albums', hash: '/' },
      { id: 'upload', label: 'Upload', hash: '/upload' },
    ],
    [],
  )

  const handleAlbumDeleted = useCallback(
    (albumId) => {
      setRefreshKey((value) => value + 1)
      setCurrentTrack((track) => {
        if (track && track.albumId === albumId) {
          setResumeState(null)
          return null
        }
        return track
      })
      if (route.albumId === albumId) {
        navigate('/')
      }
    },
    [navigate, route.albumId],
  )

  const handleTrackDeleted = useCallback((albumId, trackId) => {
    setRefreshKey((value) => value + 1)
    setCurrentTrack((track) => {
      if (track && track.id === trackId) {
        setResumeState(null)
        return null
      }
      return track
    })
    if (route.albumId === albumId && window.location.hash !== `#/albums/${albumId}`) {
      navigate(`/albums/${albumId}`)
    }
  }, [navigate, route.albumId])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>WebAudioPlayer</h1>
          <p className="muted">Browse, upload, and play your home audio library.</p>
        </div>
        <nav className="app-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={route.view === item.id || (item.id === 'albums' && route.view === 'albumDetail') ? 'active' : ''}
              onClick={() => navigate(item.hash)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-content">
        {route.view === 'albums' ? (
          <AlbumList onSelectAlbum={handleSelectAlbum} onAlbumDeleted={handleAlbumDeleted} refreshKey={refreshKey} />
        ) : null}

        {route.view === 'albumDetail' ? (
          <AlbumDetail
            albumId={route.albumId}
            onBack={() => navigate('/')}
            onPlayTrack={handlePlayTrack}
            onAlbumDeleted={handleAlbumDeleted}
            onTrackDeleted={handleTrackDeleted}
          />
        ) : null}

        {route.view === 'upload' ? <UploadPage /> : null}
      </main>

      <PlayerBar currentTrack={currentTrack} resumeState={resumeState} />
    </div>
  )
}

export default App
