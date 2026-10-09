import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, Link } from 'react-router-dom'
import { LayoutDashboard, BookOpen, GraduationCap, CircleCheckBig, CircleX } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'

const navItems = [
  { to: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/student/courses', label: 'My Courses', icon: BookOpen },
  { to: '/dashboard/student/grades', label: 'Grades', icon: GraduationCap },
]

export default function QuizTake() {
  const { quizId } = useParams()
  const { auth } = useAuth()
  const draftKey = `optimum-lms:quiz-draft:${encodeURIComponent(auth?.email?.toLowerCase() || 'guest')}:${quizId}`
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [draftLoadedKey, setDraftLoadedKey] = useState('')
  const [draftStatus, setDraftStatus] = useState('Loading quiz…')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get(`/quizzes/${quizId}/`)
      .then((loadedQuiz) => {
        if (cancelled) return
        setQuiz(loadedQuiz)
        try {
          const saved = sessionStorage.getItem(draftKey)
          if (saved) {
            const parsed = JSON.parse(saved)
            const validAnswers = Object.fromEntries(
              Object.entries(parsed).filter(([questionId, choiceIndex]) => {
                const question = loadedQuiz.questions.find((item) => String(item.id) === questionId)
                return question && Number.isInteger(choiceIndex) && choiceIndex >= 0 && choiceIndex < question.choices.length
              }),
            )
            setAnswers(validAnswers)
            setDraftStatus(Object.keys(validAnswers).length ? 'Saved answers restored from this tab.' : 'Your answers will autosave in this tab.')
          } else {
            setAnswers({})
            setDraftStatus('Your answers will autosave in this tab.')
          }
        } catch {
          setAnswers({})
          setDraftStatus('Could not restore saved answers. Your new answers will autosave in this tab.')
        }
        setDraftLoadedKey(draftKey)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setDraftStatus('Quiz answers could not be loaded.')
        }
      })
    return () => { cancelled = true }
  }, [quizId, draftKey])

  useEffect(() => {
    if (draftLoadedKey !== draftKey || result || !Object.keys(answers).length) return undefined
    const timeoutId = window.setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(answers))
        setDraftStatus('Answers saved on this device.')
      } catch {
        setDraftStatus('Could not save answers on this device. Keep this tab open and submit before leaving.')
      }
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [answers, draftKey, draftLoadedKey, result])

  function selectAnswer(questionId, choiceIndex) {
    setAnswers((current) => ({ ...current, [questionId]: choiceIndex }))
    setDraftStatus('Saving answers…')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const attempt = await api.post(`/quizzes/${quizId}/submit/`, { answers })
      setResult(attempt)
      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        setDraftStatus('Quiz submitted, but saved answers could not be cleared from this tab.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const allAnswered = quiz && quiz.questions.every((q) => answers[q.id] !== undefined)
  const answeredCount = Object.keys(answers).length

  return (
    <DashboardLayout navItems={navItems} user={{ name: auth?.email || 'Student' }}>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="mx-auto max-w-3xl space-y-6">
        {error && (
          <div className="rounded-lg border border-line bg-coral-tint px-4 py-3 text-sm text-coral-dim">{error}</div>
        )}

        {quiz && !result && (
          <>
            <div className="dg-card rounded-3xl p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Assessment</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{quiz.title || 'Quiz'}</h2>
                </div>
                <span className="dg-pill">{quiz.time_limit_minutes} min · Pass {quiz.pass_mark_percentage}%</span>
              </div>
              <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status" aria-live="polite">
                {answeredCount} of {quiz.questions.length} answered · {draftStatus}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {quiz.questions.map((q, i) => (
                <div key={q.id} className="dg-card rounded-3xl p-5">
                  <p className="font-semibold text-slate-900">{i + 1}. {q.text}</p>
                  <div className="mt-4 space-y-2">
                    {q.choices.map((choice, idx) => (
                      <label
                        key={idx}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                          answers[q.id] === idx ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${q.id}`}
                          checked={answers[q.id] === idx}
                          onChange={() => selectAnswer(q.id, idx)}
                          className="accent-blue-600"
                        />
                        {choice.text ?? choice}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <button
                disabled={!allAnswered || busy}
                className="dg-btn w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {busy ? 'Submitting…' : 'Submit quiz'}
              </button>
            </form>
          </>
        )}

        {result && (
          <div className="dg-card rounded-3xl p-8 text-center">
            {result.passed ? (
              <CircleCheckBig size={40} className="mx-auto text-emerald-500" />
            ) : (
              <CircleX size={40} className="mx-auto text-rose-500" />
            )}
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{result.passed ? 'Passed!' : 'Not quite — try again'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Score: {result.score} / {result.total_marks} ({result.percentage}%)
            </p>
            <Link
              to="/dashboard/student/courses"
              className="dg-btn mt-5 bg-blue-600 text-white hover:bg-blue-500"
            >
              Back to courses
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
