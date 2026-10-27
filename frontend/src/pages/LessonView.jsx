import { lazy, Suspense, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, GraduationCap, FileText, Upload, ChevronLeft, ChevronRight, BookmarkCheck, BookmarkPlus,
  ExternalLink,
} from 'lucide-react'
import LessonVideo from '../components/LessonVideo.jsx'
import RichTextContent from '../components/RichTextContent.jsx'
import { ACCEPT, MAX_UPLOAD_MB, checkUpload } from '../lib/uploadRules.js'
import { wikipediaSearchUrl } from '../lib/wikipedia.js'
import DashboardLayout from '../components/DashboardLayout.jsx'
import LoadingState from '../components/LoadingState.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const CodeActivityEditor = lazy(() => import('../components/CodeActivityEditor.jsx'))

const navItems = [
  { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/student/courses', label: 'My Courses', icon: BookOpen },
  { to: '/dashboard/student/grades', label: 'Grades', icon: GraduationCap },
]

export default function LessonView() {
  const { lessonId } = useParams()
  const { auth } = useAuth()
  const [lesson, setLesson] = useState(null)
  const [course, setCourse] = useState(null)
  const [module, setModule] = useState(null)
  const [moduleLessons, setModuleLessons] = useState([])
  const [error, setError] = useState('')
  const [bookmarkState, setBookmarkState] = useState({ lessonId: null, saved: false, loading: false, error: '' })
  const bookmarkMatchesLesson = String(bookmarkState.lessonId) === String(lessonId)
  const bookmarkSaved = bookmarkMatchesLesson && bookmarkState.saved
  const bookmarkLoading = bookmarkMatchesLesson && bookmarkState.loading
  const bookmarkError = bookmarkMatchesLesson ? bookmarkState.error : ''

  async function fetchLessonContext(id) {
    const currentLesson = await api.get(`/lessons/${id}/`)
    const currentModule = await api.get(`/modules/${currentLesson.module}/`)
    const [courseDetail, lessons] = await Promise.all([
        api.get(`/courses/${currentModule.course}/`),
        api.get(`/lessons/?module=${currentModule.id}`),
    ])
    return { currentLesson, currentModule, courseDetail, lessons }
  }

  function applyLessonContext(context) {
    setLesson(context.currentLesson)
    setModule(context.currentModule)
    setCourse(context.courseDetail)
    setModuleLessons(context.lessons)
  }

  async function reload() {
    setError('')
    try {
      applyLessonContext(await fetchLessonContext(lessonId))
    } catch (err) {
      setError(err.message || 'Unable to load this lesson.')
    }
  }

  async function saveBookmark() {
    if (!lesson) return
    const targetLessonId = String(lesson.id)
    setBookmarkState({ lessonId: targetLessonId, saved: false, loading: true, error: '' })
    try {
      await api.post('/community/bookmarks/', { lesson: lesson.id })
      setBookmarkState({ lessonId: targetLessonId, saved: true, loading: false, error: '' })
    } catch (err) {
      setBookmarkState({
        lessonId: targetLessonId,
        saved: false,
        loading: false,
        error: err.message || 'This lesson could not be bookmarked.',
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchLessonContext(lessonId)
      .then((context) => {
        if (cancelled) return
        applyLessonContext(context)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load this lesson.')
      })
    return () => { cancelled = true }
  }, [lessonId])

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Student' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="mx-auto max-w-4xl space-y-6">
        {error && (
          <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>
        )}

        {lesson && (
          <>
            {course && module && (
              <div className="rounded-xl border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/dashboard/student/courses/${course.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900">
                    <ChevronLeft size={16} aria-hidden="true" /> {course.title}
                  </Link>
                  <span className="text-xs font-medium text-text-muted">Module {module.order}: {module.title}</span>
                </div>
                {moduleLessons.length > 0 && (
                  <nav className="mt-3 border-t border-line pt-3" aria-label="Lessons in this module">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Module lessons</p>
                    <ol className="flex gap-2 overflow-x-auto pb-1">
                      {moduleLessons.map((item, index) => {
                        const current = String(item.id) === String(lesson.id)
                        return (
                          <li key={item.id} className="shrink-0">
                            {current ? (
                              <span aria-current="step" className="inline-flex max-w-56 items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white">
                                <span>{index + 1}</span><span className="truncate">{item.title}</span>
                              </span>
                            ) : (
                              <Link to={`/dashboard/student/lessons/${item.id}`} className="inline-flex max-w-56 items-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-medium text-ink hover:border-blue-400 hover:bg-blue-50">
                                <span className="text-text-muted">{index + 1}</span><span className="truncate">{item.title}</span>
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  </nav>
                )}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-text-muted">Lesson {lesson.order}{moduleLessons.length ? ` of ${moduleLessons.length}` : ''}</p>
                  <h2 className="mt-1 text-2xl font-bold text-ink">{lesson.title}</h2>
                  {lesson.learning_objectives && (
                    <p className="mt-2 text-sm text-text-muted">{lesson.learning_objectives}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={saveBookmark}
                  disabled={bookmarkSaved || bookmarkLoading}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-70 ${bookmarkSaved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-50'}`}
                >
                  {bookmarkSaved ? <BookmarkCheck size={16} aria-hidden="true" /> : <BookmarkPlus size={16} aria-hidden="true" />}
                  {bookmarkLoading ? 'Saving…' : bookmarkSaved ? 'Saved' : 'Save lesson'}
                </button>
              </div>
              {bookmarkError && <p className="mt-2 text-sm text-rose-700" role="alert">{bookmarkError}</p>}
              <a
                href={wikipediaSearchUrl(lesson.title, module?.title, course?.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50"
              >
                Read this unit on Wikipedia <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>

            {lesson.video_url && (
              <div className="rounded-2xl border border-line bg-paper p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <LessonVideo lessonId={lesson.id} url={lesson.video_url} track />
              </div>
            )}

            {lesson.video_file_url && (
              <div className="rounded-2xl border border-line bg-paper p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <LessonVideo key={lesson.video_file_url} lessonId={lesson.id} url={lesson.video_file_url} uploadedVideo track />
              </div>
            )}

            {lesson.tutorial_content && (
              <div className="rounded-2xl border border-line bg-paper p-5">
                <h3 className="font-semibold text-ink">Tutorial</h3>
                <RichTextContent content={lesson.tutorial_content} className="mt-2 text-sm text-text-muted" />
              </div>
            )}

            {lesson.attachments?.length > 0 && (
              <div className="rounded-2xl border border-line bg-paper p-5">
                <h3 className="font-semibold text-ink">Resources</h3>
                <div className="mt-3 space-y-2">
                  {lesson.attachments.map((a) => (
                    a.external_url ? (
                      <a
                        key={a.id}
                        href={a.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm text-ink hover:border-text-dim"
                      >
                        <FileText size={16} className="text-coral" /> {a.title} <span className="text-xs text-text-muted">(external link)</span>
                      </a>
                    ) : (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => api.download(a.download_url.replace(/^\/api/, ''), a.file_name || a.title).catch((err) => window.alert(err.message))}
                        className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm text-ink hover:border-text-dim"
                      >
                        <FileText size={16} className="text-coral" /> {a.title}
                      </button>
                    )
                  ))}
                </div>
              </div>
            )}

            {lesson.activities?.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-ink">Activities</h3>
                {lesson.activities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} onSubmitted={reload} />
                ))}
              </div>
            )}

            {moduleLessons.length > 1 && (
              <nav className="flex items-center justify-between gap-3 border-t border-line pt-5" aria-label="Lesson navigation">
                {(() => {
                  const index = moduleLessons.findIndex((item) => String(item.id) === String(lesson.id))
                  const previous = index > 0 ? moduleLessons[index - 1] : null
                  const next = index >= 0 && index < moduleLessons.length - 1 ? moduleLessons[index + 1] : null
                  return (
                    <>
                      {previous ? (
                        <Link to={`/dashboard/student/lessons/${previous.id}`} className="inline-flex max-w-[48%] items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-panel">
                          <ChevronLeft size={16} aria-hidden="true" /><span className="truncate">{previous.title}</span>
                        </Link>
                      ) : <span />}
                      {next ? (
                        <Link to={`/dashboard/student/lessons/${next.id}`} className="inline-flex max-w-[48%] items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                          <span className="truncate">{next.title}</span><ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      ) : (
                        <Link to={`/dashboard/student/courses/${course.id}`} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                          Back to course <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      )}
                    </>
                  )
                })()}
              </nav>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

const ACTIVITY_LABELS = {
  exercise: 'Coding exercise',
  lab: 'Lab',
  quiz: 'Quiz',
  assignment: 'Assignment',
  questionnaire: 'Questionnaire',
}

function ActivityCard({ activity, onSubmitted }) {
  const completionLabels = {
    completed: { text: 'Completed', classes: 'bg-emerald-50 text-emerald-800' },
    overdue: { text: 'Not completed · deadline passed', classes: 'bg-rose-50 text-rose-800' },
    not_completed: { text: 'Not completed', classes: 'bg-slate-100 text-slate-700' },
  }
  const completion = completionLabels[activity.completion_status] || completionLabels.not_completed

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-panel px-2.5 py-1 text-xs font-semibold text-text-muted">
            {ACTIVITY_LABELS[activity.activity_type] || 'Activity'}
          </span>
          <h4 className="mt-1.5 font-medium text-ink">{activity.title}</h4>
          <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${completion.classes}`} role="status">
            {completion.text}
          </p>
          {activity.deadline && (
            <p className="mt-2 text-xs text-text-muted">
              Deadline: {new Date(activity.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        {activity.activity_type !== 'questionnaire' && (
          <span className="text-xs text-text-muted">
            {activity.max_attempts} attempt{activity.max_attempts === 1 ? '' : 's'} · {activity.max_score} pts
          </span>
        )}
      </div>
      {activity.instructions && <p className="mt-2 text-sm text-text-muted">{activity.instructions}</p>}

      <div className="mt-4">
        {(activity.activity_type === 'lab' || activity.activity_type === 'exercise') && (
          <Suspense fallback={<LoadingState label="Preparing code workspace…" compact />}>
            <CodeActivityEditor key={activity.id} activity={activity} onSubmitted={onSubmitted} />
          </Suspense>
        )}
        {activity.activity_type === 'assignment' && (
          <SubmissionForm key={activity.id} activity={activity} onSubmitted={onSubmitted} />
        )}
        {activity.activity_type === 'quiz' && activity.quiz_id && (
          <Link
            to={`/dashboard/student/quiz/${activity.quiz_id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dim"
          >
            {activity.is_final_assessment ? 'Take final assessment' : 'Take quiz'}
          </Link>
        )}
        {activity.activity_type === 'questionnaire' && (
          <QuestionnaireForm key={activity.id} activity={activity} onSubmitted={onSubmitted} />
        )}
      </div>
    </div>
  )
}

function QuestionnaireForm({ activity, onSubmitted }) {
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submittedAt, setSubmittedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get(`/questionnaires/${activity.id}/response/`)
      .then((response) => {
        if (cancelled) return
        setAnswers(response.answers || {})
        setSubmittedAt(response.submitted_at)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load your saved response.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [activity.id])

  function setChoice(index, choice, checked) {
    const key = String(index)
    setAnswers((value) => {
      const current = Array.isArray(value[key]) ? value[key] : []
      return {
        ...value,
        [key]: checked
          ? [...current, choice].filter((item, itemIndex, items) => items.indexOf(item) === itemIndex)
          : current.filter((item) => item !== choice),
      }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await api.post(`/questionnaires/${activity.id}/response/`, { answers })
      setAnswers(response.answers)
      setSubmittedAt(response.submitted_at)
      onSubmitted?.()
    } catch (err) {
      setError(err.message || 'Unable to save your response.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-text-muted" role="status">Loading questionnaire…</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {activity.questionnaire_questions.map((question, index) => {
        const key = String(index)
        return (
          <fieldset key={key} className="space-y-2 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-medium text-ink">
              {question.text}{question.required && <span aria-label="required"> *</span>}
            </legend>
            {question.question_type === 'text' ? (
              <textarea
                required={question.required}
                maxLength={5000}
                rows={3}
                value={typeof answers[key] === 'string' ? answers[key] : ''}
                onChange={(event) => setAnswers((value) => ({ ...value, [key]: event.target.value }))}
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink"
              />
            ) : question.question_type === 'single_choice' ? (
              question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name={`questionnaire-${activity.id}-${index}`}
                    required={question.required}
                    checked={answers[key] === optionIndex}
                    onChange={() => setAnswers((value) => ({ ...value, [key]: optionIndex }))}
                  />
                  {option}
                </label>
              ))
            ) : (
              question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={Array.isArray(answers[key]) && answers[key].includes(optionIndex)}
                    onChange={(event) => setChoice(index, optionIndex, event.target.checked)}
                  />
                  {option}
                </label>
              ))
            )}
          </fieldset>
        )
      })}
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
      {submittedAt && <p className="text-xs text-emerald-700" role="status">Response saved. You can update it before leaving this course.</p>}
      <button type="submit" disabled={busy} className="rounded-md bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? 'Saving…' : submittedAt ? 'Update response' : 'Submit response'}
      </button>
    </form>
  )
}

function restoreAssignmentDraft(key) {
  try {
    const saved = sessionStorage.getItem(key)
    const draft = saved ? JSON.parse(saved) : {}
    return {
      content: typeof draft.content === 'string' ? draft.content : '',
      githubUrl: typeof draft.githubUrl === 'string' ? draft.githubUrl : '',
      status: saved ? 'Draft restored from this tab.' : 'Autosave ready.',
    }
  } catch {
    return {
      content: '',
      githubUrl: '',
      status: 'Could not restore the saved draft. Your new changes will still be autosaved.',
    }
  }
}

function SubmissionForm({ activity, onSubmitted }) {
  const { auth } = useAuth()
  const draftKey = `optimum-lms:assignment-draft:${encodeURIComponent(auth?.email?.toLowerCase() || 'guest')}:${activity.id}`
  const [initialDraft] = useState(() => restoreAssignmentDraft(draftKey))
  const [content, setContent] = useState(initialDraft.content)
  const [githubUrl, setGithubUrl] = useState(initialDraft.githubUrl)
  const [draftStatus, setDraftStatus] = useState(initialDraft.status)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        if (content || githubUrl) sessionStorage.setItem(draftKey, JSON.stringify({ content, githubUrl }))
        else sessionStorage.removeItem(draftKey)
        setDraftStatus(content || githubUrl ? 'Draft saved on this device.' : 'No unsent draft saved.')
      } catch {
        setDraftStatus('Could not save your draft on this device. Keep this lesson open and copy your work as a backup.')
      }
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [content, draftKey, githubUrl])

  function pickFile(e) {
    const picked = e.target.files?.[0] || null
    const problem = checkUpload(picked)
    if (problem) {
      setFile(null)
      e.target.value = ''
      setIsError(true)
      setStatus(problem)
      return
    }
    setStatus('')
    setFile(picked)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setStatus('')
    setIsError(false)
    try {
      if (file) {
        const formData = new FormData()
        formData.append('activity', activity.id)
        formData.append('content', content)
        formData.append('github_url', githubUrl)
        formData.append('file', file)
        await api.upload('/submissions/', formData)
      } else {
        await api.post('/submissions/', { activity: activity.id, content, github_url: githubUrl })
      }
      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        setDraftStatus('Submitted successfully, but the saved draft could not be cleared from this tab.')
      }
      setStatus('Submitted successfully.')
      setIsError(false)
      setContent('')
      setGithubUrl('')
      setFile(null)
      onSubmitted?.()
    } catch (err) {
      setIsError(true)
      setStatus(err.status === 429 ? 'You are submitting too quickly. Please wait a moment.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setDraftStatus('Saving draft…') }}
        rows={4}
        placeholder="Write your answer or paste code…"
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
      />
      <p className="text-xs text-text-muted" role="status" aria-live="polite">{draftStatus}</p>
      <input
        value={githubUrl}
        onChange={(e) => { setGithubUrl(e.target.value); setDraftStatus('Saving draft…') }}
        placeholder="GitHub repo URL — optional"
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-text-dim"
      />
      <input
        type="file"
        accept={ACCEPT}
        onChange={pickFile}
        className="w-full text-sm text-text-muted"
      />
      <p className="text-xs text-text-dim">Files: PDF, ZIP, DOCX, images or source files, up to {MAX_UPLOAD_MB} MB.</p>
      <button
        disabled={busy || (!content && !githubUrl && !file)}
        className="flex items-center gap-1.5 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dim disabled:opacity-60"
      >
        <Upload size={16} /> {busy ? 'Submitting…' : 'Submit'}
      </button>
      {status && <p role={isError ? 'alert' : 'status'} className={`text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`}>{status}</p>}
    </form>
  )
}
