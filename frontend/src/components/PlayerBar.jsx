import { useEffect, useRef, useState } from 'react'

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const mins = Math.floor(wholeSeconds / 60)
  const secs = wholeSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const PlayerBar = ({ currentTrack }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime || 0)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

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
    audio.volume = volume

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

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

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
            <div className="player-progress">
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
