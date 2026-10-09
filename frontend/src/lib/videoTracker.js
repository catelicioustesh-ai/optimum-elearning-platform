import { api } from './api.js'

const HEARTBEAT_MS = 10_000

/**
 * Sends the player's position to the server while it is playing.
 * The SERVER decides how much of it counts as "watched" (seeking ahead earns
 * nothing) — see backend/apps/progress/video.py — so this only reports facts.
 *
 * getState() -> { position, duration, playing, rate }
 */
export function createTracker({ lessonId, getState, onResult, onError }) {
  let timer = null
  let flushTimer = null
  let lastSent = 0

  async function send() {
    clearTimeout(flushTimer)
    flushTimer = null
    const s = getState()
    if (!s || !Number.isFinite(s.position) || !Number.isFinite(s.duration) || s.duration <= 0) return
    lastSent = Date.now()
    try {
      const result = await api.put(`/progress/video/${lessonId}/`, { position: s.position, duration: s.duration, playing: !!s.playing, rate: s.rate || 1 }, { keepalive: true })
      if (result && onResult) onResult(result)
    } catch (error) {
      onError?.(error)
    }
  }

  const flushSoon = () => {
    const delay = 800 - (Date.now() - lastSent)
    if (delay <= 0) send()
    else {
      clearTimeout(flushTimer)
      flushTimer = setTimeout(send, delay)
    }
  }
  const onHide = () => { if (document.visibilityState === 'hidden') send() }

  return {
    /** call on play */
    started() {
      send()
      if (!timer) timer = setInterval(() => { if (getState()?.playing) send() }, HEARTBEAT_MS)
    },
    /** call on pause, seek, end */
    flush: flushSoon,
    begin() {
      document.addEventListener('visibilitychange', onHide)
      window.addEventListener('pagehide', send)
    },
    stop() {
      clearInterval(timer); timer = null
      clearTimeout(flushTimer); flushTimer = null
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', send)
      send()
    },
  }
}
