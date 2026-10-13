import { useEffect, useMemo, useState } from 'react'
import { Award, CalendarDays, Check, ChevronRight, Download, Flame, LockKeyhole, Medal, RotateCw, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

const leaderboardScopes = [
  { id: 'personal', label: 'Personal' },
  { id: 'team', label: 'Team' },
  { id: 'organization', label: 'Organization' },
]

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

function createHeatmap(activityDays) {
  const activeDays = new Set(activityDays || [])
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const firstDay = new Date(today)
  firstDay.setUTCDate(firstDay.getUTCDate() - 364)
  firstDay.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay())
  const result = []
  for (const date = new Date(firstDay); date <= today; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = dayKey(date)
    result.push({ key, active: activeDays.has(key), date: new Date(date) })
  }
  return result
}

function LearningHeatmap({ activityDays }) {
  const days = useMemo(() => createHeatmap(activityDays), [activityDays])
  return (
    <section className="dg-card rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Learning activity</h2>
          <p className="mt-1 text-sm text-slate-600">Days with recorded course activity over the last year.</p>
        </div>
        <CalendarDays size={19} className="text-blue-700" aria-hidden="true" />
      </div>
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="learning-heatmap" role="img" aria-label={`${activityDays?.length || 0} active learning days over the last year`}>
          {days.map((day) => (
            <span
              key={day.key}
              className={`learning-heatmap-day ${day.active ? 'is-active' : ''}`}
              title={`${day.key}${day.active ? ' · Learning activity' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Less</span>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="learning-heatmap-legend" /><span className="learning-heatmap-legend is-active" />
        </div>
        <span>More</span>
      </div>
    </section>
  )
}

function AchievementRoadmap({ achievements }) {
  if (!achievements.length) {
    return <StudentPageMessage>No achievement goals are configured yet.</StudentPageMessage>
  }
  return (
    <ol className="achievement-roadmap">
      {achievements.map((achievement, index) => {
        const earned = Boolean(achievement.earned_at)
        return (
          <li key={achievement.code} className="achievement-roadmap-item">
            <span className={`achievement-roadmap-connector ${earned ? 'is-earned' : ''}`} aria-hidden="true" />
            <div className={`achievement-badge ${earned ? 'is-earned' : 'is-locked'}`} aria-hidden="true">
              {earned ? <Award size={21} /> : <LockKeyhole size={18} />}
            </div>
            <article className={`dg-card achievement-roadmap-card ${earned ? 'is-earned' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{achievement.name}</h3>
                    {earned && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">Earned</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{achievement.description}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{achievement.category}</span>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{achievement.progress} / {achievement.threshold}</span>
                  <span className="font-semibold text-slate-700">{achievement.progress_percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${achievement.name} progress`} aria-valuemin={0} aria-valuemax={achievement.threshold} aria-valuenow={achievement.progress}>
                  <div className={`achievement-progress-fill h-full rounded-full ${earned ? 'is-earned' : ''}`} style={{ width: `${achievement.progress_percent}%` }} />
                </div>
              </div>
              {earned && achievement.earned_at && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                  <Check size={13} aria-hidden="true" /> Unlocked {new Date(achievement.earned_at).toLocaleDateString()}
                </p>
              )}
              {!earned && <p className="mt-3 text-xs text-slate-500">Goal {index + 1} on your achievement journey</p>}
            </article>
          </li>
        )
      })}
    </ol>
  )
}

function CertificatePreview({ certificate, onDownload, downloading, error }) {
  if (!certificate) {
    return (
      <section className="dg-card rounded-2xl border border-dashed border-slate-300 bg-white p-5">
        <div className="flex items-center gap-3 text-slate-600">
          <ShieldCheck size={21} className="text-blue-700" aria-hidden="true" />
          <div><h2 className="font-semibold text-slate-900">Certificate preview</h2><p className="mt-1 text-sm">Complete an eligible course to earn your first certificate.</p></div>
        </div>
      </section>
    )
  }
  return (
    <section className="dg-card rounded-2xl border border-blue-100 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">Featured certificate</p>
          <h2 className="mt-1 font-semibold text-slate-900">{certificate.course_title}</h2>
        </div>
        <ShieldCheck size={21} className="text-blue-700" aria-hidden="true" />
      </div>
      <div className="certificate-preview mt-4">
        <div className="certificate-preview-inner">
          <Sparkles size={17} aria-hidden="true" />
          <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em]">Certificate of completion</p>
          <p className="mt-2 text-sm font-serif font-bold">{certificate.student_name}</p>
          <p className="mt-1 max-w-full truncate text-[10px]">{certificate.course_title}</p>
          <div className="mt-3 h-px w-1/2 bg-blue-300" />
          <p className="mt-2 text-[8px] text-blue-700">Issued {new Date(certificate.issued_at).toLocaleDateString()}</p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
      {certificate.status === 'issued' ? (
        <button type="button" onClick={() => onDownload(certificate)} disabled={downloading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:opacity-60">
          <Download size={15} aria-hidden="true" /> {downloading ? 'Preparing…' : 'Download certificate'}
        </button>
      ) : <p className="mt-4 text-sm font-medium text-amber-800">This certificate has been revoked and cannot be downloaded.</p>}
    </section>
  )
}

export default function StudentAchievements() {
  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [scope, setScope] = useState('personal')
  const [leaderboardResult, setLeaderboardResult] = useState({ scope: 'personal', data: null, error: '', loading: true })
  const [downloading, setDownloading] = useState(false)
  const [certificateError, setCertificateError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/engagement/me/')
      .then((data) => { if (!cancelled) setEngagement(data) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Achievement data could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  useEffect(() => {
    let cancelled = false
    api.get(`/engagement/leaderboard/?scope=${scope}`)
      .then((data) => {
        if (!cancelled) setLeaderboardResult({ scope, data, error: '', loading: false })
      })
      .catch((err) => {
        if (!cancelled) {
          setLeaderboardResult({
            scope,
            data: null,
            error: err.message || 'Leaderboard data is unavailable.',
            loading: false,
          })
        }
      })
    return () => { cancelled = true }
  }, [scope])

  async function downloadCertificate(certificate) {
    setCertificateError('')
    setDownloading(true)
    try {
      await api.download(
        `/engagement/certificates/${certificate.certificate_number}/download/`,
        `certificate-${certificate.certificate_number}.pdf`,
      )
    } catch (err) {
      setCertificateError(err.message || 'Certificate download failed.')
    } finally {
      setDownloading(false)
    }
  }

  const achievements = engagement?.achievements || []
  const certificates = engagement?.certificates || []
  const earnedCount = achievements.filter((item) => item.earned_at).length
  const featuredCertificate = certificates.find((item) => item.status === 'issued') || certificates[0] || null
  const activityDays = engagement?.activity_days || []
  const leaderboardMatchesScope = leaderboardResult.scope === scope
  const leaderboard = leaderboardMatchesScope ? leaderboardResult.data : null
  const leaderboardError = leaderboardMatchesScope ? leaderboardResult.error : ''
  const leaderboardLoading = !leaderboardMatchesScope || leaderboardResult.loading

  return (
    <StudentPage title="Achievements" description="Track your progress, celebrate milestones, and see how your learning adds up.">
      {loading && <StudentPageMessage>Loading achievements and learning activity…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          {error}
          <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}><RotateCw size={13} /> Try again</button>
        </StudentPageMessage>
      )}
      {!loading && !error && engagement && (
        <>
          <section className="achievement-hero dg-hero">
            <div className="achievement-hero-copy">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Your learning journey</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Every step counts.</h2>
              <p className="mt-2 max-w-xl text-sm text-blue-100">Your progress is built from completed activities, course certificates, and the time you spend learning.</p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-white backdrop-blur">
                  <Sparkles size={17} aria-hidden="true" />
                  <span className="text-lg font-bold">{engagement.xp} XP</span>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white"><Flame size={17} className="text-amber-300" aria-hidden="true" />{engagement.current_streak} day streak</div>
              </div>
            </div>
            <div className="achievement-hero-trophy" aria-hidden="true"><Trophy size={76} strokeWidth={1.25} /></div>
          </section>

          <section className="achievement-reward-strip" aria-label={`Next reward in ${engagement.xp_to_next_reward} XP`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><Medal size={20} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Next reward in {engagement.xp_to_next_reward} XP</p>
                <p className="text-xs text-slate-600">{engagement.xp} of {engagement.next_reward_at} XP toward your next milestone</p>
              </div>
            </div>
            <div className="achievement-reward-progress" role="progressbar" aria-label="Progress to next XP reward" aria-valuemin={0} aria-valuemax={100} aria-valuenow={engagement.reward_progress_percent}>
              <span style={{ width: `${engagement.reward_progress_percent}%` }} />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Experience points', value: engagement.xp, icon: Sparkles, color: 'blue' },
              { label: 'Current streak', value: `${engagement.current_streak} days`, icon: Flame, color: 'amber' },
              { label: 'Achievements earned', value: `${earnedCount} / ${achievements.length}`, icon: Award, color: 'violet' },
              { label: 'Certificates', value: certificates.filter((item) => item.status === 'issued').length, icon: ShieldCheck, color: 'emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <article key={label} className="dg-card rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className={`achievement-metric-icon is-${color}`}><Icon size={18} aria-hidden="true" /></span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              </article>
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
            <section className="dg-card rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Achievement journey</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Your milestones</h2>
                <p className="mt-1 text-sm text-slate-600">Goals and awards are based on activity recorded in your account.</p>
              </div>
              <AchievementRoadmap achievements={achievements} />
            </section>
            <div className="space-y-5">
              <CertificatePreview
                certificate={featuredCertificate}
                onDownload={downloadCertificate}
                downloading={downloading}
                error={certificateError}
              />
              <section className="dg-card rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Learner leaderboard</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">Compare progress</h2>
                  </div>
                  <Users size={19} className="text-blue-700" aria-hidden="true" />
                </div>
                <div className="mb-4 flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Leaderboard scope">
                  {leaderboardScopes.map((tab) => (
                    <button key={tab.id} type="button" role="tab" aria-selected={scope === tab.id} onClick={() => setScope(tab.id)} className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${scope === tab.id ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {leaderboardLoading && <p className="py-5 text-center text-sm text-slate-500" role="status">Loading leaderboard…</p>}
                {!leaderboardLoading && leaderboardError && (
                  <StudentPageMessage tone="error">{leaderboardError}</StudentPageMessage>
                )}
                {!leaderboardLoading && leaderboard && !leaderboardError && (
                  leaderboard.available ? (
                    <>
                      <p className="mb-3 text-xs text-slate-600">
                        {scope === 'personal' ? `${leaderboard.xp} XP · your personal progress` : leaderboard.viewer_opted_in ? `Your rank: ${leaderboard.viewer_rank ? `#${leaderboard.viewer_rank}` : 'not ranked yet'}` : 'Opt in from Profile & privacy to appear by name.'}
                      </p>
                      <ol className="space-y-2">
                        {(leaderboard.participants || []).map((person) => (
                          <li key={`${person.rank}-${person.display_name}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-slate-600">{person.rank}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{person.display_name}</span>
                            <span className="text-xs font-bold text-blue-800">{person.xp} XP</span>
                          </li>
                        ))}
                        {!leaderboard.participants?.length && <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">No opted-in learners to show yet.</li>}
                      </ol>
                    </>
                  ) : <StudentPageMessage>{leaderboard.message || 'This leaderboard is not available yet.'}</StudentPageMessage>
                )}
                <Link to="/dashboard/student/settings" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:underline">
                  Manage privacy settings <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>

          <LearningHeatmap activityDays={activityDays} />
        </>
      )}
    </StudentPage>
  )
}
