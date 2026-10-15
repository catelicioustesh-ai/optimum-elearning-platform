import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Award, BookOpen, CalendarClock, CheckCircle2, Clock3, Download, Flame, LockKeyhole, RotateCw, Sparkles } from 'lucide-react'

import DashboardLayout from '../components/DashboardLayout.jsx'
import LearningPath from '../components/LearningPath.jsx'
import { fetchStudentDashboardData } from '../api/dashboardData.js'
import { useAuth } from '../context/useAuth.js'
import { api } from '../lib/api.js'

const navItems = [
  { to: '/dashboard/student', label: 'Dashboard', icon: BookOpen, end: true, group: 'Overview' },
  { to: '/dashboard/student/courses', label: 'My courses', icon: BookOpen, group: 'Learning' },
  { to: '/dashboard/student#learning-path', label: 'Learning path', icon: ArrowRight, anchor: 'learning-path', group: 'Learning', mobileVisible: false },
  { to: '/dashboard/student#deadlines', label: 'Upcoming deadlines', icon: CalendarClock, anchor: 'deadlines', group: 'Learning', mobileVisible: false },
  { to: '/dashboard/student/grades', label: 'Grades', icon: CheckCircle2, group: 'Learning' },
  { to: '/dashboard/student#achievements', label: 'Achievements', icon: Award, anchor: 'achievements', group: 'Achievements', mobileVisible: false },
  { to: '/dashboard/student#certificates', label: 'Certificates', icon: Award, anchor: 'certificates', group: 'Achievements', mobileVisible: false },
]

function displayName(student, auth) {
  const fullName = `${student?.first_name || ''} ${student?.last_name || ''}`.trim()
  return fullName || student?.username || auth?.email || 'Student'
}

