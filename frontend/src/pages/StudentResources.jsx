import { useEffect, useState } from 'react'
import { Download, FileText, RotateCw } from 'lucide-react'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

export default function StudentResources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/lesson-attachments/')
      .then((data) => {
        if (!cancelled) setResources(Array.isArray(data) ? data : data.results || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Course resources could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [reload])

  async function download(resource) {
    setError('')
    setDownloading(resource.id)
    try {
      await api.download(resource.download_url, `${resource.title || 'course-resource'}.pdf`)
    } catch (err) {
      setError(err.message || 'The resource could not be downloaded.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <StudentPage title="Course resources" description="Handouts and reading materials from lessons available to you.">
      {loading && <StudentPageMessage>Loading course resources…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          {error}
          <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}>
            <RotateCw size={13} /> Try again
          </button>
        </StudentPageMessage>
      )}
      {!loading && !error && !resources.length && <StudentPageMessage>No downloadable resources are available in your unlocked lessons yet.</StudentPageMessage>}
      {!loading && resources.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <article key={resource.id} className="dg-card rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><FileText size={20} aria-hidden="true" /></span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">PDF</span>
              </div>
              <h2 className="mt-4 font-semibold text-slate-900">{resource.title}</h2>
              <p className="mt-1 text-sm text-slate-600">Lesson resource</p>
              <button
                type="button"
                disabled={downloading === resource.id}
                onClick={() => download(resource)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 disabled:opacity-60"
              >
                <Download size={15} aria-hidden="true" />
                {downloading === resource.id ? 'Preparing…' : 'Download resource'}
              </button>
            </article>
          ))}
        </section>
      )}
    </StudentPage>
  )
}
