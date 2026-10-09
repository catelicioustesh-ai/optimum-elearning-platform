import { useState } from 'react'

export default function ExpandableList({
  items,
  children,
  limit = 6,
  label = 'items',
  className = '',
  listClassName = '',
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleItems = expanded ? items : items.slice(0, limit)

  return (
    <>
      <div className={listClassName}>{visibleItems.map(children)}</div>
      {items.length > limit && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={className || 'mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'}
        >
          {expanded ? 'Show fewer' : `View all ${items.length} ${label}`}
        </button>
      )}
    </>
  )
}
