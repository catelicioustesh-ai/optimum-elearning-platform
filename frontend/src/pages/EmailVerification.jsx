import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api } from '../lib/api.js'
import Logo from '../components/Logo.jsx'
import EmailInput from '../components/EmailInput.jsx'

/** /verify-email?uid=…&token=… (link from the email)  —  /verify-email alone = "send me a new link". */
export default function EmailVerification() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')
  const hasLink = Boolean(uid && token)
  const [status, setStatus] = useState(hasLink ? 'loading' : 'request')
  const registered = location.state?.registered === true
  const verificationEmailSent = location.state?.verificationEmailSent === true
  const accountRole = location.state?.accountRole === 'instructor' ? 'instructor' : 'learner'
  const [message, setMessage] = useState(
    hasLink
      ? 'Verifying your email…'
      : registered
        ? verificationEmailSent
        ? `Your ${accountRole} account was created. Check your inbox and verify your email before signing in.`
        : `Your ${accountRole} account was created, but the verification email could not be sent. Request another email below before signing in.`
        : 'Enter your email and we’ll send you a new verification link.',
  )
  const [email, setEmail] = useState(location.state?.email || '')
  const [resendState, setResendState] = useState('')
  const [resending, setResending] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!hasLink || started.current) return // React StrictMode runs effects twice; the link is single-use
    started.current = true
    api.verifyEmail(uid, token)
      .then((result) => { setStatus('verified'); setMessage(result.detail) })
      .catch((error) => {
        setStatus('invalid')
        setMessage(`${error.message || 'This verification link is invalid or has expired.'} Links last 24 hours and work once. If you already verified, just sign in.`)
      })
  }, [hasLink, uid, token])

  async function handleResend(event) {
    event.preventDefault()
    setResending(true)
    setResendState('')
    try {
      const result = await api.resendVerification(email.trim().toLowerCase())
      setResendState(result.detail)
    } catch (error) {
      setResendState(error.status === 429 ? 'Too many requests. Please wait a while and try again.' : error.message || 'Unable to request a verification link right now.')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-4 py-10 text-text-primary" data-role={accountRole}>
      <Helmet><title>Verify email — Optimum LMS</title></Helmet>
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-8"><Logo tone="light" height={34} /></div>
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="mt-3 text-sm text-text-secondary" role="status">{message}</p>

        {status === 'verified' && (
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Continue to sign in <ArrowRight size={16} />
          </Link>
        )}

        {(status === 'invalid' || status === 'request') && (
          <form onSubmit={handleResend} className="mt-6 space-y-3">
            <EmailInput id="verification-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={resending} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {resending ? 'Sending…' : 'Send verification email'}
            </button>
            {resendState && <p className="text-sm text-text-secondary" role="status">{resendState}</p>}
          </form>
        )}

        <Link to="/login" className="mt-6 block text-sm font-semibold text-primary hover:text-primary-hover">Back to sign in</Link>
      </section>
    </main>
  )
}
