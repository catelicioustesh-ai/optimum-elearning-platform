import { Helmet } from 'react-helmet-async'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CircleCheckBig,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import Logo from './components/Logo.jsx'
import { Link } from 'react-router-dom'

const SITE_URL = window.location.origin

const stats = [
  { value: 'Courses', label: 'database-backed learning' },
  { value: 'Progress', label: 'server-tracked milestones' },
  { value: 'Roles', label: 'student, instructor, administrator' },
]

const workspaces = [
  {
    title: 'Student',
    description: 'Continue lessons, submit lab work, and keep momentum with guided progress tracking.',
    icon: GraduationCap,
  },
  {
    title: 'Instructor',
    description: 'Manage curriculum, review submissions, and guide learners through each module.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Administrator',
    description: 'Monitor platform health, manage enrollments, and keep the learning ecosystem running.',
    icon: ShieldCheck,
  },
]

const highlights = [
  {
    icon: BookOpen,
    title: 'Structured learning journeys',
    text: 'Every course is broken into clear modules, labs, and assessments so students know what to do next.',
  },
  {
    icon: BarChart3,
    title: 'Progress visibility',
    text: 'Learners and instructors can quickly see what is complete, due, and ready for feedback.',
  },
  {
    icon: Users,
    title: 'Role-aware workflows',
    text: 'Students, teachers, and admins see only the tools and data relevant to their account.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-role="student">
      <Helmet>
        <title>Optimum ERP LMS</title>
        <meta
          name="description"
          content="A secure learning workspace for students, instructors, and administrators."
        />
        <link rel="canonical" href={SITE_URL} />
      </Helmet>

      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link to="/" aria-label="Optimum LMS home"><Logo tone="light" height={36} /></Link>

          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link to="/register" className="hidden rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex">
              Create account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-white shadow-sm transition hover:bg-blue-600"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero mx-4 mt-4 md:mx-6 lg:mx-8">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-0 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-0 lg:py-8">
            <div className="dg-grow">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                <Sparkles size={12} />
                Learning workspace
              </div>

              <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-tighter text-slate-900 md:text-6xl">
                One secure place to learn, teach, and manage.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-8 text-slate-600 md:text-lg">
                Optimum LMS gives students a clear path through each course, helps instructors guide progress,
                and gives admins an operational view of the entire learning platform.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="landing-primary"
                >
                  Sign in
                  <ArrowRight size={17} />
                </Link>
                <Link to="/register" className="text-sm font-semibold text-slate-700 transition hover:text-slate-900">
                  Create a student account
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig size={16} className="text-emerald-400" />
                  Structured courses
                </span>
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig size={16} className="text-emerald-400" />
                  Role-based access
                </span>
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig size={16} className="text-emerald-400" />
                  Real-time progress
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-blue-100">
              <div className="rounded-2xl bg-white p-5 text-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform overview</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight">Learning at a glance</h2>
                  </div>
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                    <BookOpen size={22} />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                      <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    ['Course catalog', 'Browse instructor-published courses'],
                    ['Progress tracking', 'Required work unlocks the next module'],
                    ['Assessments', 'Submit labs and complete quizzes'],
                  ].map(([title, description]) => (
                    <div key={title} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                      <CircleCheckBig size={17} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-slate-800">{title}</p>
                        <p className="mt-1 text-xs text-slate-500">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Your workspace</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Built for the way people actually learn.
              </h2>
            </div>
            <span className="text-sm text-slate-500">Access is controlled by the role attached to your account.</span>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {workspaces.map(({ title, description, icon: Icon }) => (
              <Link
                key={title}
                to="/login"
                className="dg-card group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <Icon size={22} />
                </span>
                <h3 className="mt-6 text-xl font-bold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  Go to sign in
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Why learners stay engaged</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Clear structure. Better momentum. Better outcomes.
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {highlights.map(({ icon: Icon, title, text }) => (
                <div key={title} className="dg-card rounded-3xl border border-slate-200 bg-slate-50 p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-6 text-xl font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span className="font-semibold text-slate-900">Optimum ERP LMS</span>
          <span>Secure role-based access</span>
        </div>
      </footer>
    </div>
  )
}
