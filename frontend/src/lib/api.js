/**
 * Single point of contact with the Django backend.
 * - Reads the API base URL from env (VITE_API_URL), so dev/staging/prod
 *   just swap .env files instead of editing code.
 * - Attaches the JWT access token to every request automatically.
 * - Refreshes near-expiry access tokens before requests; if a 401 still
 *   occurs and refresh cannot recover the session, redirects to /login.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const ACCESS_TOKEN_REFRESH_SKEW_MS = 30_000

function getTokens() {
  const raw = localStorage.getItem('auth')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    clearTokens()
    return null
  }
}

function setTokens(tokens) {
  localStorage.setItem('auth', JSON.stringify(tokens))
}

function clearTokens() {
  localStorage.removeItem('auth')
}

/**
 * Decode a JWT payload without verifying it (verification happens
 * server-side on every request — this is purely for reading the role/
 * email client-side to decide where to route the user).
 */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

function accessTokenNeedsRefresh(token) {
  const payload = decodeToken(token)
  return Number.isFinite(payload?.exp)
    && payload.exp * 1000 <= Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS
}

export class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code // machine-readable backend error code
    this.data = data
  }
}

// Refresh tokens rotate and the old one is blacklisted, so two requests that
// hit 401 at the same moment must share ONE refresh call — otherwise the second
// uses an already-blacklisted token, fails, and the user is logged out.
let refreshInFlight = null
function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = getTokens()
      if (!tokens?.refresh) return null
      let res
      try {
        res = await fetch(`${API_URL}/auth/login/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: tokens.refresh }),
        })
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new ApiError('The session refresh was cancelled. Please try again.', { code: 'REQUEST_ABORTED' })
        }
        throw new ApiError(
          'Unable to reach the server. Check your connection and try again.',
          { code: 'NETWORK_ERROR', data: { cause: error?.message } },
        )
      }

      const responseText = await res.text()
      let refreshed = null
      if (responseText) {
        try {
          refreshed = JSON.parse(responseText)
        } catch {
          if (res.ok) {
            throw new ApiError('The server returned an unreadable session response. Please try again.', {
              status: res.status,
              code: 'INVALID_RESPONSE',
            })
          }
        }
      }
      if (res.status >= 500) {
        throw new ApiError(errorMessage(refreshed, res.status), {
          status: res.status,
          code: refreshed?.code,
          data: refreshed,
        })
      }
      if (!res.ok || !refreshed?.access) return null
      const updated = { ...tokens, ...refreshed }
      setTokens(updated)
      return updated.access
    })().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

/** Flatten DRF error bodies ({field: [msgs]} | {detail}) into one readable string. */
function errorMessage(data, status) {
  if (status === 503 && data?.code === 'CODE_RUNNER_UNAVAILABLE' && data.error) return data.error
  if (status >= 500) {
    if (status === 503) return 'The service is temporarily unavailable. Please try again shortly.'
    if (status === 504) return 'The server took too long to respond. Please try again.'
    return 'The server encountered an error. Please try again shortly.'
  }
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (!data) return `Request failed (${status || 'unknown status'}).`
  if (typeof data === 'string') return data
  if (data.detail) return typeof data.detail === 'string' ? data.detail : errorMessage(data.detail, status)
  const parts = []
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    else if (v) parts.push(String(v))
  }
  walk(data)
  return parts.join(' ') || 'Request failed'
}

async function request(path, { method = 'GET', body, auth = true, isFormData = false, blob = false, keepalive = false } = {}) {
  const headers = {}
  if (!isFormData) headers['Content-Type'] = 'application/json'
  if (auth) {
    const tokens = getTokens()
    if (tokens?.refresh && (!tokens.access || accessTokenNeedsRefresh(tokens.access))) {
      const access = await refreshAccessToken()
      if (!access) {
        clearTokens()
        window.location.href = '/login'
        return null
      }
    }
  }
  if (auth) {
    const tokens = getTokens()
    if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`
  }
  const buildBody = () => (isFormData ? body : body ? JSON.stringify(body) : undefined)
  const send = async () => {
    try {
      return await fetch(`${API_URL}${path}`, { method, headers, body: buildBody(), keepalive })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ApiError('The request was cancelled. Please try again.', { code: 'REQUEST_ABORTED' })
      }
      throw new ApiError(
        'Unable to reach the server. Check your connection and try again.',
        { code: 'NETWORK_ERROR', data: { cause: error?.message } },
      )
    }
  }

  let res = await send()

  if (res.status === 401 && auth) {
    const access = await refreshAccessToken()
    if (access) {
      headers.Authorization = `Bearer ${access}`
      res = await send()
    }
    if (res.status === 401) {
      clearTokens()
      window.location.href = '/login'
      return null
    }
  }

  if (blob && res.ok) return res.blob()

  const responseText = await res.text()
  let data = null
  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      if (res.ok) {
        throw new ApiError('The server returned an unreadable response. Please try again.', {
          status: res.status,
          code: 'INVALID_RESPONSE',
        })
      }
      data = responseText
    }
  }
  if (!res.ok) {
    throw new ApiError(errorMessage(data, res.status), { status: res.status, code: data?.code, data })
  }
  return data
}

/** Download a protected file (needs the auth header, so a plain <a href> can't do it). */
async function downloadFile(path, filename) {
  const blob = await request(path, { blob: true })
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  else a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const api = {
  login: (email, password) =>
    request('/auth/login/', { method: 'POST', body: { email, password }, auth: false }),

  logout: (refresh) =>
    request('/auth/logout/', { method: 'POST', body: { refresh } }),

  register: (payload) =>
    request('/auth/register/', { method: 'POST', body: payload, auth: false }),

  verifyEmail: (uid, token) =>
    request('/auth/email/verify/', { method: 'POST', body: { uid, token }, auth: false }),

  resendVerification: (email) =>
    request('/auth/email/resend-verification/', { method: 'POST', body: { email }, auth: false }),

  requestPasswordReset: (email) =>
    request('/auth/password-reset/', { method: 'POST', body: { email }, auth: false }),

  confirmPasswordReset: (payload) =>
    request('/auth/password-reset/confirm/', { method: 'POST', body: payload, auth: false }),

  me: () => request('/auth/me/'),

  get: (path) => request(path),
  verifyCertificate: (certificateNumber) =>
    request(`/engagement/certificates/${encodeURIComponent(certificateNumber)}/verify/`, { auth: false }),
  getBlob: (path) => request(path, { blob: true }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body, opts = {}) => request(path, { method: 'PATCH', body, ...opts }),
  put: (path, body, opts = {}) => request(path, { method: 'PUT', body, ...opts }),
  download: downloadFile,
  del: (path) => request(path, { method: 'DELETE' }),

  // File uploads (PDFs, etc.) — must NOT set Content-Type manually; the
  // browser sets it (including the multipart boundary) when the body is
  // a real FormData object. Setting it ourselves breaks the upload.
  upload: (path, formData) => request(path, { method: 'POST', body: formData, isFormData: true }),
}

export { getTokens, setTokens, clearTokens, decodeToken }
