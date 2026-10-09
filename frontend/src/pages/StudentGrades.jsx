import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { LayoutDashboard, BookOpen, GraduationCap, CircleCheckBig, Clock3 } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout.jsx'
import ExpandableList from '../components/ExpandableList.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const navItems = [
  { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/student/courses', label: 'My Courses', icon: BookOpen },
  { to: '/dashboard/student/grades', label: 'Grades', icon: GraduationCap },
]

export default function StudentGrades() {
  const { auth } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [quizAttempts, setQuizAttempts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/submissions/'), api.get('/quiz-attempts/')])
      .then(([subs, quizzes]) => {
        setSubmissions(subs)
        setQuizAttempts(quizzes)
      })
      .catch((err) => setError(err.message))
  }, [])

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Student' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="space-y-6">
        <div>
          <p className="text-sm text-text-muted">Results</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">Grades & feedback</h2>
        </div>

        {error && (
          <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>
        )}

        <div className="rounded-2xl border border-line bg-paper p-5">
          <h3 className="font-semibold text-ink">Exercises, labs & assignments</h3>
          {submissions.length ? (
            <ExpandableList items={submissions} label="submissions" listClassName="mt-3 divide-y divide-line">
              {(s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{s.activity_title}</p>
                  <p className="text-xs text-text-dim">Attempt {s.attempt_number} · {new Date(s.submitted_at).toLocaleDateString()}</p>
                  {s.feedback && <p className="mt-1 text-sm text-text-muted">"{s.feedback}"</p>}
                </div>
                {s.status === 'graded' ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1 text-sm font-medium text-mint">
                    <CircleCheckBig size={14} /> {s.grade} pts
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-sm text-text-muted">
                    <Clock3 size={14} /> Pending
                  </span>
                )}
                </div>
              )}
            </ExpandableList>
          ) : <p className="mt-3 py-3 text-sm text-text-muted" role="status">No submissions yet.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5">
          <h3 className="font-semibold text-ink">Quizzes</h3>
          {quizAttempts.length ? (
            <ExpandableList items={quizAttempts} label="quiz attempts" listClassName="mt-3 divide-y divide-line">
              {(q) => (
                <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Attempt {q.attempt_number}</p>
                  <p className="text-xs text-text-dim">{new Date(q.submitted_at).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${q.passed ? 'bg-mint/15 text-mint' : 'bg-coral-tint text-coral-dim'}`}>
                  {q.score}/{q.total_marks} ({q.percentage}%)
                </span>
                </div>
              )}
            </ExpandableList>
          ) : <p className="mt-3 py-3 text-sm text-text-muted" role="status">No quiz attempts yet.</p>}
        </div>
      </div>
    </DashboardLayout>
  )
}
