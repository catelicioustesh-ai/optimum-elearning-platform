import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  BookOpen,
  Award,
  Users,
  Shield,
  X,
  LayoutDashboard,
  Bell,
  Settings,
  FileCheck,
} from 'lucide-react'
import { api } from '../lib/api.js'

const commandsByRole = {
  student: [
    { label: 'Student Dashboard', category: 'Navigation', icon: LayoutDashboard, path: '/dashboard/student' },
    { label: 'My Courses', category: 'Navigation', icon: BookOpen, path: '/dashboard/student/courses' },
    { label: 'Grades', category: 'Navigation', icon: Award, path: '/dashboard/student/grades' },
    { label: 'Achievements', category: 'Navigation', icon: Award, path: '/dashboard/student/achievements' },
    { label: 'Notifications', category: 'Navigation', icon: Bell, path: '/dashboard/student/notifications' },
    { label: 'Profile Settings', category: 'Navigation', icon: Settings, path: '/dashboard/student/settings' },
  ],
  instructor: [
    { label: 'Instructor Dashboard', category: 'Navigation', icon: LayoutDashboard, path: '/dashboard/instructor' },
    { label: 'Course Content', category: 'Navigation', icon: BookOpen, path: '/dashboard/instructor/content' },
    { label: 'Submissions', category: 'Navigation', icon: FileCheck, path: '/dashboard/instructor/submissions' },
    { label: 'Students', category: 'Navigation', icon: Users, path: '/dashboard/instructor/students' },
  ],
  admin: [
    { label: 'Admin Overview', category: 'Navigation', icon: Shield, path: '/dashboard/admin' },
    { label: 'Course Management', category: 'Navigation', icon: BookOpen, path: '/dashboard/instructor/content' },
    { label: 'Submissions', category: 'Navigation', icon: FileCheck, path: '/dashboard/instructor/submissions' },
    { label: 'Students', category: 'Navigation', icon: Users, path: '/dashboard/instructor/students' },
  ],
}

export default function CommandPalette({ open, onClose, role }) {
  const [query, setQuery] = useState('')
  const [courses, setCourses] = useState([])
  const [loadedForRole, setLoadedForRole] = useState(null)
  const [coursesError, setCoursesError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined

    let cancelled = false
    const coursesRequest = role === 'student'
      ? api.get('/courses/')
      : Promise.all([api.get('/courses/'), api.get('/dashboard/instructor/')])
        .then(([result, dashboard]) => {
          const manageableCourseIds = new Set((dashboard.my_courses || []).map((course) => String(course.id)))
          return result.filter((course) => manageableCourseIds.has(String(course.id)))
        })
    coursesRequest
      .then((result) => {
        if (!cancelled) {
          setCourses(Array.isArray(result) ? result : [])
          setCoursesError('')
          setLoadedForRole(role)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCoursesError(error.message || 'Course search is unavailable.')
          setLoadedForRole(role)
        }
      })
    return () => { cancelled = true }
  }, [open, role])

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        if (open) onClose()
        else window.dispatchEvent(new CustomEvent('open-command-palette'))
      }
      if (event.key === 'Escape' && open) {
        setQuery('')
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const normalizedQuery = query.trim().toLowerCase()
  const coursesLoading = open && loadedForRole !== role
  const commands = commandsByRole[role] || []
  const filteredCommands = commands.filter((item) => (
    !normalizedQuery
    || item.label.toLowerCase().includes(normalizedQuery)
    || item.category.toLowerCase().includes(normalizedQuery)
  ))
  const roleCourses = loadedForRole === role ? courses : []
  const filteredCourses = normalizedQuery
    ? roleCourses.filter((course) => (
      `${course.title || ''} ${course.description || ''} ${course.instructor_name || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    )).slice(0, 8)
    : []
  const results = [
    ...filteredCommands.map((item) => ({ ...item, action: () => navigate(item.path) })),
    ...filteredCourses.map((course) => ({
      label: course.title,
      category: 'Course',
      icon: BookOpen,
      action: () => {
        if (role === 'student') {
          navigate(`/dashboard/student/courses?search=${encodeURIComponent(course.title)}`)
        } else {
          navigate(`/dashboard/instructor/content?course=${encodeURIComponent(course.id)}`)
        }
      },
    })),
  ]

  return (
    <div
      className="dg-modal-backdrop dg-on"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setQuery('')
          onClose()
        }
      }}
    >
      <div className="dg-modal w-[92%]! max-w-xl! p-4!" role="dialog" aria-modal="true" aria-label="Search dashboard">
        <div className="relative flex items-center border-b border-slate-700/80 pb-3">
          <Search size={18} className="text-slate-400" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your pages and accessible courses..."
            aria-label="Search dashboard pages and courses"
            className="w-full bg-transparent pl-3 pr-8 text-sm text-white placeholder-slate-400 outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onClose()
            }}
            aria-label="Close search"
            className="rounded p-1 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {coursesLoading && <p className="py-2 text-center text-xs text-slate-400" role="status">Loading accessible courses...</p>}
          {loadedForRole === role && coursesError && <p className="py-2 text-xs text-rose-300" role="alert">{coursesError}</p>}
          {!coursesLoading && results.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {normalizedQuery ? `No results found for "${query}"` : 'No available pages.'}
            </div>
          ) : (
            results.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={`${item.category}:${item.label}`}
                  type="button"
                  onClick={() => {
                    item.action()
                    setQuery('')
                    onClose()
                  }}
                  className="dg-cmd"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-300">
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-left text-xs font-semibold text-slate-200">{item.label}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {item.category}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-700/80 pt-2.5 text-[11px] text-slate-400">
          <span>Only pages and courses available to your account are shown</span>
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px]">ESC to close</kbd>
        </div>
      </div>
    </div>
  )
}
