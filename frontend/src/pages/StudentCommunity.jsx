import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown, LoaderCircle, MessageCircle, MessageSquareText, RotateCw, Send } from 'lucide-react'
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
  const [postingFormOpen, setPostingFormOpen] = useState(false)
  const [threadOrder, setThreadOrder] = useState('recent')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const postingFormRef = useRef(null)
  const topicInputRef = useRef(null)

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

  useEffect(() => {
    if (!postingFormOpen) return
    postingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    topicInputRef.current?.focus({ preventScroll: true })
  }, [postingFormOpen])

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
  const selectedCourseTitle = selectedEnrollment?.course_detail?.title || 'Course discussions'
  const [courseShortTitle, ...courseSubtitleParts] = selectedCourseTitle.split(':')
  const courseSubtitle = courseSubtitleParts.join(':').trim()
  const visibleThreads = threads
    .filter((thread) => !courseId || String(thread.course) === String(courseId))
    .slice()
    .sort((left, right) => {
      if (threadOrder === 'popular') {
        const replyDifference = (right.replies?.length || 0) - (left.replies?.length || 0)
        if (replyDifference) return replyDifference
      }
      return new Date(right.updated_at) - new Date(left.updated_at)
    })
  const replyCount = visibleThreads.reduce((total, thread) => total + (thread.replies?.length || 0), 0)

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
        <div className="space-y-5">
          <section className="dg-card overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="bg-linear-to-r from-blue-50 via-white to-indigo-50 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800">
                    <BookOpen size={22} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Learn together</p>
                    <h2 className="mt-1 truncate text-xl font-bold text-slate-900" title={selectedCourseTitle}>
                      {courseSubtitle ? courseShortTitle.trim() : selectedCourseTitle}
                    </h2>
                    {courseSubtitle && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{courseSubtitle}</p>}
                    <p className="mt-2 text-sm text-slate-600">Ask questions, share what you’ve learned, and help fellow learners.</p>
                  </div>
                </div>
              {enrollments.length > 1 && (
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Choose course
                  <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="min-w-52 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
                    {enrollments.map((enrollment) => <option key={enrollment.id} value={enrollment.course}>{enrollment.course_detail?.title || `Course ${enrollment.course}`}</option>)}
                  </select>
                </label>
              )}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-blue-100 pt-4 text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
                  <MessageSquareText size={16} className="text-blue-700" aria-hidden="true" />
                  {visibleThreads.length} {visibleThreads.length === 1 ? 'discussion' : 'discussions'}
                </span>
                <span className="inline-flex items-center gap-2 text-slate-600">
                  <MessageCircle size={16} className="text-blue-700" aria-hidden="true" />
                  {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </span>
                <button
                  type="button"
                  onClick={() => setPostingFormOpen((open) => !open)}
                  aria-expanded={postingFormOpen}
                  aria-controls="community-post-form"
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 lms-focus-ring"
                >
                  <Send size={15} aria-hidden="true" />
                  Start a discussion
                  <ChevronDown size={15} className={`transition-transform ${postingFormOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            {visibleThreads.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-7">
                <h3 className="font-semibold text-slate-900">Course conversations</h3>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Sort discussions">
                  <button
                    type="button"
                    onClick={() => setThreadOrder('recent')}
                    aria-pressed={threadOrder === 'recent'}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${threadOrder === 'recent' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    onClick={() => setThreadOrder('popular')}
                    aria-pressed={threadOrder === 'popular'}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${threadOrder === 'popular' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Most discussed
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-4 p-4 sm:p-6">
              {!visibleThreads.length ? (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-5 py-8 text-center">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">
                    <MessageSquareText size={21} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900">Start the first conversation</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Have a question, useful tip, or a win to share? Your course community starts with one post.</p>
                  <button
                    type="button"
                    onClick={() => setPostingFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 lms-focus-ring"
                  >
                    <Send size={15} aria-hidden="true" /> Start a discussion
                  </button>
                </div>
              ) : visibleThreads.map((thread) => (
                <article key={thread.id} className="dg-card rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-blue-50 p-2 text-blue-700"><MessageSquareText size={18} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{thread.title}</h3>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <MessageCircle size={13} aria-hidden="true" />
                          {(thread.replies || []).length} {(thread.replies || []).length === 1 ? 'reply' : 'replies'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {thread.author_name} · <time dateTime={thread.updated_at}>{new Date(thread.updated_at).toLocaleDateString()}</time>
                      </p>
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
            </div>
          </section>

          {postingFormOpen && (
            <form ref={postingFormRef} id="community-post-form" onSubmit={createThread} className="dg-card scroll-mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
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
                <input ref={topicInputRef} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} placeholder="What would you like to discuss?" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Message
                <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={10000} rows={5} placeholder="Share your question or tip…" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              </label>
              <button type="submit" disabled={posting || !courseId} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
                {posting ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />} Post discussion
              </button>
            </form>
          )}
        </div>
      )}
    </StudentPage>
  )
}
