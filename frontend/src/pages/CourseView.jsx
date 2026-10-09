import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { LayoutDashboard, BookOpen, GraduationCap, Lock, CircleCheckBig, Circle, ChevronRight } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout.jsx'
import ExpandableList from '../components/ExpandableList.jsx'
import { api } from '../lib/api.js'
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
  const { auth } = useAuth()

  const [course, setCourse] = useState(null)
  const [progress, setProgress] = useState([])
  const [expandedModuleId, setExpandedModuleId] = useState(null)
  const [lessonsByModule, setLessonsByModule] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/courses/${courseId}/`),
      api.get(`/progress/course/${courseId}/`),
    ])
      .then(([courseData, progressData]) => {
        setCourse(courseData)
        setProgress(progressData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [courseId])

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
          {(course?.thumbnail_url || (course?.thumbnail ? `http://localhost:8000/${course.thumbnail}` : null)) && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
              <img src={course?.thumbnail_url || `http://localhost:8000/${course.thumbnail}`} alt={course.title} className="h-48 w-full object-cover" />
            </div>
          )}
          <h2 className="mt-2 text-2xl font-bold text-ink">{course?.title || (loading ? 'Loading…' : '')}</h2>
          {course?.description && <p className="mt-1 text-sm text-text-muted">{course.description}</p>}
        </div>

        {error && (
          <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>
        )}

        {progress.length ? (
          <ExpandableList items={progress} label="modules" listClassName="space-y-3">
            {(m) => {
            const style = STATUS_STYLE[m.status]
            const Icon = style.icon
            const isExpanded = expandedModuleId === m.module_id
            return (
              <div key={m.module_id} className="overflow-hidden rounded-2xl border border-line bg-paper">
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
