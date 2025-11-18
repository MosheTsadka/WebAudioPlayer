import { useCallback, useEffect, useRef, useState } from 'react'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const mins = Math.floor(wholeSeconds / 60)
  const secs = wholeSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const PlayerBar = ({ currentTrack, resumeState }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    if (resumeState && typeof resumeState.volume === 'number') {
      return Math.min(1, Math.max(0, resumeState.volume))
    }
    return 1
  })
  const [pendingResume, setPendingResume] = useState(resumeState)

  const persistPlaybackState = useCallback(
    (state) => {
      try {
        if (!state || !state.track) {
          window.localStorage.removeItem('webaudio:last-playback')
          return
        }
        window.localStorage.setItem('webaudio:last-playback', JSON.stringify(state))
      } catch (err) {
        console.warn('Failed to persist playback state', err)
      }
    },
    [],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime || 0)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
      setProgress(audio.currentTime || 0)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [])

  useEffect(() => {
    if (resumeState) {
      setPendingResume(resumeState)
      if (typeof resumeState.volume === 'number') {
        setVolume(Math.min(1, Math.max(0, resumeState.volume)))
      }
    }
  }, [resumeState])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!currentTrack) {
      audio.pause()
      setIsPlaying(false)
      setProgress(0)
      setDuration(0)
      audio.removeAttribute('src')
      return
    }

    setProgress(0)
    setDuration(0)
    audio.pause()
    audio.currentTime = 0
    audio.src = currentTrack.streamUrl
    audio.load()
    audio.volume = volume

    const resumeInfo =
      pendingResume && pendingResume.trackId && pendingResume.trackId === currentTrack.id
        ? pendingResume
        : null

    const play = async () => {
      try {
        if (resumeInfo && Number.isFinite(resumeInfo.position)) {
          audio.currentTime = Math.max(0, resumeInfo.position)
        }
        if (!resumeInfo || resumeInfo.isPlaying) {
          await audio.play()
          setIsPlaying(true)
        } else {
          setIsPlaying(false)
        }
      } catch (err) {
        console.warn('Unable to autoplay track', err)
      }
    }

    play()
    setPendingResume(null)
  }, [currentTrack, pendingResume, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  useEffect(() => {
    if (!currentTrack) {
      persistPlaybackState(null)
      return
    }

    persistPlaybackState({
      track: currentTrack,
      position: progress,
      duration,
      volume,
      isPlaying,
    })
  }, [currentTrack, duration, isPlaying, persistPlaybackState, progress, volume])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return undefined
    }

    const audio = audioRef.current
    if (!audio) return undefined

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.albumTitle || 'WebAudioPlayer',
        album: currentTrack.albumTitle || undefined,
        artwork: currentTrack.coverUrl
          ? [
              {
                src: currentTrack.coverUrl,
                sizes: '512x512',
                type: 'image/png',
              },
            ]
          : [],
      })

      navigator.mediaSession.setActionHandler('play', async () => {
        try {
          await audio.play()
        } catch (err) {
          console.warn('Media session play failed', err)
        }
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause()
      })
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && Number.isFinite(details.seekTime)) {
          const next = Math.min(duration || audio.duration || 0, Math.max(0, details.seekTime))
          audio.currentTime = next
          setProgress(next)
        }
      })
    } catch (err) {
      console.warn('Unable to configure media session', err)
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekto', null)
      } catch (err) {
        console.warn('Unable to clear media session handlers', err)
      }
    }
  }, [currentTrack, duration])

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

  const handleSeek = (event) => {
    const audio = audioRef.current
    if (!audio || !currentTrack || !duration) return

    const nextTime = Number(event.target.value)
    if (!Number.isNaN(nextTime)) {
      audio.currentTime = nextTime
      setProgress(nextTime)
    }
  }

  const handleProgressBarClick = (event) => {
    const audio = audioRef.current
    if (!audio || !currentTrack || !duration) return

    const track = event.currentTarget
    const rect = track.getBoundingClientRect()
    const fraction = (event.clientX - rect.left) / rect.width
    const nextTime = Math.min(Math.max(0, fraction * duration), duration)
    audio.currentTime = nextTime
    setProgress(nextTime)
  }

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value)
    if (!Number.isNaN(nextVolume)) {
      setVolume(Math.min(1, Math.max(0, nextVolume)))
    }
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
            <div className="player-text">
              <p className="player-title">{currentTrack.title}</p>
              {currentTrack.albumTitle ? (
                <p className="muted">{currentTrack.albumTitle}</p>
              ) : null}
            </div>
          </div>

          <div className="player-center">
            <div className="player-controls">
              <button type="button" className="ghost" aria-label="Play or pause" onClick={togglePlayback}>
                {isPlaying ? '❚❚' : '►'}
              </button>
            </div>
            <div className="player-progress" onClick={handleProgressBarClick} role="presentation">
              <span className="time-label">{formatTime(progress)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(progress, duration || 0)}
                onChange={handleSeek}
                onInput={handleSeek}
              />
              <span className="time-label">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-audio-controls">
            <span className="muted">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
            />
          </div>
          <audio ref={audioRef} preload="metadata" />
        </>
      ) : (
        <p>Select a track to start listening.</p>
      )}
    </div>
  )
}

export default PlayerBar
