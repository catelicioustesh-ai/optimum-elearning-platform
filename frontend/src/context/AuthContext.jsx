import { useState, useCallback, useEffect } from 'react'
import { api, clearTokens } from '../lib/api.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.me()
      .then((user) => {
        if (active) setAuth(user ? { id: user.id, role: user.role, email: user.email } : null)
      })
      .catch(() => {
        if (active) setAuth(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password)
    const user = result?.user
    if (!user?.role) throw new Error('The server returned an invalid sign-in session. Please try again.')
    const session = { id: user.id, role: user.role, email: user.email }
    setAuth(session)
    return session
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    clearTokens()
    setAuth(null)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
