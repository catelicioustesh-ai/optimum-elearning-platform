/**
 * Single point of contact with the Django backend.
 * - Reads the API base URL from env (VITE_API_URL), so dev/staging/prod
 *   just swap .env files instead of editing code.
 * - Uses HttpOnly JWT cookies; JavaScript never reads auth tokens.
 * - Adds CSRF protection to state-changing requests and refreshes sessions
 *   after a 401 before redirecting to /login.
 */

const DEFAULT_API_URL = import.meta.env.DEV
  ? '/api'
  : `${window.location.origin}/api`

function secureUrl(url) {
  if (window.location.protocol === 'https:' && url.protocol === 'http:') {
    url.protocol = 'https:'
  }
  return url
}

const API_URL = secureUrl(new URL(import.meta.env.VITE_API_URL || DEFAULT_API_URL, window.location.origin)).href.replace(/\/$/, '')

export function mediaUrl(path) {
  if (!path) return null
  const apiOrigin = new URL(API_URL).origin
  const resourceUrl = secureUrl(new URL(path, `${apiOrigin}/`))
  return resourceUrl.href
}

export function backendUrl(path) {
  const apiBase = new URL(API_URL)
  apiBase.pathname = `${apiBase.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`
  apiBase.search = ''
  apiBase.hash = ''
  return secureUrl(apiBase).href
}

function clearTokens() {
  // Remove bearer tokens saved by earlier client versions.
  localStorage.removeItem('auth')
  csrfToken = null
}

let csrfToken = null

async function getCSRFToken() {
  if (csrfToken) return csrfToken
  let res
  try {
    res = await fetch(`${API_URL}/auth/csrf/`, { credentials: 'include' })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('The secure session request was cancelled. Please try again.', {
        code: 'REQUEST_ABORTED',
      })
    }
    throw new ApiError('Unable to reach the server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
      data: { cause: error?.message },
    })
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.csrfToken) {
    throw new ApiError('Unable to establish a secure session. Please try again.', {
      status: res.status,
      code: 'CSRF_TOKEN_UNAVAILABLE',
    })
  }
  csrfToken = data.csrfToken
  return csrfToken
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

// Refresh tokens rotate and the old one is blacklisted, so simultaneous 401s
// must share one refresh request.
let refreshInFlight = null
function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const token = await getCSRFToken()
      let res
      try {
        res = await fetch(`${API_URL}/auth/login/refresh/`, {
          method: 'POST',
          headers: { 'X-CSRFToken': token },
          credentials: 'include',
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
      return res.ok
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

async function request(path, { method = 'GET', body, auth = true, isFormData = false, blob = false, keepalive = false, redirectOnUnauthorized = true } = {}) {
  const headers = {}
  if (!isFormData) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase())) {
    headers['X-CSRFToken'] = await getCSRFToken()
  }
  const buildBody = () => (isFormData ? body : body ? JSON.stringify(body) : undefined)
  const send = async () => {
    try {
      return await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: buildBody(),
        keepalive,
        credentials: 'include',
      })
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
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      res = await send()
    }
    if (res.status === 401 && redirectOnUnauthorized) {
      clearTokens()
      window.location.assign('/login')
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
  login: async (email, password) => {
    const result = await request('/auth/login/', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    if (result?.csrfToken) csrfToken = result.csrfToken
    return result
  },

  logout: () =>
    request('/auth/logout/', { method: 'POST', body: {}, auth: false }),

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

  me: () => request('/auth/me/', { redirectOnUnauthorized: false }),

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

clearTokens()

export { clearTokens }
