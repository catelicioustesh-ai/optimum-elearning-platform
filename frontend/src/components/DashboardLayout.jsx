import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { GlobalFx, ScrollProgress } from './fx.jsx'
import {
  Award,
  BadgeCheck,
  Bell,
  Bookmark,
  BookOpen,
  CalendarClock,
  Check,
  ClipboardList,
  ChevronDown,
  FileCheck,
  Flame,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Moon,
  Search,
  Settings,
  SunMedium,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import CommandPalette from './CommandPalette.jsx'
import Logo from './Logo.jsx'
import { api } from '../lib/api.js'
import { Link } from 'react-router-dom'
import ProfilePhoto from './ProfilePhoto.jsx'

const roleLabels = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
}

const goalLabels = {
  student: 'Course progress',
  instructor: 'Cohort on track',
  admin: 'Enrollment coverage',
}

const sharedNavItems = {
  student: [
    { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
    { to: '/dashboard/student/courses', label: 'My courses', icon: BookOpen, group: 'Learning' },
    { to: '/dashboard/student#learning-path', label: 'Learning path', icon: CalendarClock, anchor: 'learning-path', group: 'Learning', mobileVisible: false },
    { to: '/dashboard/student/assignments', label: 'Assignments', icon: ClipboardList, group: 'Learning', mobileVisible: false },
    { to: '/dashboard/student/grades', label: 'Grades', icon: GraduationCap, group: 'Learning' },
    { to: '/dashboard/student/achievements', label: 'Achievements', icon: Award, group: 'Recognition' },
    { to: '/dashboard/student/certificates', label: 'Certificates', icon: BadgeCheck, group: 'Recognition', mobileVisible: false },
    { to: '/dashboard/student/community', label: 'Community', icon: Users, group: 'Community' },
    { to: '/dashboard/student/resources', label: 'Resources', icon: Library, group: 'Community', mobileVisible: false },
    { to: '/dashboard/student/bookmarks', label: 'Bookmarks', icon: Bookmark, group: 'Personal', mobileVisible: false },
    { to: '/dashboard/student/notifications', label: 'Notifications', icon: Bell, group: 'Personal', mobileVisible: false },
    { to: '/dashboard/student/settings', label: 'Settings', icon: Settings, group: 'Personal', mobileVisible: false },
  ],
  instructor: [
    { to: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
    { to: '/dashboard/instructor/content', label: 'Course content', icon: BookOpen, group: 'Teaching' },
    { to: '/dashboard/instructor/submissions', label: 'Submissions', icon: FileCheck, group: 'Teaching' },
    { to: '/dashboard/instructor/students', label: 'Students', icon: Users, group: 'Teaching' },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard, end: true, group: 'Overview' },
    { to: '/dashboard/instructor/content', label: 'Courses & content', icon: BookOpen, group: 'Management' },
    { to: '/dashboard/instructor/submissions', label: 'Submissions', icon: FileCheck, group: 'Management' },
    { to: '/dashboard/instructor/students', label: 'Students', icon: Users, group: 'Management' },
  ],
}

export default function DashboardLayout({
  children,
  navItems = [],
  brandLabel = 'Optimum LMS',
  user = { name: '' },
  weeklyGoal = 0,
  studentHighlights = null,
  studentProfile: studentProfileProp = null,
  fetchStudentProfile = true,
  role: roleProp,
}) {
  const { logout } = useAuth()
  // Pages don't all pass `role`; default to the signed-in user's real role (was always 'student').
  const { auth } = useAuth()
  const role = roleProp || auth?.role || 'student'
  const { pathname, hash } = useLocation()
  const activeAnchor = hash.slice(1)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreNavOpen, setMoreNavOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [showAllNotifications, setShowAllNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationReload, setNotificationReload] = useState(0)
  const [studentEngagement, setStudentEngagement] = useState(null)
  const [studentEngagementError, setStudentEngagementError] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [studentProfile, setStudentProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const moreNavRef = useRef(null)

  useEffect(() => {
    if (role !== 'student' || !fetchStudentProfile) return undefined
    let cancelled = false
    api.me()
      .then((profile) => {
        if (!cancelled) setStudentProfile(profile)
      })
      .catch((error) => {
        if (!cancelled) setProfileError(error.message || 'Your registered name could not be loaded.')
      })
    return () => { cancelled = true }
  }, [role, fetchStudentProfile])

  useEffect(() => {
    if (role !== 'student' || !notifOpen || studentHighlights || studentEngagement) return undefined
    let cancelled = false
    api.get('/engagement/me/')
      .then((data) => {
        if (!cancelled) {
          setStudentEngagement(data)
          setStudentEngagementError('')
        }
      })
      .catch((error) => {
        if (!cancelled) setStudentEngagementError(error.message || 'Learning streak details are unavailable.')
      })
    return () => { cancelled = true }
  }, [notifOpen, role, studentEngagement, studentHighlights])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    function onNotificationsCountChanged(event) {
      const count = event.detail?.unreadCount
      if (Number.isInteger(count) && count >= 0) setUnreadCount(count)
    }
    window.addEventListener('engagement-notifications-count-changed', onNotificationsCountChanged)
    return () => window.removeEventListener('engagement-notifications-count-changed', onNotificationsCountChanged)
  }, [])

  useEffect(() => {
    const anchor = hash.slice(1)
    if (!anchor) return undefined
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hash, pathname])

  useEffect(() => {
    if (!moreNavOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setMoreNavOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = moreNavRef.current?.querySelectorAll('button:not(:disabled), a[href]')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    moreNavRef.current?.querySelector('button, a')?.focus()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moreNavOpen])

  useEffect(() => {
    const handler = () => setPaletteOpen(true)
    window.addEventListener('open-command-palette', handler)
    return () => window.removeEventListener('open-command-palette', handler)
  }, [])

  useEffect(() => {
    if (!notifOpen && role !== 'student') return undefined
    let cancelled = false
    function refreshNotifications() {
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
    }
    const timeoutId = window.setTimeout(refreshNotifications, notifOpen ? 0 : 1500)
    const intervalId = role === 'student'
      ? window.setInterval(refreshNotifications, 5 * 60 * 1000)
      : null
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [notifOpen, notificationReload, role])

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

  function scrollToSection(anchor) {
    const target = `/dashboard/student#${anchor}`
    if (pathname !== '/dashboard/student') {
      navigate(target)
      return
    }
    navigate(target)
  }

  const profile = studentProfileProp || studentProfile
  const engagementHighlights = studentHighlights || (studentEngagement ? {
    currentStreak: studentEngagement.current_streak,
    nextAchievement: studentEngagement.achievements
      .filter((item) => !item.earned_at)
      .sort((left, right) => right.progress_percent - left.progress_percent)[0] || null,
  } : null)
  const registeredName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  const displayName = role === 'student'
    ? registeredName || profile?.username || user.name || 'Student'
    : user.name
  const initials = (displayName || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const goalPercent = Math.min(100, Math.max(0, Number(weeklyGoal) || 0))
  const profileCompletePercent = profile
    ? Math.round(
      [profile.first_name, profile.last_name, profile.bio, profile.profile_photo]
        .filter(Boolean).length / 4 * 100,
    )
    : null
  const visibleNotifications = showAllNotifications ? notifications : notifications.slice(0, 5)
  const currentNavItems = sharedNavItems[role] || navItems
  const mobileNavItems = currentNavItems.filter((item) => item.mobileVisible !== false).slice(0, 5)

  function navigateToNavItem(item) {
    if (item.anchor) {
      scrollToSection(item.anchor)
      setMoreNavOpen(false)
      return
    }
    setMoreNavOpen(false)
  }

  function navItemIsActive(item, isActive) {
    return isActive || (
      item.to === '/dashboard/student/community'
      && pathname === '/dashboard/student/discussions'
    )
  }

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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={role} />
      <a className="dashboard-skip-link" href="#dashboard-main">Skip to main content</a>

      {/* Left Sidebar */}
      <aside className="dashboard-sidebar sticky top-0 z-10 hidden h-screen w-62.5 shrink-0 self-start overflow-hidden border-r border-slate-200 bg-white text-slate-700 lg:flex lg:flex-col shadow-[10px_0_30px_-18px_rgba(15,23,42,0.14)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <Logo tone="light" height={32} />
          {brandLabel && brandLabel !== 'Optimum LMS' && (
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{brandLabel}</div>
          )}
        </div>

        <nav aria-label="Primary navigation" className="student-sidebar-nav min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
          {currentNavItems.map((item, index) => (
            <div key={item.to} className="student-sidebar-nav-item">
              {item.group && item.group !== currentNavItems[index - 1]?.group && (
                <p className="px-3.5 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 first:pt-0">
                  {item.group}
                </p>
              )}
              {item.anchor ? (
                <button
                  type="button"
                  aria-current={activeAnchor === item.anchor ? 'location' : undefined}
                  onClick={() => scrollToSection(item.anchor)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                    activeAnchor === item.anchor
                      ? 'bg-blue-600 text-white shadow-[0_10px_20px_-8px_rgba(37,99,235,0.45)]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.to === '/dashboard/student/notifications' && unreadCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              ) : (
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                      isActive && !(item.end && hash)
                        ? 'bg-blue-600 text-white shadow-[0_10px_20px_-8px_rgba(37,99,235,0.45)]'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.to === '/dashboard/student/notifications' && unreadCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Progress & Avatar */}
        <div className="mt-auto shrink-0 border-t border-slate-200 px-3 py-4">
          <div className="mb-3 px-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>{goalLabels[role] || 'Progress'}</span>
              <span className="text-slate-700">{goalPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="dg-progress-fill h-full rounded-full bg-blue-600 transition-[width] duration-800"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
            <ProfilePhoto
              photoPath={profile?.profile_photo}
              className="h-9 w-9 rounded-full object-cover"
              fallback={initials.slice(0, 2)}
              fallbackClassName="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white shadow-sm"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{roleLabels[role] || 'User'}</div>
            </div>
          </div>
          {role === 'student' && profileCompletePercent !== null && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Profile completion</span><span>{profileCompletePercent}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-blue-600 transition-[width] duration-700" style={{ width: `${profileCompletePercent}%` }} />
              </div>
              <Link to="/dashboard/student/settings" className="mt-2 inline-flex text-xs font-semibold text-blue-800 hover:text-blue-950">
                {profileCompletePercent === 100 ? 'Edit profile' : 'Complete profile →'}
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main Area */}
      <div className="dashboard-content relative z-0 flex min-w-0 flex-1 flex-col bg-slate-100">
        <header className="dashboard-header relative z-50 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur-md sm:px-5">
          {/* Left: Quick Search */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search courses and labs"
              className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:px-3.5"
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
                <div className="absolute right-0 z-60 mt-2 max-h-[70vh] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-2xl backdrop-blur-xl">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</span>
                    {unreadCount > 0 && (
                      <button type="button" onClick={markAllNotificationsRead} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
                        <Check size={13} aria-hidden="true" /> Mark all read
                      </button>
                    )}
                  </div>
                  {role === 'student' && engagementHighlights && (
                    <Link
                      to="/dashboard/student/achievements"
                      onClick={() => setNotifOpen(false)}
                      className="mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 transition hover:bg-amber-100"
                    >
                      <Flame size={18} className="shrink-0 text-amber-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900">
                          {engagementHighlights.currentStreak} day streak
                        </span>
                        {engagementHighlights.nextAchievement && (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-600">
                            Next: {engagementHighlights.nextAchievement.name} ({engagementHighlights.nextAchievement.progress}/{engagementHighlights.nextAchievement.threshold})
                          </span>
                        )}
                      </span>
                      <Award size={15} className="shrink-0 text-amber-600" aria-hidden="true" />
                    </Link>
                  )}
                  {role === 'student' && studentEngagementError && (
                    <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
                      {studentEngagementError}
                    </p>
                  )}
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
                <ProfilePhoto
                  photoPath={profile?.profile_photo}
                  className="h-7 w-7 rounded-full object-cover"
                  fallback={initials.slice(0, 2)}
                  fallbackClassName="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
                />
                <span className="hidden text-xs font-semibold text-slate-700 sm:inline">{displayName}</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-80 mt-2 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white py-1.5 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs">
                    <div className="font-bold text-slate-900">{displayName}</div>
                    <div className="text-[10px] capitalize text-slate-500">{role} Account</div>
                  </div>
                  {profileError && role === 'student' && (
                    <p className="px-3 py-2 text-[10px] text-amber-800" role="status">
                      Showing the sign-in name because your registered profile could not be loaded.
                    </p>
                  )}
                  {role === 'student' && (
                    <Link
                      to="/dashboard/student/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Settings size={14} /> Profile settings
                    </Link>
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

        <main id="dashboard-main" tabIndex="-1" key={pathname} className="dashboard-main dg-page relative z-0 min-w-0 flex-1 bg-slate-50 p-4 pb-24 md:p-6 md:pb-24 lg:pb-6">{children}</main>
      </div>

      {moreNavOpen && (
        <div
          className="dashboard-more-backdrop lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMoreNavOpen(false)
          }}
        >
          <nav ref={moreNavRef} className="dashboard-more-sheet" aria-label="More navigation" aria-modal="true" role="dialog">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-sm font-bold text-slate-900">More</p>
                <p className="text-xs text-slate-500">{roleLabels[role] || 'Account'} navigation</p>
              </div>
              <button type="button" onClick={() => setMoreNavOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" aria-label="Close navigation menu">
                Close
              </button>
            </div>
            <div className="max-h-[min(65vh,32rem)] space-y-1 overflow-y-auto">
              {currentNavItems.filter((item) => !mobileNavItems.some((mobileItem) => mobileItem.to === item.to)).map((item) => (
                item.anchor ? (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigateToNavItem(item)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => navigateToNavItem(item)}
                    className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${navItemIsActive(item, isActive) ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800'}`}
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/dashboard/student/notifications' && unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                )
              ))}
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => { toggleTheme(); setMoreNavOpen(false) }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {theme === 'dark' ? <SunMedium size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                Switch to {theme === 'dark' ? 'light' : 'dark'} theme
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                <LogOut size={18} aria-hidden="true" /> Log out
              </button>
            </div>
          </nav>
        </div>
      )}

      <nav className="dashboard-mobile-nav lg:hidden" aria-label="Primary navigation">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `dashboard-mobile-nav-link${navItemIsActive(item, isActive) ? ' is-active' : ''}`}
          >
            <item.icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreNavOpen(true)}
          className={`dashboard-mobile-nav-link${moreNavOpen ? ' is-active' : ''}`}
          aria-expanded={moreNavOpen}
          aria-haspopup="dialog"
        >
          <Settings size={19} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}
