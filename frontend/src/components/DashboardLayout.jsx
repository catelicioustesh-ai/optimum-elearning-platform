import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { GlobalFx, ScrollProgress } from './fx.jsx'
import { Bell, Check, ChevronDown, LogOut, Search, SunMedium, Moon } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import CommandPalette from './CommandPalette.jsx'
import Logo from './Logo.jsx'
import { api } from '../lib/api.js'

const roleLabels = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
}

const goalLabels = {
  student: 'Overall progress',
  instructor: 'Cohort on track',
  admin: 'Enrollment coverage',
}

export default function DashboardLayout({
  children,
  navItems = [],
  brandLabel = 'Optimum LMS',
  user = { name: '' },
  weeklyGoal = 0,
  role: roleProp,
}) {
  const { logout } = useAuth()
  // Pages don't all pass `role`; default to the signed-in user's real role (was always 'student').
  const { auth } = useAuth()
  const role = roleProp || auth?.role || 'student'
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [showAllNotifications, setShowAllNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationReload, setNotificationReload] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [studentProfile, setStudentProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const menuRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    if (role !== 'student') return undefined
    let cancelled = false
    api.me()
      .then((profile) => {
        if (!cancelled) setStudentProfile(profile)
      })
      .catch((error) => {
        if (!cancelled) setProfileError(error.message || 'Your registered name could not be loaded.')
      })
    return () => { cancelled = true }
  }, [role])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const handler = () => setPaletteOpen(true)
    window.addEventListener('open-command-palette', handler)
    return () => window.removeEventListener('open-command-palette', handler)
  }, [])

  useEffect(() => {
    if (!notifOpen) return undefined
    let cancelled = false
    api.get('/engagement/notifications/')
      .then((result) => {
        if (cancelled) return
        setNotifications(result.results || [])
        setUnreadCount(result.unread_count || 0)
      })
      .catch((error) => {
        if (!cancelled) setNotificationsError(error.message || 'Notifications are unavailable.')
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false)
      })
    return () => { cancelled = true }
  }, [notifOpen, notificationReload])

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const registeredName = `${studentProfile?.first_name || ''} ${studentProfile?.last_name || ''}`.trim()
  const displayName = role === 'student'
    ? registeredName || studentProfile?.username || user.name || 'Student'
    : user.name
  const initials = (displayName || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const goalPercent = Math.min(100, Math.max(0, Number(weeklyGoal) || 0))
  const visibleNotifications = showAllNotifications ? notifications : notifications.slice(0, 5)

  async function openNotification(notification) {
    if (notification.unread) {
      try {
        const updated = await api.patch(`/engagement/notifications/${notification.id}/read/`)
        setNotifications((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated, unread: false } : item))
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch (error) {
        setNotificationsError(error.message || 'Unable to update notification.')
        return
      }
    }
    setNotifOpen(false)
    if (notification.url) navigate(notification.url)
  }

  async function markAllNotificationsRead() {
    try {
      await api.post('/engagement/notifications/read-all/')
      setNotifications((items) => items.map((item) => ({ ...item, unread: false, read_at: item.read_at || new Date().toISOString() })))
      setUnreadCount(0)
    } catch (error) {
      setNotificationsError(error.message || 'Unable to update notifications.')
    }
  }

  return (
    <div className="dashboard-shell relative flex min-h-screen overflow-visible bg-slate-100 text-slate-900" data-role={role}>
      <div className="dg-aurora" aria-hidden="true" />
      <ScrollProgress />
      <GlobalFx />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <a className="dashboard-skip-link" href="#dashboard-main">Skip to main content</a>

      {/* Left Sidebar */}
      <aside className="dashboard-sidebar relative z-10 hidden w-62.5 shrink-0 border-r border-slate-200 bg-white text-slate-700 md:flex md:flex-col shadow-[10px_0_30px_-18px_rgba(15,23,42,0.14)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <Logo tone="light" height={32} />
          {brandLabel && brandLabel !== 'Optimum LMS' && (
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{brandLabel}</div>
          )}
        </div>

        <nav aria-label="Primary navigation" className="flex-1 space-y-1.5 px-3 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-[0_10px_20px_-8px_rgba(37,99,235,0.7)]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon size={18} strokeWidth={2.2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Progress & Avatar */}
        <div className="mt-auto border-t border-slate-200 px-3 py-4">
          <div className="mb-3 px-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>{goalLabels[role] || 'Progress'}</span>
              <span className="text-slate-700">{goalPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-linear-to-r from-blue-500 to-emerald-400 transition-[width] duration-700"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-tr from-blue-600 to-blue-600 text-xs font-bold text-white shadow-sm">
              {initials.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{roleLabels[role] || 'User'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="dashboard-content relative z-0 flex min-w-0 flex-1 flex-col bg-slate-100">
        <header className="dashboard-header relative z-50 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur-md">
          {/* Left: Quick Search */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search courses and labs"
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search courses, labs...</span>
              <kbd className="hidden sm:inline rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
            </button>
          </div>

          {/* Right: Theme, Notifications, Profile */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  if (!notifOpen) {
                    setNotificationsLoading(true)
                    setNotificationsError('')
                  }
                  setNotifOpen((value) => !value)
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white" aria-label={`${unreadCount} unread`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-60 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-2xl backdrop-blur-xl">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</span>
                    {unreadCount > 0 && (
                      <button type="button" onClick={markAllNotificationsRead} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
                        <Check size={13} aria-hidden="true" /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {notificationsLoading && (
                      <p className="px-4 py-6 text-center text-sm text-slate-500" role="status">Loading notifications...</p>
                    )}
                    {!notificationsLoading && notificationsError && (
                      <div className="px-3 py-4 text-center" role="alert">
                        <p className="text-xs text-rose-700">{notificationsError}</p>
                        <button type="button" onClick={() => { setNotificationsLoading(true); setNotificationsError(''); setNotificationReload((value) => value + 1) }} className="mt-2 text-xs font-semibold text-blue-700">Retry</button>
                      </div>
                    )}
                    {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-slate-500">You’re all caught up.</p>
                    )}
                    {!notificationsLoading && !notificationsError && visibleNotifications.map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        onClick={() => openNotification(notification)}
                        className={`block w-full rounded-xl border p-2.5 text-left transition hover:bg-slate-100 ${notification.unread ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{notification.title}</span>
                          {notification.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                          <time className="shrink-0 text-[10px] text-slate-500" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleDateString()}</time>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-600">{notification.message}</span>
                      </button>
                    ))}
                    {!notificationsLoading && !notificationsError && notifications.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllNotifications((value) => !value)}
                        className="w-full rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        {showAllNotifications ? 'Show fewer' : `View all ${notifications.length} notifications`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative z-70" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition hover:bg-slate-100"
                aria-expanded={menuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-tr from-blue-600 to-blue-600 text-[10px] font-bold text-white">
                  {initials.slice(0, 2)}
                </span>
                <span className="hidden text-xs font-semibold text-slate-700 sm:inline">{displayName}</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-80 mt-2 w-48 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs">
                    <div className="font-bold text-slate-900">{displayName}</div>
                    <div className="text-[10px] capitalize text-slate-500">{role} Account</div>
                  </div>
                  {profileError && role === 'student' && (
                    <p className="px-3 py-2 text-[10px] text-amber-800" role="status">
                      Showing the sign-in name because your registered profile could not be loaded.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="dashboard-main" tabIndex="-1" key={pathname} className="dashboard-main dg-page relative z-0 min-w-0 flex-1 bg-slate-50 p-4 pb-24 md:p-6">{children}</main>
      </div>

      <nav className="dashboard-mobile-nav md:hidden" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `dashboard-mobile-nav-link${isActive ? ' is-active' : ''}`}
          >
            <item.icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
