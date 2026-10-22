import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  LayoutDashboard,
  Search,
  UserCheck,
  Users,
} from 'lucide-react'

import DashboardLayout from '../components/DashboardLayout.jsx'
import { useAuth } from '../context/useAuth.js'
import { useToast } from '../hooks/useToast.js'
import { api } from '../lib/api.js'

const navItems = [
  { to: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/admin/accounts', label: 'Account review', icon: UserCheck },
  { to: '/dashboard/instructor/content', label: 'Courses & content', icon: BookOpen },
  { to: '/dashboard/instructor/submissions', label: 'Submissions', icon: FileCheck },
  { to: '/dashboard/instructor/students', label: 'Students', icon: Users },
]

const statusLabels = {
  pending_email_verification: 'Pending email verification',
  pending_admin_approval: 'Pending approval',
  suspended: 'Suspended',
  active: 'Active',
}

const methodLabels = {
  self_verified: 'Verified by user email link',
  provider_verified: 'Verified by identity provider',
  admin_verified: 'Administratively verified',
  operator_override: 'Operator override',
  legacy: 'Legacy verification (method unknown)',
}

export default function AdminAccounts() {
  const { auth } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [verified, setVerified] = useState('')
  const [accountStatus, setAccountStatus] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [listState, setListState] = useState({ requestKey: '', result: null, error: '' })
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionId, setActionId] = useState(null)

  const params = new URLSearchParams({ page: String(page) })
  if (search.trim()) params.set('search', search.trim())
  if (role) params.set('role', role)
  if (verified) params.set('email_verified', verified)
  if (accountStatus) params.set('status', accountStatus)
  const query = params.toString()
  const requestKey = `${query}:${reloadKey}`

  useEffect(() => {
    let active = true
    api.get(`/dashboard/admin/accounts/?${query}`)
      .then((data) => {
        if (active) setListState({ requestKey, result: data, error: '' })
      })
      .catch((err) => {
        if (active) setListState({
          requestKey,
          result: null,
          error: err.message || 'Unable to load accounts.',
        })
      })

    return () => { active = false }
  }, [query, requestKey])

  async function showAccount(accountId) {
    setDetailLoading(true)
    try {
      setSelected(await api.get(`/dashboard/admin/accounts/${accountId}/`))
    } catch (err) {
      toast(err.message || 'Unable to load account details.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  async function verifyAccount(account) {
    const name = account.full_name || account.username
    if (!window.confirm(`Administratively verify ${name}'s email address? This records that an administrator performed the verification; it does not mean the user completed an email challenge.`)) {
      return
    }

    setActionId(account.id)
    try {
      await api.post(`/dashboard/admin/accounts/${account.id}/verify-email/`, {})
      toast(`${name}'s email was administratively verified.`, 'success')
      setReloadKey((current) => current + 1)
      if (selected?.id === account.id) await showAccount(account.id)
    } catch (err) {
      toast(err.message || 'Unable to verify this account.', 'error')
    } finally {
      setActionId(null)
    }
  }

  async function approveAccount(account) {
    const name = account.full_name || account.username
    if (!window.confirm(`Approve this ${account.role} registration for ${name}? They will be able to sign in after approval.`)) {
      return
    }

    setActionId(account.id)
    try {
      await api.post(`/dashboard/admin/accounts/${account.id}/approve/`, {})
      toast(`${name}'s ${account.role} account was approved.`, 'success')
      setReloadKey((current) => current + 1)
      if (selected?.id === account.id) await showAccount(account.id)
    } catch (err) {
      toast(err.message || 'Unable to approve this account.', 'error')
    } finally {
      setActionId(null)
    }
  }

  const loading = listState.requestKey !== requestKey
  const result = loading ? null : listState.result
  const error = loading ? '' : listState.error
  const accounts = result?.results || []
  const pageCount = Math.max(1, Math.ceil((result?.count || 0) / 25))

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Admin' }} role="admin">
      <Helmet>
        <title>Account review — Optimum LMS</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <section className="space-y-6" data-role="admin">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration</p>
          <h1 className="mt-2 text-3xl font-bold text-text-primary">Account review</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Review learner and instructor registrations. Verify email ownership and approve platform access as separate decisions.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_150px_170px_180px]">
              <label className="relative block">
                <span className="sr-only">Search accounts</span>
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => { setPage(1); setSearch(event.target.value) }}
                  placeholder="Search email, name, username"
                  className="w-full rounded-xl border border-border bg-surface-muted py-2.5 pl-10 pr-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="sr-only" htmlFor="account-role-filter">Filter by role</label>
              <select
                id="account-role-filter"
                value={role}
                onChange={(event) => { setPage(1); setRole(event.target.value) }}
                className="rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-text-primary"
              >
                <option value="">All roles</option>
                <option value="student">Learners</option>
                <option value="instructor">Instructors</option>
              </select>
              <label className="sr-only" htmlFor="account-verification-filter">Filter by email verification</label>
              <select
                id="account-verification-filter"
                value={verified}
                onChange={(event) => { setPage(1); setVerified(event.target.value) }}
                className="rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-text-primary"
              >
                <option value="">All verification states</option>
                <option value="true">Email verified</option>
                <option value="false">Email not verified</option>
              </select>
              <label className="sr-only" htmlFor="account-status-filter">Filter by registration status</label>
              <select
                id="account-status-filter"
                value={accountStatus}
                onChange={(event) => { setPage(1); setAccountStatus(event.target.value) }}
                className="rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-text-primary"
              >
                <option value="">All registration statuses</option>
                <option value="pending_email_verification">Needs email verification</option>
                <option value="pending_admin_approval">Needs approval</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
            {loading && <p className="mt-5 text-sm text-text-secondary" role="status">Loading accounts…</p>}
            {!loading && !error && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                      <th className="px-3 py-3 font-semibold">Account</th>
                      <th className="px-3 py-3 font-semibold">Role</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Email verification</th>
                      <th className="px-3 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-4">
                          <button type="button" onClick={() => void showAccount(account.id)} className="text-left">
                            <span className="block font-semibold text-text-primary hover:text-primary">{account.full_name || account.username}</span>
                            <span className="block text-xs text-text-secondary">{account.email}</span>
                          </button>
                        </td>
                        <td className="px-3 py-4 capitalize text-text-secondary">{account.role}</td>
                        <td className="px-3 py-4">
                          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-primary">
                            {statusLabels[account.status] || account.status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-xs text-text-secondary">
                          {account.email_verified ? methodLabels[account.email_verification_method] || 'Verified' : 'Not verified'}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="flex justify-end gap-2">
                          {!account.email_verified && (
                            <button
                              type="button"
                              disabled={actionId !== null}
                              onClick={() => void verifyAccount(account)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-blue-50 disabled:opacity-50"
                            >
                              <UserCheck size={14} aria-hidden="true" />
                              {actionId === account.id ? 'Verifying…' : 'Verify email'}
                            </button>
                          )}
                          {account.email_verified && !account.is_approved && (
                            <button
                              type="button"
                              disabled={actionId !== null}
                              onClick={() => void approveAccount(account)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                            >
                              <Check size={14} aria-hidden="true" />
                              {actionId === account.id ? 'Approving…' : 'Approve'}
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {accounts.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-text-secondary">No matching accounts found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
              <span>{result?.count ?? 0} account{result?.count === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-border p-2 disabled:opacity-40" aria-label="Previous page">
                  <ChevronLeft size={16} />
                </button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border p-2 disabled:opacity-40" aria-label="Next page">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">Account details</h2>
            {detailLoading && <p className="mt-4 text-sm text-text-secondary" role="status">Loading account details…</p>}
            {!selected && !detailLoading && <p className="mt-3 text-sm text-text-secondary">Select an account to view its verification history.</p>}
            {selected && !detailLoading && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-semibold text-text-primary">{selected.full_name || selected.username}</p>
                  <p className="text-sm text-text-secondary">{selected.email}</p>
                  <p className="mt-1 text-xs capitalize text-text-secondary">{selected.role} · {statusLabels[selected.status]}</p>
                </div>
                <dl className="space-y-2 border-y border-border py-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-text-secondary">Email status</dt><dd className="text-right text-text-primary">{selected.email_verified ? methodLabels[selected.email_verification_method] || 'Verified' : 'Pending'}</dd></div>
                  {selected.email_verified_by && <div className="flex justify-between gap-3"><dt className="text-text-secondary">Verified by</dt><dd className="text-right text-text-primary">{selected.email_verified_by}</dd></div>}
                  <div className="flex justify-between gap-3"><dt className="text-text-secondary">Verified at</dt><dd className="text-right text-text-primary">{selected.email_verified_at ? new Date(selected.email_verified_at).toLocaleString() : '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-text-secondary">Registered</dt><dd className="text-right text-text-primary">{new Date(selected.date_joined).toLocaleDateString()}</dd></div>
                </dl>
                {!selected.email_verified && (
                  <button type="button" disabled={actionId !== null} onClick={() => void verifyAccount(selected)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
                    <Check size={16} /> Administratively verify email
                  </button>
                )}
                {selected.email_verified && !selected.is_approved && (
                  <button type="button" disabled={actionId !== null} onClick={() => void approveAccount(selected)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
                    <UserCheck size={16} /> Approve {selected.role} registration
                  </button>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Verification and approval history</h3>
                  <ol className="mt-2 space-y-2">
                    <li className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-secondary">
                      {selected.email_verified
                        ? `${methodLabels[selected.email_verification_method] || 'Email verified'}${selected.email_verified_at ? ` · ${new Date(selected.email_verified_at).toLocaleString()}` : ''}`
                        : 'Email verification is pending'}
                    </li>
                    {(selected.verification_history || []).map((event, index) => (
                      <li key={`${event.action}-${event.created_at}-${index}`} className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-secondary">
                        {event.action.replaceAll('_', ' ')}{event.actor ? ` by ${event.actor}` : ''} · {new Date(event.created_at).toLocaleString()}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </DashboardLayout>
  )
}
