import { useEffect, useState } from 'react'
import { LoaderCircle, MessageCircle, MessageSquareText, RotateCw, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

function listFromResponse(data) {
  return Array.isArray(data) ? data : data.results || []
}

export default function StudentCommunity() {
  const [enrollments, setEnrollments] = useState([])
  const [threads, setThreads] = useState([])
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [replies, setReplies] = useState({})
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get('/enrollments/'), api.get('/community/discussions/')])
      .then(([enrollmentData, threadData]) => {
        if (cancelled) return
        const availableEnrollments = listFromResponse(enrollmentData)
        setEnrollments(availableEnrollments)
        setCourseId((current) => current || String(availableEnrollments[0]?.course || ''))
        setThreads(listFromResponse(threadData))
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Community discussions could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  async function createThread(event) {
    event.preventDefault()
    if (!courseId) return
    setPosting(true)
    setError('')
    try {
      await api.post('/community/discussions/', { course: Number(courseId), title: title.trim(), body: body.trim() })
      setTitle('')
      setBody('')
      setReload((value) => value + 1)
    } catch (err) {
      setError(err.message || 'Your discussion could not be posted.')
    } finally {
      setPosting(false)
    }
  }

  async function createReply(thread) {
    const replyBody = (replies[thread.id] || '').trim()
    if (!replyBody) return
    setReplyingTo(thread.id)
    setError('')
    try {
      await api.post(`/community/discussions/${thread.id}/replies/`, { body: replyBody })
      setReplies((current) => ({ ...current, [thread.id]: '' }))
      setReload((value) => value + 1)
    } catch (err) {
      setError(err.message || 'Your reply could not be posted.')
    } finally {
      setReplyingTo(null)
    }
  }

  const selectedEnrollment = enrollments.find((item) => String(item.course) === String(courseId))

  return (
    <StudentPage title="Community" description="Ask questions and share course-specific learning tips with other enrolled students.">
      {error && (
        <StudentPageMessage tone="error">
          {error}
          {loading && <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}><RotateCw size={13} /> Try again</button>}
        </StudentPageMessage>
      )}
      {loading && <StudentPageMessage>Loading your courses and discussions…</StudentPageMessage>}
      {!loading && enrollments.length === 0 && (
        <section className="dg-card rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">Join a course to take part</h2>
          <p className="mt-1 text-sm text-slate-600">Course discussions are limited to learners who are enrolled.</p>
          <Link to="/dashboard/student/courses" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Browse courses</Link>
        </section>
      )}
      {!loading && enrollments.length > 0 && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
          <form onSubmit={createThread} className="dg-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <h2 className="font-semibold text-slate-900">Start a discussion</h2>
              <p className="mt-1 text-sm text-slate-600">Posts are visible only to people with access to the selected course.</p>
            </div>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Course
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                {enrollments.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.course}>{enrollment.course_detail?.title || `Course ${enrollment.course}`}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Topic
              <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} placeholder="What would you like to discuss?" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Message
              <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={10000} rows={5} placeholder="Share your question or tip…" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            </label>
            <button type="submit" disabled={posting || !courseId} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
              {posting ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />} Post discussion
            </button>
          </form>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Course conversations</p><h2 className="mt-1 text-lg font-bold text-slate-900">{selectedEnrollment?.course_detail?.title || 'Discussions'}</h2></div>
              {enrollments.length > 1 && (
                <label className="text-xs font-semibold text-slate-600">
                  Show course
                  <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800">
                    {enrollments.map((enrollment) => <option key={enrollment.id} value={enrollment.course}>{enrollment.course_detail?.title || `Course ${enrollment.course}`}</option>)}
                  </select>
                </label>
              )}
            </div>
            {threads.filter((thread) => !courseId || String(thread.course) === String(courseId)).length === 0 ? (
              <StudentPageMessage>No discussions in this course yet. Start one to get the conversation going.</StudentPageMessage>
            ) : threads.filter((thread) => !courseId || String(thread.course) === String(courseId)).map((thread) => (
              <article key={thread.id} className="dg-card rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-blue-50 p-2 text-blue-700"><MessageSquareText size={18} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{thread.title}</h3>
                      <time className="text-xs text-slate-500" dateTime={thread.updated_at}>{new Date(thread.updated_at).toLocaleDateString()}</time>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">{thread.author_name} · {thread.course_title}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{thread.body}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-l-2 border-blue-100 pl-4">
                  {(thread.replies || []).map((reply) => (
                    <div key={reply.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-xs font-semibold text-slate-800">{reply.author_name} <time className="ml-1 font-normal text-slate-500" dateTime={reply.created_at}>{new Date(reply.created_at).toLocaleDateString()}</time></p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{reply.body}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <input value={replies[thread.id] || ''} onChange={(event) => setReplies((current) => ({ ...current, [thread.id]: event.target.value }))} maxLength={10000} aria-label={`Reply to ${thread.title}`} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600" />
                    <button type="button" onClick={() => createReply(thread)} disabled={!replies[thread.id]?.trim() || replyingTo === thread.id} aria-label="Post reply" className="rounded-lg bg-slate-900 px-3 text-white hover:bg-slate-700 disabled:opacity-50">
                      {replyingTo === thread.id ? <LoaderCircle size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </StudentPage>
  )
}
