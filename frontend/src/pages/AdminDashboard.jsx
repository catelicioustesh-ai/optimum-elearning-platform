import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  Clock3,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  Users,
} from 'lucide-react'

import DashboardLayout from '../components/DashboardLayout.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'
import { djangoAdminUrl } from '../api/adminDashboard.js'
import { getAllocationPlan } from '../api/allocation.js'
import {
  Card, Donut, DonutLegend, Pill, Skeleton, ErrorState, EmptyState,
} from '../components/charts.jsx'
import { HeroTitle, CountUp } from '../components/fx.jsx'
import { useToast } from '../hooks/useToast.js'

const navItems = [
  { to: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/instructor', label: 'Courses & content', icon: BookOpen },
  { to: '/dashboard/instructor/students', label: 'Students', icon: Users },
]

const PRIORITY_TONE = { high: 'r', medium: 'y', low: 'default' }

export default function AdminDashboard() {
  const { auth } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [planError, setPlanError] = useState('')
  const [loading, setLoading] = useState(true)
  const [approvingLearnerId, setApprovingLearnerId] = useState(null)

  async function approveLearner(learner) {
    setApprovingLearnerId(learner.id)
    try {
      const approvedLearner = await api.post(`/dashboard/admin/learner-approvals/${learner.id}/approve/`, {})
      setData((current) => {
        if (!current) return current
        return {
          ...current,
          total_students: current.total_students + 1,
          pending_learner_approval_count: Math.max(0, current.pending_learner_approval_count - 1),
          pending_learner_approvals: current.pending_learner_approvals.filter((item) => item.id !== learner.id),
          registered_students: [...current.registered_students, approvedLearner],
        }
      })
      toast(`${learner.full_name || learner.username} is approved and can now sign in.`, 'success')
    } catch (err) {
      toast(err.message || 'The learner could not be approved. Please try again.', 'error')
    } finally {
      setApprovingLearnerId(null)
    }
  }

  function fetchAll() {
    api
      .get('/dashboard/admin/')
      .then(setData)
      .catch((err) => {
        setData(null)
        setError(err.message || 'Unable to load platform data.')
      })
      .finally(() => setLoading(false))

    getAllocationPlan()
      .then(setPlan)
      .catch((err) => {
        setPlan(null)
        setPlanError(err.message || 'Unable to load resource allocation data.')
      })
  }

  function load() {
    setLoading(true)
    setError('')
    setPlanError('')
    fetchAll()
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const quickActions = [
    { label: 'Students', subtitle: 'Monitor learners', href: '/dashboard/instructor/students', icon: Users },
    { label: 'Manage courses', subtitle: 'Create, edit, and publish', href: '/dashboard/instructor/content', icon: BookOpen },
    { label: 'Submissions', subtitle: 'Review queue', href: '/dashboard/instructor/submissions', icon: Briefcase },
  ]

  const enrollmentCoverage = useMemo(() => {
    if (!data || !data.total_students) return null
    return Math.min(100, Math.round((data.active_enrollments / data.total_students) * 100))
  }, [data])

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Admin' }} weeklyGoal={enrollmentCoverage ?? 0} role="admin">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-6" data-role="admin">
        {loading && <Skeleton height={220} />}
        {error && <ErrorState message={`Couldn't load platform data: ${error}`} onRetry={load} />}

        {data && (
          <>
            <div className="dg-hero">
              <i className="dg-orb dg-o1" />
              <i className="dg-orb dg-o2" />
              <div className="dg-grow">
                <div className="dg-day">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                <HeroTitle text="Platform overview" />
                <p>
                  {data.active_enrollments} active enrollment{data.active_enrollments === 1 ? '' : 's'} across {data.total_courses} course{data.total_courses === 1 ? '' : 's'},
                  taught by {data.total_instructors} instructor{data.total_instructors === 1 ? '' : 's'}.
                </p>
                <div className="dg-bt">
                  <button type="button" className="dg-btn" onClick={() => document.getElementById('allocation')?.scrollIntoView({ behavior: 'smooth' })}>
                    View resource allocation
                  </button>
                  <a className="dg-btn dg-ghost" href={djangoAdminUrl()} target="_blank" rel="noreferrer">
                    Open Django admin <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>

            <div className="dg-grid">
              {quickActions.map(({ label, subtitle, href, icon: Icon }) => (
                <button key={label} type="button" onClick={() => navigate(href)} className="dg-card dg-c4" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer' }}>
                  <span className="dg-ic" style={{ float: 'none' }}><Icon size={18} /></span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: 'block' }}>{label}</strong>
                    <small style={{ color: 'var(--mut)' }}>{subtitle}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>

            <div className="dg-grid">
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><Users /></span>
                <div className="dg-l">Total students</div>
                <div className="dg-v"><CountUp value={data.total_students} /></div>
                <div className="dg-d">&nbsp;</div>
              </div>
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><Briefcase /></span>
                <div className="dg-l">Instructors</div>
                <div className="dg-v"><CountUp value={data.total_instructors} /></div>
                <div className="dg-d">&nbsp;</div>
              </div>
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><BookOpen /></span>
                <div className="dg-l">Courses</div>
                <div className="dg-v"><CountUp value={data.total_courses} /></div>
                <div className="dg-d">&nbsp;</div>
              </div>
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><Activity /></span>
                <div className="dg-l">Pending submissions</div>
                <div className={`dg-v`}><CountUp value={data.pending_submissions} /></div>
                <div className={`dg-d${data.pending_submissions > 0 ? ' dg-w' : ''}`}>Platform-wide</div>
              </div>
            </div>

            <div className="dg-grid">
              <Card span={4}>
                <h3>Students vs instructors</h3>
                <div className="dg-sub">{data.total_students + data.total_instructors} accounts</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Donut slices={[
                    { label: 'Students', value: data.total_students, color: 'var(--acc)' },
                    { label: 'Instructors', value: data.total_instructors, color: 'var(--h2)' },
                  ]} />
                </div>
                <DonutLegend slices={[
                  { label: 'Students', value: data.total_students, color: 'var(--acc)' },
                  { label: 'Instructors', value: data.total_instructors, color: 'var(--h2)' },
                ]} />
              </Card>

              <Card span={8}>
                <h3>Enrollment coverage</h3>
                <div className="dg-sub">Active enrollments relative to total students</div>
                {enrollmentCoverage == null ? (
                  <EmptyState message="No students yet." />
                ) : (
                  <>
                    <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em' }}>{enrollmentCoverage}%</div>
                    <div style={{ marginTop: 8 }}><div className="dg-bar" style={{ height: 12 }}><i style={{ width: `${enrollmentCoverage}%` }} /></div></div>
                    <p className="dg-sub" style={{ marginTop: 10 }}>
                      {data.active_enrollments} enrollment{data.active_enrollments === 1 ? '' : 's'} across {data.total_students} student{data.total_students === 1 ? '' : 's'} — students can enroll in more than one course, so this can exceed 100%.
                    </p>
                  </>
                )}
              </Card>
            </div>

            <div className="dg-card dg-c12">
              <div className="dg-ch">
                <div>
                  <h3>Registered students</h3>
                  <div className="dg-sub">Approved learners on the platform, including those who are not enrolled yet.</div>
                </div>
                <Users size={18} style={{ color: 'var(--acc)' }} />
              </div>

              <div className="mt-4 space-y-3">
                {(data.registered_students || []).map((student) => (
                  <div key={student.id} className="flex flex-col gap-2 rounded-xl border border-line bg-panel px-3 py-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-ink">{student.full_name || student.username}</div>
                      <div className="text-xs text-text-dim">{student.email}</div>
                    </div>
                    <div className="text-xs text-text-muted">
                      {student.enrolled_courses.length > 0
                        ? student.enrolled_courses.map((course) => course.title).join(' · ')
                        : 'Not enrolled yet'}
                    </div>
                  </div>
                ))}
                {(data.registered_students || []).length === 0 && <EmptyState message="No registered students yet." />}
              </div>
            </div>

            <div className="dg-card dg-c12">
              <div className="dg-ch">
                <div>
                  <h3>Pending learner approvals</h3>
                  <div className="dg-sub">Review new learner registrations before granting platform access.</div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  <Clock3 size={14} aria-hidden="true" />
                  {data.pending_learner_approval_count || 0} pending
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {(data.pending_learner_approvals || []).map((learner) => (
                  <div key={learner.id} className="flex flex-col gap-3 rounded-xl border border-line bg-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{learner.full_name || learner.username}</div>
                      <div className="mt-0.5 text-sm text-text-muted">{learner.email}</div>
                      <div className="mt-1 text-xs text-text-dim">
                        {learner.email_verified ? 'Email verified' : 'Email verification pending'}
                        {' · '}
                        Registered {new Date(learner.date_joined).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => approveLearner(learner)}
                      disabled={approvingLearnerId !== null || !learner.email_verified}
                      title={!learner.email_verified ? 'The learner must verify their email before approval.' : undefined}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approvingLearnerId === learner.id
                        ? <span className="login-spinner" aria-hidden="true" />
                        : <Check size={16} aria-hidden="true" />}
                      {approvingLearnerId === learner.id
                        ? 'Approving…'
                        : learner.email_verified ? 'Approve learner' : 'Awaiting verification'}
                    </button>
                  </div>
                ))}
                {(data.pending_learner_approvals || []).length === 0 && (
                  <EmptyState message="There are no learner registrations waiting for approval." />
                )}
              </div>
            </div>

            {/* Course & Resource Allocation Optimization */}
            <div id="allocation" className="dg-card dg-c12">
              <div className="dg-ch">
                <div>
                  <h3>Resource allocation</h3>
                  <div className="dg-sub">Instructor load balance and course capacity — a weighted scoring model, not a guess. See the reason on every recommendation.</div>
                </div>
                <Gauge size={18} style={{ color: 'var(--acc)' }} />
              </div>

              {planError && <ErrorState message={planError} onRetry={load} />}
              {!planError && !plan && <Skeleton height={200} />}

              {plan && (
                <>
                  <div className="dg-grid" style={{ marginTop: 4 }}>
                    <div className="dg-c5">
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 10px', color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Instructor load</h4>
                      {plan.instructor_loads.length === 0 && <EmptyState message="No instructors yet." />}
                      {plan.instructor_loads.map((i) => (
                        <div key={i.instructor_id} className="dg-row">
                          <div className="dg-g">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <b>{i.instructor_name}</b>
                              <span>{i.load} {plan.average_instructor_load ? `(avg ${plan.average_instructor_load})` : ''}</span>
                            </div>
                            <small>{i.courses.join(', ')} · {i.total_enrolled} students · {i.total_pending} pending grades</small>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="dg-c7">
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 10px', color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Recommendations</h4>
                      {plan.recommendations.length === 0 && <EmptyState message="Load is balanced — no changes recommended right now." />}
                      {plan.recommendations.map((r, i) => (
                        <div key={i} className="dg-row" style={{ alignItems: 'flex-start' }}>
                          <div className="dg-g">
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Pill tone={PRIORITY_TONE[r.priority]}>{r.priority} priority</Pill>
                              <span className="dg-sub" style={{ margin: 0, textTransform: 'capitalize' }}>{r.type.replace(/_/g, ' ')}</span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: 13 }}>{r.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
