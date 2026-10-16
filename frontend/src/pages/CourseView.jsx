import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, BookOpen, GraduationCap, Lock, CircleCheckBig, Circle, ChevronRight, CalendarDays, ExternalLink } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout.jsx'
import ExpandableList from '../components/ExpandableList.jsx'
import { api, mediaUrl } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const navItems = [
  { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/student/courses', label: 'My Courses', icon: BookOpen },
  { to: '/dashboard/student/grades', label: 'Grades', icon: GraduationCap },
]

const STATUS_STYLE = {
  done: { icon: CircleCheckBig, color: 'text-mint', label: 'Completed' },
  active: { icon: Circle, color: 'text-coral', label: 'In progress' },
  locked: { icon: Lock, color: 'text-text-dim', label: 'Locked' },
}

export default function CourseView() {
  const { courseId } = useParams()
  const [searchParams] = useSearchParams()
  const requestedModuleId = searchParams.get('module')
  const { auth } = useAuth()

  const [course, setCourse] = useState(null)
  const [progress, setProgress] = useState([])
  const [loadedCourseId, setLoadedCourseId] = useState(null)
  const [expandedModuleId, setExpandedModuleId] = useState(null)
  const [lessonsByModule, setLessonsByModule] = useState({})
  const [enrollment, setEnrollment] = useState(null)
  const [liveSessions, setLiveSessions] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const courseCoverImage = mediaUrl(course?.thumbnail_url || course?.thumbnail)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get(`/courses/${courseId}/`),
      api.get(`/progress/course/${courseId}/`),
      api.get(`/enrollments/?course=${courseId}`),
      api.get(`/live-sessions/?course=${courseId}`),
    ])
      .then(([courseData, progressData, enrollments, sessions]) => {
        if (cancelled) return
        setCourse(courseData)
        setProgress(progressData)
        setLoadedCourseId(String(courseId))
        setExpandedModuleId(null)
        setLessonsByModule({})
        setEnrollment(enrollments[0] || null)
        setLiveSessions(sessions)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [courseId])

  useEffect(() => {
    if (loadedCourseId !== String(courseId) || !requestedModuleId || !progress.length) return undefined
    const requestedModule = progress.find((module) => String(module.module_id) === requestedModuleId)
    if (!requestedModule || requestedModule.status === 'locked') return undefined

    const moduleId = requestedModule.module_id
    let cancelled = false
    let frame
    const lessonsRequest = lessonsByModule[moduleId]
      ? Promise.resolve(lessonsByModule[moduleId])
      : api.get(`/lessons/?module=${moduleId}`)
    lessonsRequest
      .then((lessons) => {
        if (cancelled) return
        if (!lessonsByModule[moduleId]) {
          setLessonsByModule((current) => ({ ...current, [moduleId]: lessons }))
        }
        setExpandedModuleId(moduleId)
        frame = window.requestAnimationFrame(() => {
          document.getElementById(`module-${moduleId}`)?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start',
          })
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [courseId, loadedCourseId, lessonsByModule, progress, requestedModuleId])

  async function toggleModule(moduleId, status) {
    if (status === 'locked') return
    if (expandedModuleId === moduleId) {
      setExpandedModuleId(null)
      return
    }
    setExpandedModuleId(moduleId)
    if (!lessonsByModule[moduleId]) {
      try {
        const lessons = await api.get(`/lessons/?module=${moduleId}`)
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons }))
      } catch (err) {
        setError(err.message)
      }
    }
  }

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Student' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="space-y-6">
        <div>
          <Link to="/dashboard/student/courses" className="text-sm text-coral hover:text-coral-dim">← Back to courses</Link>
          {courseCoverImage && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
              <img src={courseCoverImage} alt={course.title} className="h-48 w-full object-cover" />
            </div>
          )}
          <h2 className="mt-2 text-2xl font-bold text-ink">{course?.title || (loading ? 'Loading…' : '')}</h2>
          {course?.description && <p className="mt-1 text-sm text-text-muted">{course.description}</p>}
          {enrollment && (
            <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
              {enrollment.learning_mode === 'instructor_led' ? 'Instructor-led learning' : 'Self-paced learning'}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>
        )}

        {enrollment?.learning_mode === 'instructor_led' && (
          <section className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50 to-white p-5" aria-labelledby="live-sessions-heading">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-blue-100 p-2 text-blue-800">
                <CalendarDays size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="live-sessions-heading" className="font-semibold text-slate-900">Live sessions</h3>
                <p className="mt-1 text-sm text-slate-600">Your instructor’s upcoming sessions and join links.</p>
                {liveSessions.length ? (
                  <ul className="mt-4 space-y-3">
                    {liveSessions.map((session) => (
                      <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {new Date(session.starts_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                        <a
                          href={session.meeting_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                          Join session <ExternalLink size={15} aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600" role="status">No upcoming live sessions have been scheduled yet.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {progress.length ? (
          <ExpandableList items={progress} label="modules" listClassName="space-y-3">
            {(m) => {
            const style = STATUS_STYLE[m.status]
            const Icon = style.icon
            const isExpanded = expandedModuleId === m.module_id
            return (
              <div id={`module-${m.module_id}`} key={m.module_id} className="scroll-mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
                <button
                  type="button"
                  onClick={() => toggleModule(m.module_id, m.status)}
                  disabled={m.status === 'locked'}
                  aria-expanded={isExpanded}
                  aria-controls={`module-lessons-${m.module_id}`}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left ${
                    m.status === 'locked' ? 'cursor-not-allowed opacity-60' : 'hover:bg-panel'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={style.color} />
                    <div>
                      <p className="font-medium text-ink">Module {m.order}: {m.title}</p>
                      <p className={`text-xs ${style.color}`}>{style.label}</p>
                      {m.status === 'locked' && (
                        <p className="mt-1 text-xs text-text-muted">Complete the previous module to unlock this one.</p>
                      )}
                    </div>
                  </div>
                  {m.status !== 'locked' && (
                    <ChevronRight size={18} className={`text-text-dim transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {isExpanded && (
                  <div id={`module-lessons-${m.module_id}`} className="space-y-1 border-t border-line bg-panel/50 px-5 py-3">
                    {(lessonsByModule[m.module_id] || []).map((lesson) => (
                      <Link
                        key={lesson.id}
                        to={`/dashboard/student/lessons/${lesson.id}`}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink hover:bg-paper"
                      >
                        <span>{lesson.order}. {lesson.title}</span>
                        <ChevronRight size={14} className="text-text-dim" />
                      </Link>
                    ))}
                    {lessonsByModule[m.module_id]?.length === 0 && (
                      <p className="px-3 py-2 text-sm text-text-muted">No lessons in this module yet.</p>
                    )}
                  </div>
                )}
              </div>
            )
            }}
          </ExpandableList>
        ) : !loading && (
          <p className="text-sm text-text-muted" role="status">This course doesn't have any modules yet.</p>
        )}
      </div>
    </DashboardLayout>
  )
}
