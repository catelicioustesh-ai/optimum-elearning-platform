import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

/**
 * IMPORTANT: this is a UX convenience, not the real security boundary.
 * Hiding a route here just stops a logged-in student from *seeing* the
 * instructor dashboard shell — it does nothing to stop someone from
 * calling the API directly. The actual enforcement is server-side, in
 * Django's permission classes (see apps/accounts/permissions.py and the
 * module-locking checks in apps/courses/views.py). Never rely on this
 * component alone to protect anything.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { auth, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-text-muted" role="status">Loading your session...</div>
  }
  if (!auth) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return <Navigate to={`/dashboard/${auth.role}`} replace />
  }

  return children
}
