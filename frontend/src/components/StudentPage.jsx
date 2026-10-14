import { Helmet } from 'react-helmet-async'
import DashboardLayout from './DashboardLayout.jsx'
import { useAuth } from '../context/useAuth.js'

export default function StudentPage({
  title,
  description,
  children,
  profile,
  fetchStudentProfile = true,
  role: roleProp,
}) {
  const { auth } = useAuth()
  const role = roleProp || auth?.role || 'student'
  return (
    <DashboardLayout
      user={{ name: auth?.email || 'Student' }}
      studentProfile={profile}
      fetchStudentProfile={fetchStudentProfile}
      role={role}
    >
      <Helmet>
        <title>{title} — Optimum LMS</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="space-y-6" data-role={role}>
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{role} workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
        </header>
        {children}
      </div>
    </DashboardLayout>
  )
}

export function StudentPageMessage({ children, tone = 'neutral', role }) {
  const styles = {
    neutral: 'border-slate-200 bg-white text-slate-600',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`} role={role || (tone === 'error' ? 'alert' : 'status')}>
      {children}
    </div>
  )
}
