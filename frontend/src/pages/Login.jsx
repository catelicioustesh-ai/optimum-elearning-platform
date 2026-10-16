import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, Award, BookOpen, Check, Flame, Sparkles, TrendingUp, TriangleAlert } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import AuthBrand from '../components/AuthBrand.jsx'
import EmailInput from '../components/EmailInput.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { useToast } from '../hooks/useToast.js'

const learningJourney = [
  { title: 'Learn', caption: 'Follow a guided path', icon: BookOpen },
  { title: 'Practice', caption: 'Build skills by doing', icon: Check },
  { title: 'Progress', caption: 'See how far you have come', icon: TrendingUp },
  { title: 'Achieve', caption: 'Earn credentials that count', icon: Award },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Email is case-insensitive and may carry stray spaces; keep passwords untouched.
      const session = await login(email.trim().toLowerCase(), password)
      toast('Signed in successfully.', 'success')

      const requestedPath = location.state?.from?.pathname
      const destination = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
        ? `${requestedPath}${location.state.from.search || ''}${location.state.from.hash || ''}`
        : `/dashboard/${session.role}`
      navigate(destination, { replace: true })
    } catch (err) {
      if (err.status === 401) {
        setError('We couldn’t sign you in with those details. Check your email and password. If you just registered, verify your email and wait for administrator approval.')
      } else if (err.status === 429) {
        setError('Too many sign-in attempts. Please wait a moment before trying again.')
      } else {
        setError(err.message || 'We couldn’t sign you in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  function clearError(setValue) {
    return (event) => {
      setValue(event.target.value)
      if (error) setError('')
    }
  }

  return (
    <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-muted p-4 text-text-primary sm:p-6">
      <Helmet>
        <title>Sign in — Optimum LMS</title>
        <meta name="description" content="Sign in to continue learning, practicing, and earning with Optimum LMS." />
      </Helmet>

      <div className="login-card relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[30px] border border-border bg-surface md:min-h-[680px] md:grid-cols-[0.92fr_1.08fr]">
        <section className="auth-hero login-story hidden flex-col justify-between p-8 sm:p-10 md:flex lg:p-12" aria-label="Optimum LMS learning experience">
          <div>
            <AuthBrand compact />

            <div className="mt-8">
              <span className="auth-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
                <Sparkles size={13} aria-hidden="true" /> Learning • Practice • Certification
              </span>
              <h2 className="mt-5 max-w-md text-4xl font-black leading-[1.08] tracking-tight text-white lg:text-[2.7rem]">
                Make your next step your best one.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">
                A focused space to learn new skills, put them into practice, and keep your progress moving.
              </p>

              <div className="auth-learning-journey mt-5" aria-label="Your learning journey">
                {learningJourney.map(({ title, caption, icon: Icon }, index) => (
                  <div key={title} className="auth-journey-step" style={{ '--step-index': index }}>
                    <span className="auth-journey-icon"><Icon size={16} aria-hidden="true" /></span>
                    <span><strong>{title}</strong><small>{caption}</small></span>
                    {index < learningJourney.length - 1 && <span className="auth-journey-connector" aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="auth-preview mt-6 rounded-2xl p-4 sm:p-5" aria-label="Sample learner dashboard preview">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <BookOpen size={15} aria-hidden="true" /> Your learning, in one place
              </div>
              <span className="auth-preview-label rounded-full px-2.5 py-1 text-[10px] font-semibold">SAMPLE</span>
            </div>

            <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-blue-100">CONTINUE LEARNING</p>
                  <p className="mt-1 text-sm font-semibold text-white">Threat Defense Fundamentals</p>
                </div>
                <span className="rounded-lg bg-white/10 p-2 text-blue-100"><BookOpen size={17} aria-hidden="true" /></span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-blue-100">Course progress</span>
                <span className="font-semibold text-white">80%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" aria-label="Sample course progress: 80 percent">
                <div className="h-full w-4/5 rounded-full bg-sky-300" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <PreviewMetric icon={Flame} value="5 days" label="streak" />
                <PreviewMetric icon={TrendingUp} value="1,250" label="sample XP" />
                <PreviewMetric icon={Award} value="3" label="certificates" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-blue-100">Illustrative sample workspace — your dashboard reflects your own activity.</p>
          </div>
        </section>

        <section className="login-form-panel flex items-center justify-center px-6 py-10 sm:px-10 md:px-12 lg:px-16" aria-labelledby="login-heading">
          <div className="login-form-content w-full max-w-md">
            <div className="mb-9 md:hidden">
              <AuthBrand compact />
            </div>

            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Welcome back</p>
              <h1 id="login-heading" className="mt-2 text-3xl font-black tracking-tight text-text-primary sm:text-[2.1rem]">
                Sign in to continue
              </h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Pick up where you left off. We’ll take you to the right workspace.
              </p>
            </div>

            {location.state?.registered && (
              <div className="mb-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950" role="status">
                <Check size={18} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
                <span>Registration received. Verify your email, then wait for an administrator to approve your learner account before signing in.</span>
              </div>
            )}

            {error && (
              <div id="login-error" role="alert" aria-live="assertive" className="auth-danger mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm">
                <TriangleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              <EmailInput
                value={email}
                onChange={clearError(setEmail)}
                placeholder="you@example.com"
                autoFocus
              />

              <PasswordInput
                id="password"
                label="Password"
                value={password}
                onChange={clearError(setPassword)}
                describedBy={error ? 'login-error' : undefined}
                extra={<Link to="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary-hover">Forgot password?</Link>}
              />

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="login-submit mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition hover:bg-primary-hover active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="login-loading-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    Signing you in…
                  </>
                ) : (
                  <>Sign in securely <ArrowRight size={17} aria-hidden="true" /></>
                )}
              </button>
            </form>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-text-secondary">
              <Link to="/" className="transition hover:text-text-primary">← Back to overview</Link>
              <Link to="/register" className="font-semibold text-primary transition hover:text-primary-hover">New to Optimum? Create an account</Link>
            </div>
            <Link to="/verify-email" className="mt-5 block text-center text-xs font-medium text-text-secondary transition hover:text-primary">
              Need a new verification email?
            </Link>
            <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-text-secondary">
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 p-1 text-emerald-700">
                <Check size={11} aria-hidden="true" />
              </span>
              Your sign-in is protected by secure session cookies.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function PreviewMetric({ icon: Icon, value, label }) {
  return (
    <div className="auth-preview-metric rounded-lg px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-blue-100">
        <Icon size={12} aria-hidden="true" />
        <span className="text-[11px] font-bold text-white">{value}</span>
      </div>
      <p className="mt-1 text-[10px] text-blue-100">{label}</p>
    </div>
  )
}
