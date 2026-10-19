import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  TriangleAlert,
  BookOpen,
  FileCheck,
  LayoutDashboard,
  Award,
  ShieldAlert,
  Users,
} from 'lucide-react'

import DashboardLayout from '../components/DashboardLayout.jsx'
import GradeModal from '../components/GradeModal.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'
import { useToast } from '../hooks/useToast.js'
import { getCohortRisk } from '../api/risk.js'
import {
  Card, Donut, DonutLegend, Avatar, Pill, Skeleton, ErrorState, EmptyState,
} from '../components/charts.jsx'
import { HeroTitle, CountUp } from '../components/fx.jsx'

const navItems = [
  { to: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/instructor/content', label: 'Course Content', icon: BookOpen },
  { to: '/dashboard/instructor/submissions', label: 'Submissions', icon: FileCheck },
  { to: '/dashboard/instructor/students', label: 'Students', icon: Users },
]

const RISK_TONE = { high: 'r', medium: 'y', low: 'g' }

export default function InstructorDashboard() {
  const navigate = useNavigate()
  const { auth } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [risk, setRisk] = useState(null)
  const [error, setError] = useState('')
  const [riskError, setRiskError] = useState('')
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(null)
  const [certificateCourseId, setCertificateCourseId] = useState('')
  const [certificateStudents, setCertificateStudents] = useState([])
  const [certificates, setCertificates] = useState([])
  const [certificateStudentId, setCertificateStudentId] = useState('')
  const [revocationReasons, setRevocationReasons] = useState({})
  const [certificateError, setCertificateError] = useState('')
  const [certificateLoading, setCertificateLoading] = useState(true)
  const [certificateReload, setCertificateReload] = useState(0)

  function fetchAll() {
    api.get('/dashboard/instructor/')
      .then(setData)
      .catch((err) => {
        setData(null)
        setError(err.message || 'Unable to load instructor data.')
      })
      .finally(() => setLoading(false))

    getCohortRisk()
      .then((result) => {
        setRisk(result)
        setRiskError('')
      })
      .catch((err) => {
        setRisk(null)
        setRiskError(err.message || 'Unable to load cohort risk data.')
      })
  }

  function load() {
    setLoading(true)
    setError('')
    setRiskError('')
    fetchAll()
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const selectedCertificateCourse = certificateCourseId || String(data?.my_courses?.[0]?.id || '')

  useEffect(() => {
    if (!selectedCertificateCourse) return undefined
    let cancelled = false
    Promise.all([
      api.get(`/enrollments/?course=${selectedCertificateCourse}`),
      api.get(`/engagement/certificates/?course_id=${selectedCertificateCourse}`),
    ])
      .then(([enrollments, rows]) => {
        if (cancelled) return
        setCertificateStudents(enrollments)
        setCertificates(rows)
        setCertificateStudentId((current) => enrollments.some((item) => String(item.student) === current)
          ? current
          : String(enrollments[0]?.student || ''))
      })
      .catch((err) => {
        if (!cancelled) setCertificateError(err.message || 'Unable to load course certificates.')
      })
      .finally(() => {
        if (!cancelled) setCertificateLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedCertificateCourse, certificateReload])

  const displayName = `${auth?.first_name || ''} ${auth?.last_name || ''}`.trim()
    || auth?.username
    || auth?.email
    || 'there'

  const riskCounts = useMemo(() => {
    if (!risk?.scored) return null
    return {
      high: risk.scored.filter((s) => s.risk_level === 'high').length,
      medium: risk.scored.filter((s) => s.risk_level === 'medium').length,
      low: risk.scored.filter((s) => s.risk_level === 'low').length,
    }
  }, [risk])

  async function submitGrade(score, feedback) {
    if (!grading) return
    try {
      await api.patch(`/submissions/${grading.submission_id}/grade/`, { grade: score, feedback })
      toast(`Graded ${grading.student}: ${score}/100`)
      setGrading(null)
      load()
    } catch (err) {
      toast(`Couldn't grade this submission: ${err.message}`, 'error')
    }
  }

  async function issueCertificate() {
    try {
      setCertificateLoading(true)
      setCertificateError('')
      await api.post('/engagement/certificates/issue/', {
        course_id: Number(selectedCertificateCourse),
        student_id: Number(certificateStudentId),
      })
      toast('Certificate issued.')
      setCertificateReload((value) => value + 1)
    } catch (err) {
      setCertificateLoading(false)
      setCertificateError(err.message || 'Unable to issue certificate.')
    }
  }

  async function revokeCertificate(certificate) {
    const reason = revocationReasons[certificate.certificate_number]?.trim()
    if (!reason) {
      setCertificateError('Enter a reason before revoking a certificate.')
      return
    }
    try {
      setCertificateLoading(true)
      setCertificateError('')
      await api.post(`/engagement/certificates/${certificate.certificate_number}/revoke/`, { reason })
      toast(`Certificate for ${certificate.student_name} revoked.`)
      setRevocationReasons((current) => ({ ...current, [certificate.certificate_number]: '' }))
      setCertificateReload((value) => value + 1)
    } catch (err) {
      setCertificateLoading(false)
      setCertificateError(err.message || 'Unable to revoke certificate.')
    }
  }

  return (
    <DashboardLayout navItems={navItems} user={{ name: displayName }} weeklyGoal={riskCounts ? 100 - Math.round((riskCounts.high / Math.max(1, riskCounts.high + riskCounts.medium + riskCounts.low)) * 100) : 0} role={auth?.role === 'admin' ? 'admin' : 'instructor'}>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="instructor-dashboard space-y-6" data-role="instructor">
        {loading && <Skeleton height={220} />}
        {error && <ErrorState message={`Couldn't load your dashboard: ${error}`} onRetry={load} />}

        {data && (
          <>
            <div className="dg-hero instructor-dashboard-hero">
              <i className="dg-orb dg-o1" />
              <i className="dg-orb dg-o2" />
              <div className="dg-grow">
                <div className="dg-day">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                <HeroTitle text={`Good ${new Date().getHours() < 18 ? 'day' : 'evening'}, ${displayName.split(' ')[0]}.`} />
                <p>
                  Teaching {data.my_courses.length} course{data.my_courses.length === 1 ? '' : 's'}. {data.pending_submission_count} submission{data.pending_submission_count === 1 ? '' : 's'} waiting
                  {risk?.scored?.length ? `, ${riskCounts.high} flagged high-risk by the early warning model.` : '.'}
                </p>
                <div className="dg-bt">
                  <button type="button" className="dg-btn" onClick={() => navigate('/dashboard/instructor/content')}>
                    <BookOpen size={15} aria-hidden="true" /> Build a course
                  </button>
                  <button type="button" className="dg-btn" onClick={() => document.getElementById('grading-queue')?.scrollIntoView({ behavior: 'smooth' })}>
                    Start grading
                  </button>
                  <button type="button" className="dg-btn dg-ghost" onClick={() => document.getElementById('risk-table')?.scrollIntoView({ behavior: 'smooth' })}>
                    View at-risk students
                  </button>
                </div>
              </div>
            </div>

            <div className="dg-grid instructor-dashboard-kpis">
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><BookOpen /></span>
                <div className="dg-l">My courses</div>
                <div className="dg-v"><CountUp value={data.my_courses.length} /></div>
                <div className="dg-d">Active this term</div>
              </div>
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><FileCheck /></span>
                <div className="dg-l">Pending reviews</div>
                <div className="dg-v"><CountUp value={data.pending_submission_count} /></div>
                <div className={`dg-d${data.pending_submission_count > 0 ? ' dg-w' : ''}`}>{data.pending_submission_count > 0 ? 'Needs attention' : 'All graded'}</div>
              </div>
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><TriangleAlert /></span>
                <div className="dg-l">Inactive 7+ days</div>
                <div className="dg-v"><CountUp value={data.students_falling_behind.length} /></div>
                <div className="dg-d">Quick activity signal</div>
              </div>
              <div className="dg-card dg-kpi dg-c3">
                <span className="dg-ic"><ShieldAlert /></span>
                <div className="dg-l">High risk (model)</div>
                <div className={`dg-v`}><CountUp value={riskCounts ? riskCounts.high : '—'} /></div>
                <div className={`dg-d${riskCounts?.high ? ' dg-w' : ''}`}>{riskCounts ? 'From the early warning classifier' : 'Loading…'}</div>
              </div>
            </div>

            <Card span={12} className="instructor-grading-card">
              <div id="grading-queue" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3>Grading queue</h3>
                  <div className="dg-sub">Oldest first · {data.pending_submissions.length} waiting for review</div>
                </div>
                <button type="button" className="dg-btn dg-ghost" onClick={() => navigate('/dashboard/instructor/submissions')}>
                  View submissions
                </button>
              </div>
              {data.pending_submissions.length === 0 && <EmptyState message="Nothing waiting for review." />}
              {data.pending_submissions.map((s) => (
                <div key={s.submission_id} className="dg-row">
                  <Avatar name={s.student} />
                  <div className="dg-g">
                    <b>{s.student}</b>
                    <small>{s.activity} · {s.course} · submitted {new Date(s.submitted_at).toLocaleDateString()}</small>
                  </div>
                  <button className="dg-gb" onClick={() => setGrading(s)}>Grade</button>
                </div>
              ))}
            </Card>

            <div className="dg-grid">
              <Card span={4} className="instructor-risk-summary">
                <h3>Cohort risk breakdown</h3>
                <div className="dg-sub">Early Warning Risk Classifier</div>
                {riskError && <ErrorState message={riskError} onRetry={load} />}
                {!riskError && !riskCounts && <Skeleton height={150} />}
                {riskCounts && (riskCounts.high + riskCounts.medium + riskCounts.low === 0 ? (
                  <EmptyState message="No students have enough weekly history to score yet." />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Donut
                        slices={[
                          { label: 'High risk', value: riskCounts.high, color: 'var(--bad)' },
                          { label: 'Medium', value: riskCounts.medium, color: 'var(--warn)' },
                          { label: 'On track', value: riskCounts.low, color: 'var(--ok)' },
                        ]}
                      />
                    </div>
                    <DonutLegend slices={[
                      { label: 'High risk', value: riskCounts.high, color: 'var(--bad)' },
                      { label: 'Medium', value: riskCounts.medium, color: 'var(--warn)' },
                      { label: 'On track', value: riskCounts.low, color: 'var(--ok)' },
                    ]} />
                  </>
                ))}
              </Card>

              <div className="dg-card dg-c8 instructor-risk-list" id="risk-table">
                <h3>Early warning — who needs a check-in</h3>
                <div className="dg-sub">Experimental signal trained on synthetic data; use as a review aid, not a decision — highest risk first</div>
                {riskError && <ErrorState message={riskError} onRetry={load} />}
                {!riskError && !risk && <Skeleton height={200} />}
                {risk?.scored?.length === 0 && <EmptyState message="Nobody has enough weekly history to score yet — check back after a couple of weeks of activity." />}
                {risk?.scored?.slice(0, 8).map((s) => (
                  <div key={`${s.student_id}-${s.course_id}`} className="dg-row" style={{ alignItems: 'flex-start' }}>
                    <Avatar name={s.student_name || String(s.student_id)} />
                    <div className="dg-g">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <b>{s.student_name || `Student ${s.student_id}`}</b>
                        <Pill tone={RISK_TONE[s.risk_level]} pulse={s.risk_level === 'high'}>{s.risk_level} risk · health {s.student_health_score}</Pill>
                        {s.course_title && <span className="dg-sub" style={{ margin: 0 }}>{s.course_title}</span>}
                      </div>
                      {s.top_factors?.length > 0 && (
                        <small>{s.top_factors.join(' · ')}</small>
                      )}
                      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--acc)' }}>{s.recommended_action}</p>
                    </div>
                  </div>
                ))}
                {risk?.skipped_insufficient_history?.length > 0 && (
                  <p className="dg-sub" style={{ marginTop: 10 }}>
                    {risk.skipped_insufficient_history.length} more student(s) don't have enough weekly history yet to score.
                  </p>
                )}
              </div>
            </div>

            <Card span={12} className="instructor-falling-list">
              <h3>Students falling behind</h3>
              <div className="dg-sub">No completed activity in the last 7 days — a simpler, immediate signal alongside the risk model above</div>
              {data.students_falling_behind.length === 0 && <EmptyState message="Nobody — everyone's been active this week." />}
              {data.students_falling_behind.map((s, i) => (
                <div key={i} className="dg-row">
                  <Avatar name={s.student} />
                  <div className="dg-g">
                    <b>{s.student}</b>
                    <small>{s.course}</small>
                  </div>
                  <Pill tone="y">Inactive 7d+</Pill>
                </div>
              ))}
            </Card>

            <section className="dg-card instructor-certificate-card rounded-2xl p-5 sm:p-6" aria-labelledby="certificate-management-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="certificate-management-heading" className="text-base font-bold text-white">Certificates</h2>
                  <p className="dg-sub mt-1">Issue after course completion or revoke with a recorded reason.</p>
                </div>
                {data.my_courses.length > 0 && (
                  <label className="grid gap-1 text-xs font-semibold text-slate-300">
                    Course
                    <select
                      value={selectedCertificateCourse}
                      onChange={(event) => { setCertificateLoading(true); setCertificateError(''); setCertificateCourseId(event.target.value) }}
                      className="min-w-52 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white lms-focus-ring"
                    >
                      {data.my_courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {certificateError && <p className="mt-4 text-sm text-rose-300" role="alert">{certificateError}</p>}
              {!data.my_courses.length && <p className="mt-4 text-sm text-slate-400">Create a course before managing certificates.</p>}
              {data.my_courses.length > 0 && (
                <>
                  <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); issueCertificate() }}>
                    <label className="grid min-w-56 flex-1 gap-1 text-xs font-semibold text-slate-300">
                      Enrolled student
                      <select
                        value={certificateStudentId}
                        onChange={(event) => setCertificateStudentId(event.target.value)}
                        disabled={!certificateStudents.length || certificateLoading}
                        className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white lms-focus-ring disabled:opacity-50"
                      >
                        {certificateStudents.length ? certificateStudents.map((student) => (
                          <option key={student.student} value={student.student}>{student.student_name || student.student_email}</option>
                        )) : <option value="">No enrolled students</option>}
                      </select>
                    </label>
                    <button type="submit" disabled={!certificateStudentId || certificateLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 lms-focus-ring disabled:opacity-50">
                      <Award size={15} aria-hidden="true" /> Issue certificate
                    </button>
                  </form>
                  {certificateLoading ? <p className="mt-5 text-sm text-slate-400" role="status">Loading certificates...</p> : certificates.length ? (
                    <ul className="mt-5 divide-y divide-slate-700">
                      {certificates.map((certificate) => (
                        <li key={certificate.certificate_number} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{certificate.student_name}</p>
                              <p className="mt-1 text-xs text-slate-400">{certificate.status === 'issued' ? 'Issued' : 'Revoked'} · {new Date(certificate.issued_at).toLocaleDateString()} · {certificate.certificate_number}</p>
                              {certificate.status === 'revoked' && <p className="mt-1 text-xs text-amber-200">Reason: {certificate.revocation_reason}</p>}
                            </div>
                          </div>
                          {certificate.status === 'issued' && (
                            <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); revokeCertificate(certificate) }}>
                              <label className="grid min-w-56 flex-1 gap-1 text-xs font-semibold text-slate-400">
                                Revocation reason
                                <input
                                  value={revocationReasons[certificate.certificate_number] || ''}
                                  maxLength={500}
                                  onChange={(event) => setRevocationReasons((current) => ({ ...current, [certificate.certificate_number]: event.target.value }))}
                                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white lms-focus-ring"
                                  required
                                />
                              </label>
                              <button type="submit" className="rounded-lg border border-rose-400/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-950/40 lms-focus-ring">Revoke</button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-sm text-slate-400" role="status">No certificates for this course yet.</p>
                  )}
                </>
              )}
            </section>
          </>
        )}

      </div>

      <GradeModal
        open={!!grading}
        onClose={() => setGrading(null)}
        studentName={grading?.student}
        assignmentTitle={grading ? `${grading.activity} · ${grading.course}` : ''}
        maxScore={100}
        onSubmit={submitGrade}
      />
    </DashboardLayout>
  )
}
