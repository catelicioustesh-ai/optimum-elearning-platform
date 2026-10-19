import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, Award, BookOpen, Check, Flame, Sparkles, TrendingUp, TriangleAlert } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import AuthBrand from '../components/AuthBrand.jsx'
import EmailInput from '../components/EmailInput.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { useToast } from '../hooks/useToast.js'
import { api } from '../lib/api.js'

const learningJourney = [
  { title: 'Learn', caption: 'Follow a guided path', icon: BookOpen },
  { title: 'Practice', caption: 'Build skills by doing', icon: Check },
  { title: 'Progress', caption: 'See how far you have come', icon: TrendingUp },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleButtonRef = useRef(null)
  const { login, establishSession } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  const microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim()
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim()
  const appleRedirectUri = import.meta.env.VITE_APPLE_REDIRECT_URI?.trim() || window.location.origin

  const finishSignIn = useCallback((session) => {
    toast('Signed in successfully.', 'success')

    const requestedPath = location.state?.from?.pathname
    const destination = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
      ? `${requestedPath}${location.state.from.search || ''}${location.state.from.hash || ''}`
      : `/dashboard/${session.role}`
    navigate(destination, { replace: true })
  }, [location.state, navigate, toast])

  const exchangeProviderCredential = useCallback(async (provider, credential, nonce) => {
    const result = await api.socialLogin(provider, credential, nonce)
    finishSignIn(establishSession(result?.user))
  }, [establishSession, finishSignIn])

  const authenticateWithProvider = useCallback(async (provider, acquireCredential, initialNonce) => {
    setError('')
    setLoading(true)
    try {
      const nonce = initialNonce || (await api.socialLoginNonce()).nonce
      const credential = await acquireCredential(nonce)
      if (!credential) throw new Error(`${provider} did not return a sign-in credential. Please try again.`)
      await exchangeProviderCredential(provider, credential, nonce)
    } catch (err) {
      setError(err.message || `${provider} sign-in could not be completed. Please try again.`)
    } finally {
      setLoading(false)
    }
  }, [exchangeProviderCredential])

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined
    let active = true
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')

    const renderButton = async () => {
      if (!active || !window.google?.accounts?.id || !googleButtonRef.current) return
      try {
        const { nonce } = await api.socialLoginNonce()
        if (!active || !googleButtonRef.current) return
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          nonce,
          callback: async (response) => {
            if (!response?.credential || !active) {
              if (active) setError('Google sign-in did not return a credential. Please try again.')
              return
            }
            await authenticateWithProvider('google', async () => response.credential, nonce)
            if (active) {
              googleButtonRef.current?.replaceChildren()
              await renderButton()
            }
          },
        })
        googleButtonRef.current.replaceChildren()
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rect',
          logo_alignment: 'left',
          width: Math.max(120, googleButtonRef.current.clientWidth || 120),
        })
      } catch (err) {
        if (active) setError(err.message || 'Google sign-in could not be prepared. Please try again.')
      }
    }

    if (window.google?.accounts?.id) {
      renderButton()
    } else {
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', () => { void renderButton() }, { once: true })
      script.addEventListener('error', () => {
        if (active) setError('Google sign-in could not be loaded. Check your connection or use your email and password.')
      }, { once: true })
    }

    return () => {
      active = false
    }
  }, [authenticateWithProvider, googleClientId])

  async function signInWithMicrosoft() {
    await authenticateWithProvider('microsoft', async (nonce) => {
      const { PublicClientApplication } = await import('@azure/msal-browser')
      const client = new PublicClientApplication({
        auth: {
          clientId: microsoftClientId,
          authority: 'https://login.microsoftonline.com/common',
        },
        cache: { cacheLocation: 'sessionStorage' },
      })
      await client.initialize()
      const result = await client.loginPopup({
        scopes: ['openid', 'profile', 'email'],
        nonce,
        prompt: 'select_account',
      })
      return result.idToken
    })
  }

  async function signInWithApple() {
    await authenticateWithProvider('apple', async (nonce) => {
      await loadAppleSignIn()
      window.AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: appleRedirectUri,
        state: crypto.randomUUID(),
        nonce,
        usePopup: true,
      })
      const result = await window.AppleID.auth.signIn()
      return result.authorization?.id_token
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Email is case-insensitive and may carry stray spaces; keep passwords untouched.
      const session = await login(email.trim().toLowerCase(), password)
      finishSignIn(session)
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

      <div className="login-card relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[30px] border border-border bg-surface md:min-h-[680px] md:grid-cols-2">
        <section className="auth-hero login-story hidden flex-col justify-between p-8 sm:p-10 md:flex lg:p-12" aria-label="Optimum LMS learning experience">
          <div className="login-orbit-icons" aria-hidden="true">
            <span className="login-orbit-icon login-orbit-icon--cyan"><Sparkles size={17} /></span>
            <span className="login-orbit-icon login-orbit-icon--violet"><Award size={17} /></span>
            <span className="login-orbit-icon login-orbit-icon--warm"><BookOpen size={17} /></span>
          </div>
          <div>
            <AuthBrand compact />

            <div className="mt-8">
              <span className="auth-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
                <Sparkles size={13} aria-hidden="true" /> Learning • Practice • Certification
              </span>
              <h2 className="mt-5 max-w-md text-4xl font-black leading-[1.08] tracking-tight text-white lg:text-[2.7rem]">
                Make your next step your <span className="auth-headline-highlight">best one.</span>
              </h2>
              <div className="login-handwritten" aria-hidden="true">
                Better<br />Skills<br />Brighter<br />You<span />
              </div>
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
          <div className="login-panel-note hidden lg:block" aria-hidden="true">
            <span>Same journey,</span>
            <strong>A brighter you.</strong>
            <i />
          </div>
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
                    <span>Signing you in…</span>
                    <span className="login-loading-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </>
                ) : (
                  <>Sign in securely <ArrowRight size={17} aria-hidden="true" /></>
                )}
              </button>
            </form>

            <div className="login-auth-divider my-6 flex items-center gap-3 text-[11px] font-medium text-text-secondary">
              <span aria-hidden="true" />
              <p>or continue with</p>
              <span aria-hidden="true" />
            </div>
            <div className="login-social-buttons" aria-busy={loading}>
              {googleClientId ? (
                <div ref={googleButtonRef} className="google-signin-button" aria-label="Continue with Google" />
              ) : (
                <button type="button" disabled className="social-provider-button" title="A Google Web Client ID must be configured by the site administrator.">
                  <GoogleMark /> Google
                </button>
              )}
              <button
                type="button"
                disabled={!microsoftClientId || loading}
                className="social-provider-button"
                onClick={() => void signInWithMicrosoft()}
                title={microsoftClientId ? 'Continue with Microsoft' : 'A Microsoft application client ID must be configured by the site administrator.'}
              >
                <MicrosoftMark /> Microsoft
              </button>
              <button
                type="button"
                disabled={!appleClientId || loading}
                className="social-provider-button"
                onClick={() => void signInWithApple()}
                title={appleClientId ? 'Continue with Apple' : 'An Apple Services ID must be configured by the site administrator.'}
              >
                <AppleMark /> Apple
              </button>
            </div>
            {(!googleClientId || !microsoftClientId || !appleClientId) && (
              <p className="mt-2 text-center text-[11px] text-text-secondary">
                Social sign-in methods are enabled when their OAuth client IDs are configured.
              </p>
            )}

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

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z" />
    </svg>
  )
}

function MicrosoftMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path fill="#f25022" d="M2 2h9v9H2z" />
      <path fill="#7fba00" d="M13 2h9v9h-9z" />
      <path fill="#00a4ef" d="M2 13h9v9H2z" />
      <path fill="#ffb900" d="M13 13h9v9h-9z" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
      <path fill="currentColor" d="M16.5 12.8c0-2 1.6-3 1.7-3.1-.9-1.4-2.3-1.6-2.8-1.6-1.2-.1-2.3.7-2.9.7s-1.5-.7-2.5-.7c-1.3 0-2.5.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2.1 2.4 2 1-.1 1.3-.6 2.5-.6s1.6.6 2.6.6 1.6-1 2.3-2 1-1.9 1-2c0 0-2-.8-2.1-3.3ZM14.5 6.7c.5-.6.9-1.4.8-2.2-.7 0-1.6.5-2.1 1.1-.5.5-1 1.3-.9 2.1.8.1 1.7-.4 2.2-1Z" />
    </svg>
  )
}

let appleSignInScriptPromise

function loadAppleSignIn() {
  if (window.AppleID?.auth) return Promise.resolve()
  if (!appleSignInScriptPromise) {
    appleSignInScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      script.async = true
      script.onload = () => window.AppleID?.auth
        ? resolve()
        : reject(new Error('Apple sign-in could not be initialized.'))
      script.onerror = () => reject(new Error('Apple sign-in could not be loaded. Check your connection and try again.'))
      document.head.appendChild(script)
    }).catch((err) => {
      appleSignInScriptPromise = null
      throw err
    })
  }
  return appleSignInScriptPromise
}
