import { createElement, useEffect, useRef, useState } from 'react'
import { Award, ChevronLeft, ChevronRight, CircleCheck, CircleDot, LockKeyhole, TriangleAlert } from 'lucide-react'
import ContentIcon from './ContentIcon.jsx'

const statusMeta = {
  done: { label: 'Completed', className: 'learning-path-node-done', icon: CircleCheck },
  current: { label: 'Current', className: 'learning-path-node-current', icon: CircleDot },
  active: { label: 'Current', className: 'learning-path-node-current', icon: CircleDot },
  locked: { label: 'Locked', className: 'learning-path-node-locked', icon: LockKeyhole },
  failed: { label: 'Needs review', className: 'learning-path-node-failed', icon: TriangleAlert },
  mastered: { label: 'Mastered', className: 'learning-path-node-mastered', icon: Award },
}

function scrollStepToCenter(container, step, behavior) {
  const containerBounds = container.getBoundingClientRect()
  const stepBounds = step.getBoundingClientRect()
  const targetLeft = container.scrollLeft
    + stepBounds.left
    - containerBounds.left
    - (container.clientWidth - stepBounds.width) / 2

  container.scrollTo({
    left: Math.max(0, Math.min(container.scrollWidth - container.clientWidth, targetLeft)),
    behavior,
  })
}

