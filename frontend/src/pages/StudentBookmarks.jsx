import { useEffect, useState } from 'react'
import { ArrowUpRight, Bookmark, BookmarkX, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

export default function StudentBookmarks() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/community/bookmarks/')
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : data.results || []) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Bookmarks could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  async function removeBookmark(id) {
    setError('')
    try {
      await api.del(`/community/bookmarks/${id}/`)
      setItems((current) => current.filter((item) => item.id !== id))
    } catch (err) {
      setError(err.message || 'Bookmark could not be removed.')
    }
  }

  return (
    <StudentPage title="Bookmarks" description="Pick up quickly from lessons you saved for later.">
      {loading && <StudentPageMessage>Loading your bookmarks…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          {error}
          <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}>
            <RotateCw size={13} /> Try again
          </button>
        </StudentPageMessage>
      )}
      {!loading && !error && !items.length && <StudentPageMessage>Save a lesson bookmark from your course page to find it here.</StudentPageMessage>}
      {!loading && items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="dg-card flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex min-w-0 items-start gap-3">
                <Bookmark size={18} className="mt-1 shrink-0 text-blue-700" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-900">{item.lesson_title}</h2>
                  <p className="mt-1 truncate text-sm text-slate-600">{item.course_title}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link to={`/dashboard/student/lessons/${item.lesson}`} aria-label={`Open ${item.lesson_title}`} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50">
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <button type="button" onClick={() => removeBookmark(item.id)} aria-label={`Remove bookmark for ${item.lesson_title}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                  <BookmarkX size={17} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudentPage>
  )
}
