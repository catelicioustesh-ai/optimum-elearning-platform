import { Helmet } from 'react-helmet-async'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CircleCheckBig,
  Sparkles,
  Users,
} from 'lucide-react'
import Logo from './components/Logo.jsx'
import { Link } from 'react-router-dom'

const SITE_URL = window.location.origin

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
    title: 'Focused by design',
    text: 'Learners, instructors, and administrators each get clear tools and a workspace shaped around their work.',
  },
]

export default function Landing() {
  return (
    <div className="landing-page min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Optimum ERP LMS</title>
        <meta
          name="description"
          content="A secure learning workspace for students, instructors, and administrators."
        />
        <link rel="canonical" href={SITE_URL} />
      </Helmet>

      <header className="landing-header border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link to="/" aria-label="Optimum LMS home"><Logo tone="light" height={36} /></Link>

          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link to="/register" className="hidden rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex">
              Create an account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-white shadow-sm transition hover:bg-blue-600"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero mx-4 mt-4 md:mx-6 lg:mx-8">
          <div className="landing-hero-content mx-auto w-full max-w-5xl px-6 py-14 text-center sm:py-16 lg:px-10 lg:py-20">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                <Sparkles size={12} />
                A brighter way to grow
              </div>

              <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tighter text-slate-900 md:text-6xl">
                Make your next step your <span>best one.</span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                Learn new skills, put them into practice, and keep your progress moving. Optimum LMS brings your courses,
                activities, and achievements together in one focused space.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/login"
                  className="landing-primary"
                >
                  Sign in to your workspace
                  <ArrowRight size={17} />
                </Link>
                <Link to="/register" className="text-sm font-semibold text-slate-700 transition hover:text-slate-900">
                  New to Optimum? Register as a learner or instructor
                </Link>
              </div>

              <div className="landing-hero-benefits mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig size={16} className="text-emerald-400" />
                  Structured courses
                </span>
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig size={16} className="text-emerald-400" />
                  One secure sign-in
                </span>
                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig size={16} className="text-emerald-400" />
                  Progress that moves with you
                </span>
              </div>
          </div>
        </section>

        <section className="landing-workspace mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">One sign-in. Your space.</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                The right tools, right where you need them.
              </h2>
            </div>
          </div>

          <div className="landing-role-callout mt-8 flex flex-col gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-cyan-200">
                <Users size={23} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">No role to choose. Just sign in.</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-100">
                  Optimum detects the role on your account and opens the matching workspace automatically.
                </p>
              </div>
            </div>
            <Link to="/login" className="landing-primary shrink-0">
              Go to sign in <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">A better learning rhythm</p>
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
          <span>One secure sign-in · Your workspace, automatically</span>
        </div>
      </footer>
    </div>
  )
}
