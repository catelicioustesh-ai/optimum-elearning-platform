import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, BookOpen, Check, GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import AuthBrand from '../components/AuthBrand.jsx'
import Logo from '../components/Logo.jsx'
import EmailInput from '../components/EmailInput.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { useToast } from '../hooks/useToast.js'

const roleOptions = [
  { id: 'student', label: 'Student', description: 'Continue learning', icon: GraduationCap },
  { id: 'instructor', label: 'Instructor', description: 'Manage courses', icon: BookOpen },
  { id: 'admin', label: 'Admin', description: 'Platform oversight', icon: ShieldCheck },
]

const roleContext = {
  student: {
    message: 'Your courses, learning path, and achievements.',
    headline: 'A clear path from learning to doing.',
    journey: [
      { title: 'Learn', caption: 'Follow structured lessons', icon: BookOpen },
      { title: 'Practice', caption: 'Build skills with activities', icon: Check },
      { title: 'Progress', caption: 'Track meaningful milestones', icon: Users },
      { title: 'Earn', caption: 'Celebrate course completion', icon: GraduationCap },
    ],
  },
  instructor: {
    message: 'Your course content, learners, and submissions.',
    headline: 'Create courses that move learners forward.',
    journey: [
      { title: 'Design', caption: 'Organize clear learning paths', icon: Sparkles },
      { title: 'Teach', caption: 'Guide lessons and live sessions', icon: BookOpen },
      { title: 'Review', caption: 'Give useful learner feedback', icon: Check },
      { title: 'Improve', caption: 'Follow learner progress', icon: Users },
    ],
  },
  admin: {
    message: 'Platform tools and administration.',
    headline: 'Keep learning organized and on track.',
    journey: [
      { title: 'Manage', caption: 'Maintain platform access', icon: ShieldCheck },
      { title: 'Organize', caption: 'Support courses and teams', icon: Users },
      { title: 'Monitor', caption: 'Review platform activity', icon: BookOpen },
      { title: 'Support', caption: 'Help learning run smoothly', icon: Check },
    ],
  },
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Email is case-insensitive and may carry stray spaces; the password is sent exactly as typed.
      const session = await login(email.trim().toLowerCase(), password, accountType)
      toast('Logged in successfully.', 'success')
      navigate(`/dashboard/${session.role}`)
    } catch (err) {
      setError(err.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : err.message || 'Unable to sign in. Check your email and password and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-muted p-4 text-text-primary sm:p-6" data-role={accountType}>
      <Helmet>
        <title>Sign In — Optimum LMS</title>
      </Helmet>

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[30px] border border-border bg-surface shadow-[0_24px_60px_rgba(15,23,42,0.12)] md:grid md:grid-cols-12">
        {/* Left Side: Brand Showcase */}
        <div className="auth-hero hidden flex-col justify-between border-r border-border p-8 md:col-span-5 md:flex">
          <div>
            <AuthBrand />

            <div className="mt-14">
              <span className="auth-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]">
                <Sparkles size={12} /> Optimum learning
              </span>
              <h2 className="mt-5 max-w-sm text-3xl font-black leading-tight tracking-tight text-white">{roleContext[accountType].headline}</h2>
              <div className="auth-learning-journey mt-7" aria-label="Learning journey">
                {roleContext[accountType].journey.map(({ title, caption, icon: Icon }, idx) => (
                  <div key={title} className="auth-journey-step" style={{ '--step-index': idx }}>
                    <span className="auth-journey-icon"><Icon size={16} aria-hidden="true" /></span>
                    <span><strong>{title}</strong><small>{caption}</small></span>
                    {idx < 3 && <span className="auth-journey-connector" aria-hidden="true" />}
                  </div>
                ))}
              </div>

              <div className="auth-demo mt-6 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <BookOpen size={15} aria-hidden="true" /> A course workspace
                  </div>
                  <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold text-blue-50">Example</span>
                </div>
                <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-white">Learn</span>
                    <span className="text-blue-100">Practice</span>
                    <span className="text-blue-100">Track</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full w-2/3 rounded-full bg-sky-300" />
                  </div>
                  <p className="mt-2 text-[11px] text-blue-100">Lessons, activities, feedback, and course progress in one place.</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Form */}
        <div className="flex flex-col justify-center p-8 sm:p-12 md:col-span-7">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 md:hidden">
              <Logo tone="light" height={34} />
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Welcome back</h1>
              <p className="mt-1 text-xs text-text-secondary">{roleContext[accountType].message}</p>
            </div>

            {location.state?.registered && (
              <div className="mb-5 rounded-xl border border-primary/20 bg-blue-50 px-4 py-3 text-sm text-text-primary" role="status">
                Account created. You can sign in now; check your email for a link to verify your address.
              </div>
            )}

            {error && (
              <div role="alert" className="auth-danger mb-5 rounded-xl px-4 py-2.5 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset className="min-w-0">
                <legend className="mb-2 text-xs font-semibold text-text-secondary">Choose your workspace</legend>
                <div className="grid grid-cols-3 gap-2">
                  {roleOptions.map(({ id, label, description, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={accountType === id}
                      onClick={() => setAccountType(id)}
                      className={`login-role-card rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${accountType === id ? 'is-selected' : ''}`}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span className="mt-2 block text-xs font-bold">{label}</span>
                      <span className="mt-0.5 block text-[10px] leading-4">{description}</span>
                    </button>
                  ))}
                </div>
                <p className="sr-only" aria-live="polite">Selected workspace: {accountType}</p>
              </fieldset>
              <EmailInput value={email} onChange={(e) => setEmail(e.target.value)} />

              <PasswordInput
                id="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                extra={<Link to="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary-hover">Forgot password?</Link>}
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-text-secondary">
              <Link to="/" className="text-text-secondary hover:text-text-primary">
                ← Back to overview
              </Link>
              <Link to="/register" className="font-semibold text-primary hover:text-primary-hover">
                New learner? Register
              </Link>
            </div>
            <Link to="/verify-email" className="mt-4 block text-center text-xs font-semibold text-text-secondary hover:text-primary">
              Need a new verification email?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
