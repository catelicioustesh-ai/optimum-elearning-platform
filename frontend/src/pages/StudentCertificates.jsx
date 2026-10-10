import { useEffect, useState } from 'react'
import { Award, Download, RotateCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

export default function StudentCertificates() {
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/engagement/me/')
      .then((data) => { if (!cancelled) setCertificates(data.certificates || []) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Certificates could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  async function download(certificate) {
    setError('')
    setDownloading(certificate.certificate_number)
    try {
      await api.download(
        `/engagement/certificates/${certificate.certificate_number}/download/`,
        `certificate-${certificate.certificate_number}.pdf`,
      )
    } catch (err) {
      setError(err.message || 'Certificate download failed.')
    } finally {
      setDownloading('')
    }
  }

  return (
    <StudentPage title="Certificates" description="View and download certificates issued for your completed courses.">
      {loading && <StudentPageMessage>Loading certificates…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          {error}
          <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}><RotateCw size={13} /> Try again</button>
        </StudentPageMessage>
      )}
      {!loading && !error && !certificates.length && (
        <section className="dg-card rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Award size={34} className="mx-auto text-blue-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-slate-900">Your certificates will appear here</h2>
          <p className="mt-1 text-sm text-slate-600">Complete the required work in an enrolled course to earn a certificate.</p>
          <Link to="/dashboard/student/courses" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">View my courses</Link>
        </section>
      )}
      {!loading && certificates.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-2">
          {certificates.map((certificate) => (
            <article key={certificate.certificate_number} className="dg-card overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="certificate-preview px-5 py-4">
                <div className="certificate-preview-inner">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em]">Certificate of completion</p>
                  <p className="mt-2 text-sm font-serif font-bold">{certificate.student_name}</p>
                  <p className="mt-1 max-w-full truncate text-xs">{certificate.course_title}</p>
                  <p className="mt-3 text-[9px]">Completed {new Date(certificate.completed_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-semibold text-slate-900">{certificate.course_title}</h2>
                  <p className="mt-1 text-xs text-slate-600">Issued {new Date(certificate.issued_at).toLocaleDateString()} · {certificate.status}</p>
                </div>
                {certificate.status === 'issued' && (
                  <button type="button" onClick={() => download(certificate)} disabled={downloading === certificate.certificate_number} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                    <Download size={15} aria-hidden="true" /> {downloading === certificate.certificate_number ? 'Preparing…' : 'Download PDF'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </StudentPage>
  )
}
