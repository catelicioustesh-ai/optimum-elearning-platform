import { useState, useCallback, useEffect } from 'react'
import { api, clearTokens } from '../lib/api.js'
import { AuthContext } from './auth-context.js'

function toAuthUser(user) {
  if (!user) return null
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    bio: user.bio,
    profile_photo: user.profile_photo,
    leaderboard_opt_in: user.leaderboard_opt_in,
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.me()
      .then((user) => {
        if (active) setAuth(toAuthUser(user))
      })
      .catch(() => {
        if (active) setAuth(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const establishSession = useCallback((user) => {
    if (!user?.role) throw new Error('The server returned an invalid sign-in session. Please try again.')
    const session = toAuthUser(user)
    setAuth(session)
    return session
  }, [])

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password)
    return establishSession(result?.user)
  }, [establishSession])

  const updateAuthProfile = useCallback((profile) => {
    setAuth((current) => current ? { ...current, ...profile } : current)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    clearTokens()
    setAuth(null)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, login, establishSession, logout, loading, updateAuthProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
