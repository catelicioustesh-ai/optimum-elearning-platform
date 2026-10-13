import { useEffect, useState } from 'react'
import { Camera, Check, RotateCw, UserRound } from 'lucide-react'
import ProfilePhoto from '../components/ProfilePhoto.jsx'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

export default function StudentProfile() {
  const [profile, setProfile] = useState(null)
  const [bio, setBio] = useState('')
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.me()
      .then((result) => {
        if (cancelled) return
        setProfile(result)
        setBio(result.bio || '')
        setLeaderboardOptIn(Boolean(result.leaderboard_opt_in))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Your profile could not be loaded.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  useEffect(() => {
    if (!preview) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  async function saveProfile(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    const form = new FormData()
    form.append('bio', bio)
    form.append('leaderboard_opt_in', String(leaderboardOptIn))
    if (photo) form.append('profile_photo', photo)
    try {
      const updated = await api.patch('/auth/me/', form, { isFormData: true })
      setProfile(updated)
      setPhoto(null)
      setPreview('')
      setNotice('Your profile was saved.')
    } catch (err) {
      setError(err.message || 'Your profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <StudentPage title="Profile & privacy" description="Manage how you appear in your learning space and leaderboard." profile={profile} fetchStudentProfile={false}>
      {loading && <StudentPageMessage>Loading your profile…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          {error}
          {!profile && <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}><RotateCw size={13} /> Try again</button>}
        </StudentPageMessage>
      )}
      {notice && <StudentPageMessage tone="success"><span className="inline-flex items-center gap-2"><Check size={16} />{notice}</span></StudentPageMessage>}
      {!loading && profile && (
        <form onSubmit={saveProfile} className="dg-card max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <section className="flex flex-wrap items-center gap-4">
            {preview ? (
              <img src={preview} alt="Selected profile preview" className="h-20 w-20 rounded-full border-2 border-blue-100 object-cover" />
            ) : (
              <ProfilePhoto
                photoPath={profile.profile_photo}
                alt={fullName || 'Student profile'}
                className="h-20 w-20 rounded-full border-2 border-blue-100 object-cover"
                fallback={initials || <UserRound size={24} />}
                fallbackClassName="grid h-20 w-20 place-items-center rounded-full border-2 border-blue-100 bg-blue-50 text-xl font-bold text-blue-800"
              />
            )}
            <div>
              <h2 className="font-semibold text-slate-900">Profile photo</h2>
              <p className="mt-1 text-sm text-slate-600">Private to your signed-in account. JPEG, PNG, or WebP up to 5 MB.</p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Camera size={15} aria-hidden="true" /> Choose image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const chosen = event.target.files?.[0]
                    if (!chosen) return
                    if (chosen.size > 5 * 1024 * 1024) {
                      setError('Choose a profile image smaller than 5 MB.')
                      event.target.value = ''
                      return
                    }
                    setError('')
                    setPhoto(chosen)
                    setPreview(URL.createObjectURL(chosen))
                  }}
                />
              </label>
              {photo && <button type="button" onClick={() => { setPhoto(null); setPreview('') }} className="ml-3 text-sm font-semibold text-slate-600 underline">Discard selection</button>}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Registered name
              <input readOnly value={fullName || profile.username} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Email
              <input readOnly value={profile.email} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600" />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            About you
            <textarea
              value={bio}
              maxLength={500}
              rows={4}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Share a little about your learning goals or interests."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <span className="text-right text-xs font-normal text-slate-500">{bio.length}/500</span>
          </label>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={leaderboardOptIn}
                onChange={(event) => setLeaderboardOptIn(event.target.checked)}
                className="mt-1 h-4 w-4 accent-blue-700"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Show my name on team and organization leaderboards</span>
                <span className="mt-1 block text-sm text-slate-600">This is optional. Your XP is not shown to other students unless you opt in.</span>
              </span>
            </label>
          </section>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
              <Check size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      )}
    </StudentPage>
  )
}
