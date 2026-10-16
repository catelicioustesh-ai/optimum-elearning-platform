import { useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import StudentPage, { StudentPageMessage } from '../components/StudentPage.jsx'
import { api } from '../lib/api.js'

export default function StudentNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/engagement/notifications/')
      .then((data) => {
        if (cancelled) return
        setNotifications(data.results || [])
        setUnreadCount(data.unread_count || 0)
        window.dispatchEvent(new CustomEvent('engagement-notifications-count-changed', {
          detail: { unreadCount: data.unread_count || 0 },
        }))
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Notifications could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  async function markRead(notification) {
    if (!notification.unread) return
    setError('')
    try {
      const updated = await api.patch(`/engagement/notifications/${notification.id}/read/`)
      setNotifications((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated, unread: false } : item))
      const nextUnreadCount = Math.max(0, unreadCount - 1)
      setUnreadCount(nextUnreadCount)
      window.dispatchEvent(new CustomEvent('engagement-notifications-count-changed', {
        detail: { unreadCount: nextUnreadCount },
      }))
    } catch (err) {
      setError(err.message || 'Notification could not be marked as read.')
    }
  }

  async function markAllRead() {
    setError('')
    try {
      await api.post('/engagement/notifications/read-all/')
      setNotifications((items) => items.map((item) => ({ ...item, unread: false, read_at: item.read_at || new Date().toISOString() })))
      setUnreadCount(0)
      window.dispatchEvent(new CustomEvent('engagement-notifications-count-changed', {
        detail: { unreadCount: 0 },
      }))
    } catch (err) {
      setError(err.message || 'Notifications could not be marked as read.')
    }
  }

  return (
    <StudentPage title="Notifications" description="Course reminders, learning updates, and achievement notices.">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-950">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</p>
          <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:text-blue-950">
            <CheckCheck size={16} aria-hidden="true" /> Mark all read
          </button>
        </div>
      )}
      {loading && <StudentPageMessage>Loading notifications…</StudentPageMessage>}
      {error && (
        <StudentPageMessage tone="error">
          {error}
          <button type="button" className="ml-3 inline-flex items-center gap-1 font-semibold underline" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}><RotateCw size={13} /> Try again</button>
        </StudentPageMessage>
      )}
      {!loading && !error && !notifications.length && <StudentPageMessage>You're all caught up. New reminders and learning updates will appear here.</StudentPageMessage>}
      {!loading && notifications.length > 0 && (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification.id} className={`dg-card flex gap-3 rounded-2xl border p-4 ${notification.unread ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white'}`}>
              <span className={`mt-0.5 rounded-xl p-2 ${notification.unread ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><Bell size={17} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{notification.title}</h2>
                  <time className="text-xs text-slate-500" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
                </div>
                <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {notification.url && (
                    <Link to={notification.url} onClick={() => markRead(notification)} className="text-sm font-semibold text-blue-800 hover:underline">Open related page</Link>
                  )}
                  {notification.unread && (
                    <button type="button" onClick={() => markRead(notification)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                      <Check size={14} aria-hidden="true" /> Mark read
                    </button>
                  )}
                </div>
              </div>
              {notification.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
            </li>
          ))}
        </ul>
      )}
    </StudentPage>
  )
}
