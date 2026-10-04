import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { Award, CheckCircle2, XCircle } from 'lucide-react'

import { api } from '../lib/api.js'

function formattedDate(value) {
  if (!value) return 'Not available'
  const dateOnly = value.slice(0, 10).split('-').map(Number)
  if (dateOnly.length !== 3 || dateOnly.some((part) => !Number.isFinite(part))) return 'Not available'
  return new Date(dateOnly[0], dateOnly[1] - 1, dateOnly[2]).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function CertificateVerification() {
  const { certificateNumber } = useParams()
  const [certificate, setCertificate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    api.verifyCertificate(certificateNumber)
      .then((result) => {
        if (!cancelled) setCertificate(result)
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.status === 404
            ? 'No certificate with this ID was found.'
            : 'We could not verify this certificate right now. Please try again later.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [certificateNumber])

  const verified = certificate?.verified === true

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Helmet>
        <title>Certificate Verification — Optimum LMS</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Award size={25} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Optimum LMS</p>
            <p className="text-xs text-slate-500">Certificate verification</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-10 text-sm text-slate-600" role="status">Checking certificate authenticity...</p>
        ) : error ? (
          <div className="mt-10 rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
            <div className="flex items-center gap-2 font-semibold text-rose-800">
              <XCircle size={19} aria-hidden="true" /> Certificate not verified
            </div>
            <p className="mt-2 text-sm text-rose-700">{error}</p>
          </div>
        ) : (
          <>
            <div className={`mt-10 rounded-xl border p-5 ${verified ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`} role="status">
              <div className={`flex items-center gap-2 font-semibold ${verified ? 'text-emerald-800' : 'text-rose-800'}`}>
                {verified
                  ? <CheckCircle2 size={19} aria-hidden="true" />
                  : <XCircle size={19} aria-hidden="true" />}
                {verified ? 'Authentic certificate' : 'Certificate is not valid'}
              </div>
              <p className={`mt-2 text-sm ${verified ? 'text-emerald-700' : 'text-rose-700'}`}>
                {verified
                  ? 'This certificate was issued by Optimum LMS and is currently valid.'
                  : 'This certificate has been revoked and is no longer valid.'}
              </p>
            </div>

            <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Learner</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{certificate.student_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{certificate.course_title}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed on</dt>
                <dd className="mt-1 text-sm text-slate-800">{formattedDate(certificate.completed_on)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Certificate ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-800">{certificate.certificate_number}</dd>
              </div>
            </dl>
          </>
        )}

        <Link to="/" className="mt-9 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900">
          Return to Optimum LMS
        </Link>
      </section>
    </main>
  )
}
