import { useEffect, useRef, useState } from 'react'
import { CircleCheck, RotateCw, TriangleAlert } from 'lucide-react'
import { api } from '../lib/api.js'
import { parseVideoUrl } from '../lib/video.js'
import { createTracker } from '../lib/videoTracker.js'

let ytPromise
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!ytPromise) {
    ytPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT) }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.onerror = () => {
        ytPromise = null
        reject(new Error('Unable to load video player.'))
      }
      document.head.appendChild(s)
    })
  }
  return ytPromise
}

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/**
 * One player for everyone, so what an instructor previews is what students get.
 *   track=true  (students): reports progress to the server and resumes playback.
 *   track=false (instructors): plain preview, plus who has watched it.
 */
export default function LessonVideo({ lessonId, url, track = false, showSummary = false, uploadedVideo = false }) {
  const [uploadedSource, setUploadedSource] = useState('')
  const [uploadedError, setUploadedError] = useState('')
  const parsedUrl = parseVideoUrl(url)
  const parsed = uploadedVideo ? { kind: 'file', src: uploadedSource } : parsedUrl
  const [progress, setProgress] = useState(null)
  const [summaryResult, setSummaryResult] = useState(null)
  const [summaryRetryCount, setSummaryRetryCount] = useState(0)
  const [playerStatus, setPlayerStatus] = useState('loading')
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [progressError, setProgressError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const hostRef = useRef(null)
  const videoRef = useRef(null)

  const trackable = track && (parsed?.kind === 'youtube' || parsed?.kind === 'file') && (!uploadedVideo || !!uploadedSource)
  const summaryKey = `${lessonId}:${url}:${summaryRetryCount}`

  useEffect(() => {
    if (!uploadedVideo || !url) return undefined
    let cancelled = false
    let objectUrl = ''
    const path = url.replace(/^\/api(?=\/)/, '')
    api.getBlob(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) URL.revokeObjectURL(objectUrl)
        else setUploadedSource(objectUrl)
      })
      .catch((error) => {
        if (!cancelled) {
          setUploadedError(error.message || 'Unable to load uploaded video.')
          setPlayerStatus('error')
        }
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [uploadedVideo, url, retryCount])

  useEffect(() => {
    const updateNetworkStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)
    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
    }
  }, [])

  // Instructor view: who has watched this lesson's video.
  useEffect(() => {
    if (!showSummary || !lessonId || !parsed) return
    let cancelled = false
    api.get(`/progress/video/${lessonId}/summary/`)
      .then((data) => { if (!cancelled) setSummaryResult({ key: summaryKey, data, error: '' }) })
      .catch((error) => {
        if (!cancelled) setSummaryResult({
          key: summaryKey,
          data: null,
          error: error.message || 'Unable to load video watch statistics.',
        })
      })
    return () => { cancelled = true }
  }, [showSummary, lessonId, parsed?.kind, summaryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Student view: tracking + resume.
  useEffect(() => {
    if (!trackable) return
    let disposed = false
    let tracker = null
    let ytPlayer = null
    let cleanupFile = () => {}

    ;(async () => {
      let saved = { position: 0 }
      try {
        saved = await api.get(`/progress/video/${lessonId}/`)
        setProgressError('')
      } catch (error) {
        setProgressError(error.message || 'Unable to load saved video progress.')
      }
      if (disposed) return
      setProgress(saved)
      const resumeAt = saved.completed || saved.position < 5 ? 0 : Math.max(0, saved.position - 3)

      if (parsed.kind === 'file') {
        const el = videoRef.current
        if (!el) return
        tracker = createTracker({
          lessonId,
          onResult: setProgress,
          onError: (error) => setProgressError(error.message || 'Unable to save video progress.'),
          getState: () => ({ position: el.currentTime, duration: el.duration, playing: !el.paused && !el.ended, rate: el.playbackRate }),
        })
        tracker.begin()
        const onMeta = () => { if (resumeAt && resumeAt < el.duration) el.currentTime = resumeAt }
        const onPlay = () => tracker.started()
        const onFlush = () => tracker.flush()
        if (el.readyState >= 1) onMeta(); else el.addEventListener('loadedmetadata', onMeta, { once: true })
        el.addEventListener('play', onPlay); el.addEventListener('pause', onFlush)
        el.addEventListener('seeked', onFlush); el.addEventListener('ended', onFlush)
        if (!el.paused && !el.ended) tracker.started() // playback began before we attached (autoplay / quick click)
        cleanupFile = () => {
          el.removeEventListener('play', onPlay); el.removeEventListener('pause', onFlush)
          el.removeEventListener('seeked', onFlush); el.removeEventListener('ended', onFlush)
        }
        return
      }

      // YouTube
      const YT = await loadYouTubeApi()
      if (disposed || !hostRef.current) return
      const mount = document.createElement('div')
      hostRef.current.replaceChildren(mount)
      ytPlayer = new YT.Player(mount, {
        videoId: parsed.id,
        width: '100%', height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(resumeAt) },
        events: {
          onReady: () => {
            setPlayerStatus('ready')
            tracker = createTracker({
              lessonId,
              onResult: setProgress,
              onError: (error) => setProgressError(error.message || 'Unable to save video progress.'),
              getState: () => ytPlayer && {
                position: ytPlayer.getCurrentTime(), duration: ytPlayer.getDuration(),
                playing: ytPlayer.getPlayerState() === YT.PlayerState.PLAYING, rate: ytPlayer.getPlaybackRate(),
              },
            })
            tracker.begin()
            if (ytPlayer.getPlayerState?.() === YT.PlayerState.PLAYING) tracker.started()
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.BUFFERING) setPlayerStatus('processing')
            if (e.data === YT.PlayerState.PLAYING) setPlayerStatus('ready')
            if (!tracker) return
            if (e.data === YT.PlayerState.PLAYING) tracker.started()
            else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) tracker.flush()
          },
          onError: () => setPlayerStatus('missing'),
        },
      })
    })().catch((error) => {
      setPlayerStatus(navigator.onLine ? 'error' : 'offline')
      setProgressError(error.message || 'Unable to load video.')
    })

    return () => {
      disposed = true
      cleanupFile()
      tracker?.stop()
      try { ytPlayer?.destroy() } catch { /* already gone */ }
    }
  }, [trackable, lessonId, parsed?.kind, parsed?.id, parsed?.src, retryCount])

  function retryPlayer() {
    setPlayerStatus('loading')
    setProgressError('')
    if (uploadedVideo) setUploadedError('')
    if (parsed.kind === 'file') videoRef.current?.load()
    setRetryCount((count) => count + 1)
  }

  if (!parsedUrl && !uploadedVideo) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Video unavailable</p>
          <p className="mt-1">
            {track ? 'Please tell your instructor the video link needs fixing.' : 'Students won’t be able to play this link. Use a full https YouTube or Vimeo link, or a direct .mp4 / .webm / .ogg / .mov file.'}
          </p>
        </div>
      </div>
    )
  }

  const status = isOnline ? playerStatus : 'offline'
  const statusMessages = {
    loading: 'Video is loading',
    processing: 'Video is being prepared',
    missing: 'Video unavailable',
    offline: 'Connection lost',
    error: 'Unable to load video',
  }

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black" aria-busy={status === 'loading' || status === 'processing'}>
        {parsed.kind === 'file' && (!uploadedVideo || !!uploadedSource) && (
          <video
            ref={videoRef}
            src={parsed.src}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full"
            onLoadedData={() => setPlayerStatus('ready')}
            onWaiting={() => setPlayerStatus('processing')}
            onPlaying={() => setPlayerStatus('ready')}
            onError={() => setPlayerStatus('missing')}
          />
        )}
        {parsed.kind === 'vimeo' && (
          <iframe key={retryCount} src={parsed.embedUrl} title="Lesson video" className="h-full w-full" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setPlayerStatus('ready')} />
        )}
        {parsed.kind === 'youtube' && track && <div ref={hostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />}
        {parsed.kind === 'youtube' && !track && (
          <iframe
            key={retryCount}
            src={`https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0`}
            title="Lesson video" className="h-full w-full" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; picture-in-picture"
            onLoad={() => setPlayerStatus('ready')}
          />
        )}
        {status !== 'ready' && (
          <div className={`absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-slate-950/85 px-4 py-3 text-sm text-white ${status === 'loading' || status === 'processing' ? 'pointer-events-none' : ''}`} role={status === 'missing' || status === 'error' ? 'alert' : 'status'}>
            <span className="flex items-center gap-2">
              {status === 'missing' || status === 'error' ? <TriangleAlert size={16} aria-hidden="true" /> : null}
              {statusMessages[status] || 'Video is loading'}
            </span>
            {(status === 'missing' || status === 'error' || status === 'offline') && isOnline && (
              <button type="button" onClick={retryPlayer} className="inline-flex items-center gap-1.5 rounded border border-white/40 px-2 py-1 text-xs font-semibold hover:bg-white/10 lms-focus-ring">
                <RotateCw size={13} aria-hidden="true" /> Retry
              </button>
            )}
          </div>
        )}
      </div>

      {progressError && track && <p className="mt-2 text-xs text-amber-700" role="status">{progressError} Playback can continue, but resume data may be stale.</p>}
      {uploadedError && <p className="mt-2 text-xs text-rose-700" role="alert">{uploadedError}</p>}
      {track && parsed.kind === 'vimeo' && (
        <p className="mt-2 text-xs text-text-secondary">Watch progress isn’t recorded for Vimeo videos.</p>
      )}
      {trackable && progress && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary" role="status">
          {progress.completed
            ? <><CircleCheck size={14} className="text-emerald-600" aria-hidden="true" /> Watched</>
            : <>Watched {Math.round(progress.percent || 0)}%{progress.position >= 5 ? ` · you’ll resume at ${fmt(Math.max(0, progress.position - 3))}` : ''}</>}
        </p>
      )}
      {!track && summaryResult?.key === summaryKey && summaryResult.data && (
        <p className="mt-2 text-xs text-text-secondary">
          {summaryResult.data.students.filter((s) => s.completed).length} of {summaryResult.data.students.length} enrolled students have watched this video.
        </p>
      )}
      {!track && summaryResult?.key === summaryKey && summaryResult.error && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-rose-700" role="alert">
          <span>{summaryResult.error}</span>
          <button type="button" onClick={() => setSummaryRetryCount((count) => count + 1)} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
            <RotateCw size={12} aria-hidden="true" /> Retry
          </button>
        </p>
      )}
      {!track && parsed.kind === 'vimeo' && <p className="mt-2 text-xs text-text-secondary">Students can play this, but progress isn’t tracked for Vimeo.</p>}
    </div>
  )
}
