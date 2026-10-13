import { createElement, useState } from 'react'
import { Award, CircleCheck, CircleDot, LockKeyhole, TriangleAlert } from 'lucide-react'
import ContentIcon from './ContentIcon.jsx'

const statusMeta = {
  done: { label: 'Completed', className: 'learning-path-node-done', icon: CircleCheck },
  current: { label: 'Current', className: 'learning-path-node-current', icon: CircleDot },
  active: { label: 'Current', className: 'learning-path-node-current', icon: CircleDot },
  locked: { label: 'Locked', className: 'learning-path-node-locked', icon: LockKeyhole },
  failed: { label: 'Needs review', className: 'learning-path-node-failed', icon: TriangleAlert },
  mastered: { label: 'Mastered', className: 'learning-path-node-mastered', icon: Award },
}

export default function LearningPath({ modules = [], onSelectModule }) {
  const [selectedKey, setSelectedKey] = useState(null)
  const completed = modules.filter((module) => module.status === 'done' || module.status === 'mastered').length
  const completedPercent = modules.length ? Math.round((completed / modules.length) * 100) : 0
  const selected = modules.find((module) => (
    String(module.module_id || module.id || `${module.order}-${module.title}`) === selectedKey
  ))

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">Select an available module to continue.</p>
      <ol className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {modules.map((module, index) => {
            const status = statusMeta[module.status] ? module.status : 'locked'
            const meta = statusMeta[status]
            const locked = status === 'locked'
            const StatusIcon = meta.icon
            const moduleKey = module.module_id || module.id || `${module.order}-${module.title}`
            const selectedHere = selectedKey === String(moduleKey)

            return (
              <li
                key={moduleKey}
                className={`learning-path-step learning-path-step-${status} min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center transition-colors ${selectedHere ? 'border-blue-400 bg-blue-50' : ''}`}
                style={{ '--path-delay': `${Math.min(index * 65, 780)}ms` }}
              >
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Module {module.order || index + 1}
                </span>
                <button
                  type="button"
                  className={`learning-path-node ${meta.className} ${selectedHere ? 'learning-path-node-selected' : ''} relative z-10 mx-auto grid h-12 w-12 place-items-center rounded-full border-2 transition-colors lms-focus-ring disabled:cursor-not-allowed ${locked ? '' : 'cursor-pointer'}`}
                  disabled={locked}
                  aria-current={status === 'current' || status === 'active' ? 'step' : undefined}
                  aria-pressed={selectedHere || false}
                  aria-label={`Module ${module.order || index + 1}: ${module.title}, ${meta.label}${module.mastery != null ? `, ${module.mastery}% mastery` : ''}`}
                  onClick={() => {
                    setSelectedKey(String(moduleKey))
                    if (!locked) onSelectModule?.(module)
                  }}
                >
                  <ContentIcon type="module" size={18} />
                  {createElement(StatusIcon, { className: 'learning-path-status-icon', size: 15, 'aria-hidden': true })}
                </button>
                <span className="mt-3 block min-h-10 text-center text-xs font-semibold leading-5 text-slate-700" title={module.title}>
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
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm" role="status">
          <ContentIcon type="module" size={16} className="shrink-0 text-blue-300" />
          <span className="font-semibold text-white">{selected.title}</span>
          <span className="text-slate-300">{statusMeta[selected.status]?.label || 'Module'}</span>
          {selected.mastery != null && <span className="text-slate-400">{selected.mastery}% mastery</span>}
        </div>
      )}
    </div>
  )
}
