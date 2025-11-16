import { useEffect, useRef, useState } from 'react'

const PlayerBar = ({ currentTrack }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!currentTrack) {
      audio.pause()
      setIsPlaying(false)
      audio.removeAttribute('src')
      return
    }

    audio.src = currentTrack.streamUrl
    const play = async () => {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch (err) {
        console.warn('Unable to autoplay track', err)
        setIsPlaying(false)
      }
    }
    play()
  }, [currentTrack])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || !currentTrack) {
      return
    }

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch (err) {
        console.warn('Unable to play track', err)
      }
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
  }

  return (
    <div className="player-bar">
      {currentTrack ? (
        <>
          <div className="player-meta">
            {currentTrack.coverUrl ? (
              <img src={currentTrack.coverUrl} alt="Album cover" className="player-cover" />
            ) : (
              <div className="player-cover placeholder">♪</div>
            )}
            <div>
              <p className="player-title">{currentTrack.title}</p>
              {currentTrack.albumTitle ? (
                <p className="muted">{currentTrack.albumTitle}</p>
              ) : null}
            </div>
          </div>
          <div className="player-controls">
            <button type="button" className="primary" onClick={togglePlayback}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
          <audio ref={audioRef} onEnded={handleEnded} preload="metadata" />
        </>
      ) : (
        <p>Select a track to start listening.</p>
      )}
    </div>
  )
}

export default PlayerBar