export default function LearningPath({ modules = [], onSelectModule }) {
  const [selected, setSelected] = useState(null)
  const [scrollState, setScrollState] = useState({ canScrollBack: false, canScrollForward: true })
  const scrollRef = useRef(null)
  const currentStepRef = useRef(null)
  const completed = modules.filter((module) => module.status === 'done' || module.status === 'mastered').length
  const completedPercent = modules.length ? Math.round((completed / modules.length) * 100) : 0
  const currentModule = modules.find((module) => module.status === 'current' || module.status === 'active')
  const currentModuleKey = currentModule && String(currentModule.module_id || currentModule.id || `${currentModule.order}-${currentModule.title}`)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return undefined

    const updateScrollState = () => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth
      setScrollState({
        canScrollBack: container.scrollLeft > 2,
        canScrollForward: maxScrollLeft - container.scrollLeft > 2,
      })
    }
    const frame = requestAnimationFrame(updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(container)
    if (container.firstElementChild) observer.observe(container.firstElementChild)
    container.addEventListener('scroll', updateScrollState, { passive: true })
    container.addEventListener('scrollend', updateScrollState)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      container.removeEventListener('scroll', updateScrollState)
      container.removeEventListener('scrollend', updateScrollState)
    }
  }, [modules.length])

  useEffect(() => {
    const step = currentStepRef.current
    const container = scrollRef.current
    if (!step || !container) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollStepToCenter(container, step, reduceMotion ? 'instant' : 'smooth')
  }, [currentModuleKey])

  function scrollModules(direction) {
    const container = scrollRef.current
    if (!container) return
    const steps = Array.from(container.querySelectorAll('.learning-path-step'))
    if (!steps.length) return

    const containerBounds = container.getBoundingClientRect()
    const center = containerBounds.left + container.clientWidth / 2
    const centers = steps.map((step) => {
      const bounds = step.getBoundingClientRect()
      return bounds.left + bounds.width / 2
    })
    const currentIndex = centers.reduce((closestIndex, stepCenter, index) => (
      Math.abs(stepCenter - center) < Math.abs(centers[closestIndex] - center) ? index : closestIndex
    ), 0)
    const targetIndex = Math.max(0, Math.min(steps.length - 1, currentIndex + direction))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollStepToCenter(container, steps[targetIndex], reduceMotion ? 'instant' : 'smooth')
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Scroll sideways or use the arrows to view every module.</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => scrollModules(-1)}
            disabled={!scrollState.canScrollBack}
            aria-label="Scroll to previous modules"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-600 text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 lms-focus-ring"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollModules(1)}
            disabled={!scrollState.canScrollForward}
            aria-label="Scroll to more modules"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-600 text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 lms-focus-ring"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="learning-path-scroll overflow-x-auto overscroll-x-contain pb-3 lms-focus-ring"
        tabIndex={0}
        role="region"
        aria-label="Course learning path"
        aria-describedby="learning-path-scroll-help"
      >
        <span id="learning-path-scroll-help" className="sr-only">Scroll horizontally or use the previous and next module buttons.</span>
        <ol className="flex w-max min-w-full list-none snap-x snap-mandatory p-0 pt-2">
          {modules.map((module, index) => {
            const status = statusMeta[module.status] ? module.status : 'locked'
            const meta = statusMeta[status]
            const locked = status === 'locked'
            const StatusIcon = meta.icon
            const moduleKey = module.module_id || module.id || `${module.order}-${module.title}`
            const selectedHere = selected && String(selected.module_id || selected.id) === String(moduleKey)
            const progressToHere = modules.slice(0, index + 1).every((item) => item.status === 'done' || item.status === 'mastered')

            return (
              <li
                key={moduleKey}
                ref={String(moduleKey) === currentModuleKey ? currentStepRef : null}
                className={`learning-path-step learning-path-step-${status} relative w-[min(11rem,78vw)] shrink-0 snap-center px-2 sm:w-40`}
                style={{ '--path-delay': `${Math.min(index * 65, 780)}ms` }}
              >
                {index < modules.length - 1 && (
                  <span
                    className={`learning-path-connector ${progressToHere ? 'learning-path-connector-done' : ''}`}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  className={`learning-path-node ${meta.className} ${selectedHere ? 'learning-path-node-selected' : ''} relative z-10 mx-auto grid h-12 w-12 place-items-center rounded-full border-2 transition-colors lms-focus-ring disabled:cursor-not-allowed ${locked ? '' : 'cursor-pointer'}`}
                  disabled={locked}
                  aria-current={status === 'current' || status === 'active' ? 'step' : undefined}
                  aria-pressed={selectedHere || false}
                  aria-label={`Module ${module.order || index + 1}: ${module.title}, ${meta.label}${module.mastery != null ? `, ${module.mastery}% mastery` : ''}`}
                  onClick={() => {
                    setSelected(module)
                    if (!locked) onSelectModule?.(module)
                  }}
                >
                  <ContentIcon type="module" size={18} />
                  {createElement(StatusIcon, { className: 'learning-path-status-icon', size: 15, 'aria-hidden': true })}
                </button>
                <span className="mt-3 block min-h-10 text-center text-xs font-semibold leading-5 text-slate-200" title={module.title}>
                  {module.title}
                </span>
                <span className={`learning-path-status mt-0.5 inline-flex min-h-5 items-center justify-center rounded-full border px-2 text-center text-[11px] font-semibold ${status === 'failed' ? 'learning-path-label-failed' : status === 'mastered' ? 'learning-path-label-mastered' : status === 'done' ? 'learning-path-label-done' : status === 'locked' ? 'learning-path-label-locked' : 'learning-path-label-current'}`}>
                  {(status === 'current' || status === 'active') && <span className="learning-path-current-dot" aria-hidden="true" />}
                  {meta.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="learning-path-progress mt-3" role="status" aria-label={`${completed} of ${modules.length} modules completed`}>
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
          <span>{completed} of {modules.length} modules completed</span>
          <span className="font-semibold tabular-nums text-blue-200">{completedPercent}%</span>
        </div>
        <div className="learning-path-progress-track" aria-hidden="true">
          <div className="learning-path-progress-fill" style={{ width: `${completedPercent}%` }} />
        </div>
      </div>

      {selected && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm" role="status">
          <ContentIcon type="module" size={16} className="shrink-0 text-blue-300" />
          <span className="font-semibold text-white">{selected.title}</span>
          <span className="text-slate-300">{statusMeta[selected.status]?.label || 'Module'}</span>
          {selected.mastery != null && <span className="text-slate-400">{selected.mastery}% mastery</span>}
        </div>
      )}
    </div>
  )
}
