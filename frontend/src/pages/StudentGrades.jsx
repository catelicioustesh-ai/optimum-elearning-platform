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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">Exercises, labs & assignments</h3>
              <p className="mt-1 text-sm text-text-muted">Scores, submission status, and instructor feedback.</p>
            </div>
            <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-text-muted">{submissions.length} submissions</span>
          </div>
          {submissions.length ? (
            <ExpandableList items={submissions} label="submissions" listClassName="mt-3 divide-y divide-line">
              {(s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel/50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{s.activity_title}</p>
                    <p className="mt-1 text-xs text-text-dim">
                      {s.course_title ? `${s.course_title} · ` : ''}Attempt {s.attempt_number} · Submitted {new Date(s.submitted_at).toLocaleDateString()}
                    </p>
                    {s.feedback && <p className="mt-2 text-sm text-text-muted">{s.feedback}</p>}
                  </div>
                  {s.status === 'graded' ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1.5 text-sm font-semibold text-mint">
                      <CircleCheckBig size={14} aria-hidden="true" /> {s.grade}{s.max_score != null ? ` / ${s.max_score}` : ''} pts
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 text-sm font-semibold text-text-muted">
                      <Clock3 size={14} aria-hidden="true" /> Awaiting review
                    </span>
                  )}
                </div>
              )}
            </ExpandableList>
          ) : <p className="mt-3 py-3 text-sm text-text-muted" role="status">No submissions yet.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">Quizzes</h3>
              <p className="mt-1 text-sm text-text-muted">Your latest attempt scores and pass status.</p>
            </div>
            <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-text-muted">{quizAttempts.length} attempts</span>
          </div>
          {quizAttempts.length ? (
            <ExpandableList items={quizAttempts} label="quiz attempts" listClassName="mt-3 divide-y divide-line">
              {(q) => (
                <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel/50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{q.quiz_title || `Quiz ${q.quiz}`}</p>
                    <p className="mt-1 text-xs text-text-dim">
                      {q.course_title ? `${q.course_title} · ` : ''}Attempt {q.attempt_number} · {new Date(q.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-blue-500/10 px-3 py-1.5 text-sm font-semibold text-blue-700">
                      {q.score}/{q.total_marks} pts · {q.percentage}%
                    </span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${q.passed ? 'bg-mint/15 text-mint' : 'bg-coral-tint text-coral-dim'}`}>
                      {q.passed ? 'Passed' : 'Not passed'}
                    </span>
                  </div>
                </div>
              )}
            </ExpandableList>
          ) : <p className="mt-3 py-3 text-sm text-text-muted" role="status">No quiz attempts yet.</p>}
        </div>
      </div>
    </DashboardLayout>
  )
}
