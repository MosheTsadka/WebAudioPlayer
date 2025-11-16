import { useCallback, useEffect, useMemo, useState } from 'react'
import AlbumList from './components/AlbumList.jsx'
import AlbumDetail from './components/AlbumDetail.jsx'
import PlayerBar from './components/PlayerBar.jsx'
import UploadPage from './pages/UploadPage.jsx'
import './App.css'

const parseHash = () => {
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
  const [route, setRoute] = useState(() => parseHash())
  const [currentTrack, setCurrentTrack] = useState(null)

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
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
    setCurrentTrack({
      id: track.id,
      title: track.title,
      albumTitle: album?.title,
      coverUrl: album?.coverUrl,
      streamUrl: `/api/tracks/${track.id}/stream`,
    })
  }, [])

  const navigation = useMemo(
    () => [
      { id: 'albums', label: 'Albums', hash: '/' },
      { id: 'upload', label: 'Upload', hash: '/upload' },
    ],
    [],
  )

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
          <AlbumList onSelectAlbum={handleSelectAlbum} />
        ) : null}

        {route.view === 'albumDetail' ? (
          <AlbumDetail albumId={route.albumId} onBack={() => navigate('/')} onPlayTrack={handlePlayTrack} />
        ) : null}

        {route.view === 'upload' ? <UploadPage /> : null}
      </main>

      <PlayerBar currentTrack={currentTrack} />
    </div>
  )
}

export default App
