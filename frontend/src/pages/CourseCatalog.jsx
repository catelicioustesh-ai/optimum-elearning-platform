import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, BookOpen, ClipboardList, GraduationCap, Search, ArrowUpRight, X } from 'lucide-react'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingCourseId, setUpdatingCourseId] = useState(null)
  const [learningModes, setLearningModes] = useState({})
  const searchTerm = searchParams.get('search') || ''
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

  const enrolledCourseIds = new Set(enrollments.map((enrollment) => String(enrollment.course)))
  const filteredCourses = courses.filter((course) => (
    `${course.title} ${course.description || ''} ${course.instructor_name || ''}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  ))
  const myCourses = filteredCourses.filter((course) => enrolledCourseIds.has(String(course.id)))
  const availableCourses = filteredCourses.filter((course) => !enrolledCourseIds.has(String(course.id)))
  const visibleCourses = showAllCourses ? availableCourses : availableCourses.slice(0, 6)

  async function handleEnroll(courseId, learningMode) {
    setUpdatingCourseId(courseId)
    setError('')
    try {
      const enrollment = await api.post('/enrollments/', {
        course: courseId,
        learning_mode: learningMode,
      })
      setEnrollments((current) => [...current, enrollment])
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingCourseId(null)
    }
  }

  async function handleUnenroll(course) {
    if (!window.confirm(`Unenroll from "${course.title}"? Your submitted work and grades will be kept if you enroll again later.`)) {
      return
    }

    const enrollment = enrollments.find((item) => String(item.course) === String(course.id))
    if (!enrollment) return

    setUpdatingCourseId(course.id)
    setError('')
    try {
      await api.del(`/enrollments/${enrollment.id}/`)
      setEnrollments((current) => current.filter((item) => item.id !== enrollment.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingCourseId(null)
    }
  }

  function renderCourseCard(course) {
    const isEnrolled = enrolledCourseIds.has(String(course.id))
    const enrollment = enrollments.find((item) => String(item.course) === String(course.id))
    const coverImage = course.thumbnail_url || (course.thumbnail ? `http://localhost:8000/${course.thumbnail}` : null)
    const isUpdating = String(updatingCourseId) === String(course.id)

    return (
      <article key={course.id} className="dg-card group relative flex flex-col overflow-hidden rounded-3xl p-0">
        {isEnrolled && (
          <Link
            to={`/dashboard/student/courses/${course.id}`}
            aria-label={`Open ${course.title}`}
            className="absolute inset-0 z-0 rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
        )}
        <div className="pointer-events-none relative z-10 flex flex-1 flex-col">
          <div className="relative h-36 w-full overflow-hidden bg-slate-100">
            {coverImage ? (
              <img src={coverImage} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-100 to-blue-50 text-blue-700">
                <ClipboardList size={28} aria-hidden="true" />
              </div>
            )}
            {isEnrolled && (
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                  Enrolled
                </span>
                <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                  {enrollment?.learning_mode === 'instructor_led' ? 'Instructor-led' : 'Self-paced'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-900">{course.title}</h3>
              <span className="dg-pill shrink-0">{course.module_count} module{course.module_count === 1 ? '' : 's'}</span>
            </div>
            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{course.description || 'Course overview and learning materials.'}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              {course.instructor_name || 'Optimum LMS instructor'}
            </p>

            <div className="pointer-events-auto relative z-10 mt-4 flex flex-wrap gap-2">
              {isEnrolled ? (
                <>
                  <Link
                    to={`/dashboard/student/courses/${course.id}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <ArrowUpRight size={16} aria-hidden="true" /> Continue course
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleUnenroll(course)}
                    disabled={isUpdating}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                    aria-label={`Unenroll from ${course.title}`}
                  >
                    <X size={15} aria-hidden="true" /> {isUpdating ? 'Removing…' : 'Unenroll'}
                  </button>
                </>
              ) : (
                <>
                  <label className="sr-only" htmlFor={`learning-mode-${course.id}`}>Choose how to learn {course.title}</label>
                  <select
                    id={`learning-mode-${course.id}`}
                    value={learningModes[course.id] || 'self_paced'}
                    onChange={(event) => setLearningModes((current) => ({
                      ...current,
                      [course.id]: event.target.value,
                    }))}
                    className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    <option value="self_paced">Self-paced · Learn on your schedule</option>
                    <option value="instructor_led">Instructor-led · Live sessions and reminders</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleEnroll(course.id, learningModes[course.id] || 'self_paced')}
                    disabled={isUpdating}
                    className="dg-btn w-full bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {isUpdating ? 'Enrolling…' : 'Enroll'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    )
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
              const nextParams = new URLSearchParams(searchParams)
              if (event.target.value) nextParams.set('search', event.target.value)
              else nextParams.delete('search')
              setSearchParams(nextParams, { replace: true })
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
              {availableCourses.length > 6 && !showAllCourses ? ` · showing ${myCourses.length} enrolled and 6 available` : ''}
            </p>
            {filteredCourses.length === 0 ? (
              <div className="dg-card rounded-2xl p-6 text-sm text-slate-600">
                No courses match “{searchTerm}”. Try a broader title or topic.
              </div>
            ) : (
              <div className="space-y-8">
                {myCourses.length > 0 && (
                  <section aria-labelledby="my-courses-heading" className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 id="my-courses-heading" className="text-lg font-bold text-slate-900">My courses</h3>
                        <p className="mt-1 text-sm text-slate-600">Pick up where you left off.</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{myCourses.length} enrolled</span>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {myCourses.map(renderCourseCard)}
                    </div>
                  </section>
                )}
                {availableCourses.length > 0 && (
                  <section aria-labelledby="available-courses-heading" className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 id="available-courses-heading" className="text-lg font-bold text-slate-900">Explore courses</h3>
                        <p className="mt-1 text-sm text-slate-600">Discover another learning path.</p>
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleCourses.map(renderCourseCard)}
                    </div>
                  </section>
                )}
              </div>
            )}
            {availableCourses.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllCourses((value) => !value)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showAllCourses ? 'Show fewer courses' : `View all ${availableCourses.length} available courses`}
              </button>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
