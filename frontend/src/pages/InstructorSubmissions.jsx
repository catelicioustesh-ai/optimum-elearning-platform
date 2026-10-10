import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { LayoutDashboard, BookOpen, FileCheck, Users, CircleCheckBig, Clock3 } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout.jsx'
import ExpandableList from '../components/ExpandableList.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const navItems = [
  { to: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/instructor/content', label: 'Course Content', icon: BookOpen },
  { to: '/dashboard/instructor/submissions', label: 'Submissions', icon: FileCheck },
  { to: '/dashboard/instructor/students', label: 'Students', icon: Users },
]

export default function InstructorSubmissions() {
  const { auth } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [filter, setFilter] = useState('submitted')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  function reload() {
    setLoading(true)
    setError('')
    setReloadKey((value) => value + 1)
  }

  useEffect(() => {
    let cancelled = false
    const query = filter ? `?status=${filter}` : ''
    api.get(`/submissions/${query}`)
      .then((result) => { if (!cancelled) setSubmissions(result) })
      .catch((err) => { if (!cancelled) setError(`Unable to load submissions: ${err.message}`) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filter, reloadKey])

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Instructor' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted">Review</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">Submissions</h2>
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setLoading(true)
              setError('')
              setStatus('')
              setFilter(e.target.value)
            }}
            className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="submitted">Pending review</option>
            <option value="graded">Graded</option>
            <option value="">All</option>
          </select>
        </div>

        {error && <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>}
        {status && <div className="rounded-lg border border-mint/40 bg-mint/10 px-4 py-3 text-sm text-mint" role="status">{status}</div>}

        {loading ? (
          <p className="rounded-2xl border border-line bg-paper p-6 text-sm text-text-muted" role="status">Loading submissions…</p>
        ) : submissions.length ? (
          <ExpandableList
            items={submissions}
            label="submissions"
            listClassName="space-y-3"
            className="mt-4 rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink hover:bg-panel"
          >
            {(submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                onGraded={() => { setStatus('Grade saved.'); reload() }}
              />
            )}
          </ExpandableList>
        ) : (
          <p className="rounded-2xl border border-line bg-paper p-6 text-sm text-text-muted" role="status">No submissions match this filter.</p>
        )}
      </div>
    </DashboardLayout>
  )
}

function SubmissionRow({ submission, onGraded }) {
  const [grading, setGrading] = useState(false)
  const [grade, setGrade] = useState(submission.grade ?? '')
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.patch(`/submissions/${submission.id}/grade/`, { grade: Number(grade), feedback })
      setGrading(false)
      onGraded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-ink">{submission.activity_title}</p>
          <p className="text-sm text-text-muted">{submission.student_name || `Student #${submission.student}`}</p>
          {(submission.activity_type === 'exercise' || submission.activity_type === 'lab') && (
            <p className="text-xs text-text-dim">Submitted code · {{ python: 'Python', javascript: 'JavaScript', html: 'HTML', c: 'C', cpp: 'C++', java: 'Java' }[submission.activity_language] || submission.activity_language}</p>
          )}
          <p className="mt-1 text-xs text-text-dim">
            Attempt {submission.attempt_number} · {new Date(submission.submitted_at).toLocaleString()}
          </p>
        </div>
        {submission.status === 'graded' ? (
          <span className="flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1 text-sm font-medium text-mint">
            <CircleCheckBig size={14} /> {submission.grade} / {submission.max_score} pts
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-sm text-text-muted">
            <Clock3 size={14} /> Pending
          </span>
        )}
      </div>

      {submission.content && (
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-panel p-3 font-mono text-xs text-ink">
          {submission.content}
        </pre>
      )}
      {submission.github_url && (
        <a href={submission.github_url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-coral hover:underline">
          {submission.github_url}
        </a>
      )}
      {submission.download_url && (
        <button
          type="button"
          onClick={() => api.download(submission.download_url.replace(/^\/api/, ''), submission.file_name).catch((err) => setError(err.message))}
          className="mt-2 block text-sm text-coral hover:underline"
        >
          Download {submission.file_name || 'attached file'}
        </button>
      )}

      {grading ? (
        <form onSubmit={handleSave} className="mt-4 space-y-2 border-t border-line pt-4">
          {error && <p className="text-sm text-coral-dim">{error}</p>}
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={submission.max_score}
              step="any"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder={`Score / ${submission.max_score}`}
              required
              className="w-28 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Feedback for the student"
              className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-md bg-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60">
              {busy ? 'Saving…' : 'Save grade'}
            </button>
            <button type="button" onClick={() => setGrading(false)} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setGrading(true)}
          className="mt-4 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:border-text-dim"
        >
          {submission.status === 'graded' ? 'Update grade' : 'Grade this'}
        </button>
      )}
    </div>
  )
}
