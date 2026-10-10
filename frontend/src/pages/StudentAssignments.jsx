import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarClock, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

export default function StudentAssignments() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/activities/?activity_type=assignment')
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Assignments could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [reload])

  return (
    <StudentPage title="Assignments" description="Assignments from modules currently available to you.">
      {loading && <StudentPageMessage>Loading assignments…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          <span>{error}</span>
          <button type="button" className="ml-3 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}>Try again</button>
        </StudentPageMessage>
      )}
      {!loading && !error && !items.length && (
        <StudentPageMessage>No open assignments are available in your unlocked lessons.</StudentPageMessage>
      )}
      {!loading && !error && items.length > 0 && (
        <section className="dg-card overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Available assignment work</h2>
            <p className="mt-1 text-sm text-slate-600">{items.length} assignment{items.length === 1 ? '' : 's'} in unlocked lessons</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const overdue = item.deadline && new Date(item.deadline) < new Date() && item.completion_status !== 'completed'
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-blue-50 p-2 text-blue-700"><CircleDashed size={18} aria-hidden="true" /></div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{item.instructions || 'Open the lesson to review the assignment details.'}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarClock size={13} aria-hidden="true" />
                        {item.deadline ? `Due ${new Date(item.deadline).toLocaleString()}` : 'No deadline'}
                        {item.deadline && <span aria-hidden="true">·</span>}
                        {item.deadline && (overdue ? 'Past due' : 'On schedule')}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.completion_status === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Completed</span>
                    ) : overdue ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700"><Clock3 size={16} /> Overdue</span>
                    ) : <span className="text-sm font-medium text-slate-600">Not completed</span>}
                    <Link
                      to={`/dashboard/student/lessons/${item.lesson}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      Open <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </StudentPage>
  )
}