function formatDeadline(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function StudentDashboard() {
  const [data, setData] = useState(null)
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [certificateError, setCertificateError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedSections, setExpandedSections] = useState({})
  const { auth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    fetchStudentDashboardData()
      .then((result) => {
        if (cancelled) return
        setData({ ...result, student: auth })
        setSelectedCourseId((current) => current || result.current_course?.course_id || null)
        setLoading(false)

        api.get('/engagement/me/')
          .then((engagement) => {
            if (!cancelled) {
              setData((current) => current ? { ...current, engagement, engagementError: '' } : current)
            }
          })
          .catch((engagementError) => {
            if (!cancelled) {
              setData((current) => current ? {
                ...current,
                engagement: null,
                engagementError: engagementError.message || 'Unable to load achievements.',
              } : current)
            }
          })
      })
      .catch((err) => {
        if (cancelled) return
        setData(null)
        setError(err.message || 'Unable to load learning progress.')
      })

    return () => { cancelled = true }
  }, [reloadKey, auth])

  const courses = data?.enrolled_courses || []
  const course = courses.find((item) => item.course_id === selectedCourseId) || data?.current_course || null
  const modules = course?.modules || []
  const completedModules = modules.filter((module) => module.status === 'done').length
  const engagement = data?.engagement
  const achievements = engagement?.achievements || []
  const earnedAchievements = achievements.filter((item) => item.earned_at)
  const issuedCertificates = engagement?.certificates?.filter((item) => item.status === 'issued') || []
  const otherCertificates = engagement?.certificates?.filter(
    (certificate) => !courses.some((item) => String(item.course_id) === String(certificate.course_id)),
  ) || []
  const coursesInProgress = courses.filter((item) => !item.completed).length
  const completionRate = courses.length
    ? Math.round(courses.reduce((total, item) => total + item.progress_percent, 0) / courses.length)
    : 0
  const nextAchievement = achievements
    .filter((item) => !item.earned_at)
    .sort((left, right) => right.progress_percent - left.progress_percent)[0] || null
  const dashboardNavItems = navItems.filter((item) => {
    if (!item.anchor) return true
    if (!course) return false
    return !['achievements', 'certificates'].includes(item.anchor) || Boolean(engagement)
  })
  const achievementUnits = {
    activities: 'activities',
    courses: 'courses',
    streak_days: 'days',
  }

  function sectionItems(section, items) {
    return expandedSections[section] ? items : items.slice(0, 5)
  }

  function sectionToggle(section, items, label) {
    if (items.length <= 5) return null
    const expanded = Boolean(expandedSections[section])
    return (
      <button
        type="button"
        onClick={() => setExpandedSections((current) => ({ ...current, [section]: !current[section] }))}
        className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 lms-focus-ring"
      >
        {expanded ? 'Show fewer' : `View all ${items.length} ${label}`}
      </button>
    )
  }

  function retryLoad() {
    setError('')
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  function resumeLearning() {
    if (!course) return
    if (course.current_lesson_id) {
      navigate(`/dashboard/student/lessons/${course.current_lesson_id}`)
    } else {
      navigate(`/dashboard/student/courses/${course.course_id}`)
    }
  }

  async function downloadCertificate(certificate) {
    setCertificateError('')
    try {
      await api.download(
        `/engagement/certificates/${certificate.certificate_number}/download/`,
        `certificate-${certificate.certificate_number}.pdf`,
      )
    } catch (err) {
      setCertificateError(err.message || 'Unable to download this certificate.')
    }
  }

  return (
    <DashboardLayout
      navItems={dashboardNavItems}
      user={{ name: displayName(data?.student, auth) }}
      weeklyGoal={course?.progress_percent || 0}
      studentHighlights={engagement ? { currentStreak: engagement.current_streak, nextAchievement } : null}
      studentProfile={data?.student}
      fetchStudentProfile={false}
      role="student"
    >
      <Helmet>
        <title>Student Dashboard — Optimum LMS</title>
      </Helmet>

      <div className="student-dashboard space-y-6" data-role="student">
        <header className="student-dashboard-heading flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="student-dashboard-eyebrow text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Learning overview</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Your learning</h1>
            <p className="mt-1.5 text-sm text-slate-600">A clear view of your courses, progress, and what to do next.</p>
          </div>
          {courses.length > 1 && (
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Current course
              <select
                value={course?.course_id || ''}
                onChange={(event) => setSelectedCourseId(Number(event.target.value))}
                className="min-w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 lms-focus-ring"
              >
                {courses.map((item) => (
                  <option key={item.course_id} value={item.course_id}>{item.course_title}</option>
                ))}
              </select>
            </label>
          )}
        </header>

        {loading && (
          <div className="dg-card h-56 animate-pulse rounded-2xl" role="status" aria-label="Loading learning progress" />
        )}

        {!loading && error && (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
            <h2 className="font-semibold text-rose-900">Unable to load learning progress</h2>
            <p className="mt-1 text-sm text-rose-800">{error}</p>
            <button
              type="button"
              onClick={retryLoad}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-800 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-900 lms-focus-ring"
            >
              <RotateCw size={15} aria-hidden="true" /> Retry
            </button>
          </section>
        )}

        {!loading && !error && data?.engagementError && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            <p className="font-semibold">Achievements are temporarily unavailable.</p>
            <p className="mt-1">{data.engagementError} Your course progress is still available.</p>
            <button type="button" onClick={retryLoad} className="mt-2 font-semibold underline underline-offset-2">
              Retry dashboard
            </button>
          </section>
        )}

        {!loading && !error && !course && (
          <section className="dg-card rounded-2xl p-6 sm:p-8">
            <div className="flex max-w-xl flex-col items-start gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-blue-800">
                <BookOpen size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">No learning path yet</h2>
                <p className="mt-1 text-sm text-slate-600">You have not enrolled in a learning path yet.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/student/courses')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 lms-focus-ring"
              >
                Browse Courses <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {!loading && !error && course && (
          <>
            <section className="dg-hero student-learning-hero flex flex-col gap-6 rounded-2xl p-6 text-white md:flex-row md:items-center md:justify-between sm:p-8">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-100">
                  {greetingForHour(new Date().getHours())}, {displayName(data?.student, auth)} <span aria-hidden="true">👋</span>
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">{course.course_title}</h2>
                {course.current_module ? (
                  <p className="mt-2 text-sm text-blue-100">
                    Current module: <span className="font-semibold text-white">{course.current_module}</span>
                    {course.current_lesson_title ? ` · ${course.current_lesson_title}` : ''}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-blue-100">All available modules are complete.</p>
                )}
                <button
                  type="button"
                  onClick={resumeLearning}
                  className="dg-resume-button mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-blue-900 hover:bg-blue-50 lms-focus-ring"
                >
                  {course.current_lesson_id ? 'Resume learning' : 'View course'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="student-hero-summary w-full shrink-0 md:max-w-72">
                <div aria-label={`${course.progress_percent}% of modules complete`}>
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-100">
                    <span>Course progress</span>
                    <span>{course.progress_percent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-950/40">
                    <div className="dg-progress-fill h-full rounded-full bg-white" style={{ width: `${course.progress_percent}%` }} />
                  </div>
                  <p className="mt-2 text-right text-xs text-blue-100">{completedModules} of {modules.length} modules</p>
                </div>
                {engagement && (
                  <div className="student-next-reward mt-4" aria-label={`${engagement.xp_to_next_reward} XP to next reward`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-100">
                        <Sparkles size={14} aria-hidden="true" /> Next reward
                      </span>
                      <span className="text-xs font-bold text-white">{engagement.xp_to_next_reward} XP to go</span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"
                      role="progressbar"
                      aria-label="Progress toward next XP reward"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={engagement.reward_progress_percent}
                    >
                      <div className="h-full rounded-full bg-[#d99a73]" style={{ width: `${engagement.reward_progress_percent}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="student-dashboard-snapshot grid gap-3 sm:grid-cols-3" aria-label="Learning at a glance">
              <article className="dg-card student-stat student-stat-blue rounded-2xl border-l-4 border-l-blue-500 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Courses underway</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{coursesInProgress}</p>
                    <p className="mt-1 text-xs text-slate-500">{completionRate}% average completion</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
                    <BookOpen size={19} aria-hidden="true" />
                  </span>
                </div>
              </article>
              <article className="dg-card student-stat student-stat-terracotta rounded-2xl border-l-4 border-l-amber-500 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Learning streak</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{engagement ? `${engagement.current_streak} days` : '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">{engagement ? `Longest: ${engagement.longest_streak} days` : 'Keep showing up to build momentum'}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-700">
                    <Flame size={19} aria-hidden="true" />
                  </span>
                </div>
              </article>
              <article className="dg-card student-stat student-stat-sage rounded-2xl border-l-4 border-l-emerald-500 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Awaiting review</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{data.pending_labs}</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted work being reviewed</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Clock3 size={19} aria-hidden="true" />
                  </span>
                </div>
              </article>
            </section>

            <section id="learning-path" className="dg-card scroll-mt-6 rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Learning path</h2>
                  <p className="dg-sub mt-1">{course.course_title}</p>
                </div>
                <span className="text-xs text-slate-600">{modules.length} modules</span>
              </div>
              {modules.length ? (
                <LearningPath
                  modules={modules}
                  completedPct={course.progress_percent}
                  onSelectModule={(module) => {
                    if (module.status !== 'locked') navigate(`/dashboard/student/courses/${course.course_id}`)
                  }}
                />
              ) : (
                <p className="text-sm text-slate-600" role="status">Learning path unavailable. This course has no modules yet.</p>
              )}
            </section>

            {engagement && (
              <section className="dg-card rounded-2xl p-5 sm:p-6" aria-labelledby="engagement-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id="engagement-heading" className="text-base font-bold text-slate-900">Your progress & rewards</h2>
                    <p className="dg-sub mt-1">See how close you are to your next milestone</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  <div id="achievements" className="scroll-mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-900">Achievement system</h3>
                      <span className="text-xs font-semibold text-slate-600">
                        {earnedAchievements.length} / {engagement.achievements.length} earned
                      </span>
                    </div>
                    {nextAchievement && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Next milestone</p>
                            <p className="mt-1 font-bold text-slate-900">{nextAchievement.name}</p>
                            <p className="mt-1 text-xs text-slate-700">{nextAchievement.description}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-900">
                            {Math.max(0, nextAchievement.threshold - nextAchievement.progress)} {achievementUnits[nextAchievement.metric] || 'steps'} to go
                          </span>
                        </div>
                        <div
                          className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100"
                          role="progressbar"
                          aria-label={`${nextAchievement.name} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={nextAchievement.progress_percent}
                        >
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${nextAchievement.progress_percent}%` }} />
                        </div>
                        <button
                          type="button"
                          onClick={resumeLearning}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-900 underline underline-offset-2 lms-focus-ring"
                        >
                          Continue learning <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {engagement.achievements.length ? (
                      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                        {sectionItems('achievements', engagement.achievements).map((item) => {
                          const earned = Boolean(item.earned_at)
                          const unit = achievementUnits[item.metric] || 'steps'
                          return (
                            <li
                              key={item.code}
                              className={`achievement-card rounded-xl border p-4 ${
                                earned
                                  ? 'achievement-earned border-amber-300 bg-amber-50'
                                  : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                  earned ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'
                                }`}>
                                  {earned
                                    ? <Award size={18} aria-hidden="true" />
                                    : <LockKeyhole size={16} aria-hidden="true" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                      earned ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {earned ? 'Earned' : item.category}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                                    <span className="text-slate-700">
                                      {item.progress} / {item.threshold} {unit}
                                    </span>
                                    {earned && item.earned_at && (
                                      <span className="text-amber-800">
                                        {new Date(item.earned_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
                                    role="progressbar"
                                    aria-label={`${item.name} progress`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={item.progress_percent}
                                  >
                                    <div
                                      className={`dg-progress-fill h-full rounded-full ${
                                        earned ? 'bg-amber-500' : 'bg-blue-600'
                                      }`}
                                      style={{ width: `${item.progress_percent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600" role="status">
                        No achievements are available yet.
                      </p>
                    )}
                    {sectionToggle('achievements', engagement.achievements, 'achievements')}
                  </div>
                  <div id="certificates" className="scroll-mt-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">Certificate roadmap</h3>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {issuedCertificates.length} earned
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Track your enrolled courses toward completion and certificates.</p>
                    {courses.length ? (
                      <ul className="mt-3 grid gap-3">
                        {sectionItems('certificateRoadmap', courses).map((roadmapCourse) => {
                          const certificate = engagement.certificates.find(
                            (item) => String(item.course_id) === String(roadmapCourse.course_id),
                          )
                          const progress = certificate?.status === 'issued' ? 100 : roadmapCourse.progress_percent
                          const status = certificate?.status === 'issued'
                            ? `Certificate earned · ${new Date(certificate.issued_at).toLocaleDateString()}`
                            : certificate?.status === 'revoked'
                              ? 'Certificate revoked'
                              : roadmapCourse.completed
                                ? 'Course complete · certificate not issued yet'
                                : `${progress}% complete · ${Math.max(0, 100 - progress)}% to completion`

                          return (
                            <li key={roadmapCourse.course_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-900">{roadmapCourse.course_title}</p>
                                  <p className={`mt-1 text-xs font-medium ${certificate?.status === 'issued' ? 'text-emerald-700' : 'text-slate-600'}`}>
                                    {status}
                                  </p>
                                </div>
                                {certificate?.status === 'issued' ? (
                                  <button
                                    type="button"
                                    onClick={() => downloadCertificate(certificate)}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 lms-focus-ring"
                                  >
                                    <Download size={14} aria-hidden="true" /> Download
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/dashboard/student/courses/${roadmapCourse.course_id}`)}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50 lms-focus-ring"
                                  >
                                    {roadmapCourse.completed ? 'View course' : 'Continue'} <ArrowRight size={14} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                              <div
                                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
                                role="progressbar"
                                aria-label={`${roadmapCourse.course_title} certificate roadmap progress`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progress}
                              >
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                              </div>
                              {certificate?.status === 'revoked' && certificate.revocation_reason && (
                                <p className="mt-2 text-xs text-rose-700">{certificate.revocation_reason}</p>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                        <p className="text-sm font-semibold text-slate-900">Your roadmap starts with a course</p>
                        <p className="mt-1 text-xs text-slate-600">Enroll in a course to track your progress toward its certificate.</p>
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/student/courses')}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-800 underline underline-offset-2 lms-focus-ring"
                        >
                          Explore courses <ArrowRight size={13} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {sectionToggle('certificateRoadmap', courses, 'courses')}
                    {otherCertificates.length > 0 && (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Other certificates</h4>
                        <ul className="mt-2 space-y-2">
                          {otherCertificates.map((certificate) => (
                            <li key={certificate.certificate_number} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{certificate.course_title}</p>
                                <p className="mt-0.5 text-xs text-slate-600">
                                  {certificate.status === 'issued' ? 'Issued' : 'Revoked'} · {new Date(certificate.issued_at).toLocaleDateString()}
                                  {certificate.status === 'revoked' && certificate.revocation_reason ? ` · ${certificate.revocation_reason}` : ''}
                                </p>
                              </div>
                              {certificate.status === 'issued' && (
                                <button
                                  type="button"
                                  onClick={() => downloadCertificate(certificate)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 lms-focus-ring"
                                >
                                  <Download size={14} aria-hidden="true" /> Download
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {certificateError && <p className="mt-3 text-sm text-rose-700" role="alert">{certificateError}</p>}
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <section id="deadlines" className="dg-card scroll-mt-6 rounded-2xl border-t-4 border-t-amber-400 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Upcoming deadlines</h2>
                    <p className="dg-sub mt-1">Your next work to complete</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{data.upcoming_deadlines.length} due</span>
                </div>
                {data.upcoming_deadlines.length ? (
                  <ul className="mt-4 divide-y divide-slate-700">
                    {sectionItems('deadlines', data.upcoming_deadlines).map((item) => (
                      <li key={item.activity_id} className="flex flex-wrap items-center justify-between gap-3 border-slate-200 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{item.course_title} · {item.activity_type}</p>
                          <p className="mt-1 text-xs font-semibold text-amber-800">Due {formatDeadline(item.deadline)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/student/courses/${item.course_id}`)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 lms-focus-ring"
                        >
                          Open course
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600" role="status">You’re all caught up — no upcoming deadlines.</p>
                )}
                {sectionToggle('deadlines', data.upcoming_deadlines, 'deadlines')}
              </section>

              <section className="dg-card rounded-2xl border-t-4 border-t-blue-500 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Recent results</h2>
                    <p className="dg-sub mt-1">Latest graded submissions</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/student/grades')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 lms-focus-ring"
                  >
                    All grades
                  </button>
                </div>
                {data.recent_grades.length ? (
                  <ul className="mt-4 divide-y divide-slate-700">
                    {sectionItems('recentGrades', data.recent_grades).map((result, index) => (
                      <li key={`${result.activity}-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-slate-200 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{result.activity}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {result.graded_at ? `Graded ${new Date(result.graded_at).toLocaleDateString()}` : 'Recently graded'}
                            {result.feedback ? ` · ${result.feedback}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800">
                          {result.grade}{result.max_score != null ? ` / ${result.max_score}` : ''} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600" role="status">Graded work will appear here after your instructor reviews it.</p>
                )}
                {sectionToggle('recentGrades', data.recent_grades, 'results')}
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
