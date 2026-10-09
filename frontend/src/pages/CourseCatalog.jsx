import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { LayoutDashboard, BookOpen, ClipboardList, GraduationCap, Check, Search } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const navItems = [
  { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/student/courses', label: 'My Courses', icon: BookOpen },
  { to: '/dashboard/student/grades', label: 'Grades', icon: GraduationCap },
]

export default function CourseCatalog() {
  const { auth } = useAuth()
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrollingId, setEnrollingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllCourses, setShowAllCourses] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/courses/'), api.get('/enrollments/')])
      .then(([courseList, myEnrollments]) => {
        setCourses(courseList)
        setEnrollments(myEnrollments)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course))
  const filteredCourses = courses.filter((course) => (
    `${course.title} ${course.description || ''} ${course.instructor_name || ''}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  ))
  const visibleCourses = showAllCourses ? filteredCourses : filteredCourses.slice(0, 6)

  async function handleEnroll(courseId) {
    setEnrollingId(courseId)
    setError('')
    try {
      const enrollment = await api.post('/enrollments/', { course: courseId })
      setEnrollments([...enrollments, enrollment])
    } catch (err) {
      setError(err.message)
    } finally {
      setEnrollingId(null)
    }
  }

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Student' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59, 130, 246,0.17),transparent_35%),white] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Catalog</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Explore your learning paths</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Find a course by title, topic, or instructor. Your enrolled courses are ready to continue.</p>
        </div>

        <label className="relative block max-w-xl">
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search courses</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setShowAllCourses(false)
            }}
            placeholder="Search courses, topics, or instructors"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-500"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>
        )}

        {loading ? (
          <div className="dg-card rounded-3xl p-6 text-sm text-slate-500">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="dg-card rounded-3xl p-6 text-sm text-slate-500">
            No courses have been created yet. Ask an instructor to add one.
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600" role="status" aria-live="polite">
              {filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'} found
              {filteredCourses.length > 6 && !showAllCourses ? ` · showing 6` : ''}
            </p>
            {filteredCourses.length === 0 ? (
              <div className="dg-card rounded-2xl p-6 text-sm text-slate-600">
                No courses match “{searchTerm}”. Try a broader title or topic.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCourses.map((course) => {
              const isEnrolled = enrolledCourseIds.has(course.id)
              const coverImage = course.thumbnail_url || (course.thumbnail ? `http://localhost:8000/${course.thumbnail}` : null)

              return (
                <div key={course.id} className="dg-card group flex flex-col overflow-hidden rounded-3xl p-0">
                  <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                    {coverImage ? (
                      <img src={coverImage} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-100 to-blue-50 text-blue-700">
                        <ClipboardList size={28} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{course.title}</h3>
                      <span className="dg-pill">{course.module_count} module{course.module_count === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">{course.description}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                      {course.instructor_name}
                    </p>

                    {isEnrolled ? (
                      <Link
                        to={`/dashboard/student/courses/${course.id}`}
                        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Check size={16} /> Enrolled — continue
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrollingId === course.id}
                        className="dg-btn mt-4 w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
                      >
                        {enrollingId === course.id ? 'Enrolling…' : 'Enroll'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
              </div>
            )}
            {filteredCourses.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllCourses((value) => !value)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showAllCourses ? 'Show fewer courses' : `View all ${filteredCourses.length} courses`}
              </button>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
