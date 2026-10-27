import { useState } from 'react'
import Logo from '../components/Logo.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import PasswordChecklist from '../components/PasswordChecklist.jsx'
import { checkPassword } from '../lib/passwordRules.js'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Mail, Sparkles, User } from 'lucide-react'
import { api } from '../lib/api.js'
import AuthBrand from '../components/AuthBrand.jsx'

const SITE_URL = window.location.origin

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'student',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!checkPassword(form.password).valid) {
      setError('Your password does not meet all the requirements listed below the password box.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const result = await api.register({
        username: form.username,
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        password: form.password,
      })
      navigate('/verify-email', {
        state: {
          registered: true,
          email: form.email.trim().toLowerCase(),
          accountRole: form.role,
          verificationEmailSent: result.verification_email_sent,
        },
      })
    } catch (err) {
      setError(err.message || 'Unable to create your account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted text-text-primary" data-role={form.role}>
      <Helmet>
        <title>Create account — Optimum ERP LMS</title>
        <link rel="canonical" href={`${SITE_URL}/register`} />
      </Helmet>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 md:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_30px_80px_rgba(15,23,42,0.12)] md:grid-cols-[0.9fr_1.1fr]">
          <div className="auth-hero hidden p-8 md:flex md:flex-col md:justify-between">
            <AuthBrand />

            <div className="mt-16">
              <div className="auth-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
                <Sparkles size={12} />
                Start learning
              </div>
              <p className="mt-6 text-3xl font-black leading-tight tracking-tighter text-white">
                Learn or teach with a verified account.
              </p>
              <div className="mt-8 space-y-4 text-sm text-white">
                {['Start with the first module', 'Practice in real coding labs', 'See feedback as soon as you submit'].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-primary">
                      <Check size={12} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="auth-feature mt-10 rounded-2xl p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white">A place to grow</div>
              <p className="mt-2 leading-6 text-white">Join the platform as a learner or instructor.</p>
            </div>
          </div>

          <div className="flex items-center bg-surface px-6 py-10 sm:px-10 lg:px-12">
            <div className="w-full max-w-md">
              <div className="mb-8 md:hidden">
                <Logo tone="light" height={34} />
              </div>

              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Create account</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-text-primary">Join the platform</h1>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {error && (
                  <div className="auth-danger rounded-xl px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" name="first_name" value={form.first_name} onChange={updateField} icon={User} />
                  <Field label="Last name" name="last_name" value={form.last_name} onChange={updateField} icon={User} />
                </div>

                <Field label="Username" name="username" value={form.username} onChange={updateField} icon={User} required />
                <Field label="Email" name="email" type="email" value={form.email} onChange={updateField} icon={Mail} required />
                <div>
                  <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-text-primary">I want to</label>
                  <select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={updateField}
                    className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary focus:bg-surface focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="student">Learn as a student</option>
                    <option value="instructor">Teach as an instructor</option>
                  </select>
                </div>
                <div>
                  <PasswordInput id="password" label="Password" labelClassName="mb-0 block text-sm font-medium text-text-primary" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" describedBy="pw-rules" />
                  <PasswordChecklist id="pw-rules" password={form.password} />
                </div>
                <div>
                  <PasswordInput id="confirmPassword" label="Confirm password" labelClassName="mb-0 block text-sm font-medium text-text-primary" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} autoComplete="new-password" />
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="mt-1.5 text-xs font-medium text-red-600" role="status">Passwords do not match yet.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-text-secondary">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, name, value, onChange, icon: Icon, type = 'text', required = false, minLength }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          autoComplete={name === 'email' ? 'email' : name === 'username' ? 'username' : name === 'first_name' ? 'given-name' : 'family-name'}
          autoCapitalize={name === 'email' || name === 'username' ? 'none' : 'words'}
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-surface-muted py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-blue-100"
        />
      </div>
    </div>
  )
}