import { smoothPath, uid, radarPoint, useCountUp, useReveal, useSpotlight } from '../hooks/useDashboardFx.js'

/* ------------------------------------------------------------------ */
/* card shell                                                           */
/* ------------------------------------------------------------------ */

export function Card({ span = 4, children, className = '', style }) {
  const reveal = useReveal()
  const spotlight = useSpotlight()
  // reveal.ref is a ref object returned from a custom hook (useReveal), not a
  // literal useRef() at this call site — the experimental react-hooks/refs
  // rule can't see through that indirection and flags both the ref prop and
  // the className interpolation below as a false positive. "Return a ref
  // from a custom hook" is a standard, safe React pattern (see any
  // IntersectionObserver-based hook in the ecosystem).
  /* eslint-disable react-hooks/refs */
  return (
    <div
      ref={reveal.ref}
      className={`dg-card dg-c${span} ${reveal.className} ${className}`}
      style={style}
      onMouseMove={spotlight.onMouseMove}
    >
      {children}
    </div>
  )
  /* eslint-enable react-hooks/refs */
}

/* ------------------------------------------------------------------ */
/* charts                                                               */
/* ------------------------------------------------------------------ */

export function Ring({ pct, size = 170, width = 16, stroke = '#fff', track = '#ffffff30', label, sub }) {
  const r = (size - width) / 2
  const c = 2 * Math.PI * r
  const gradId = uid('ring')
  const shown = useCountUp(pct)
  return (
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId}>
            <stop offset="0" stopColor={stroke} />
            <stop offset="1" stopColor="var(--a2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={width} />
        <circle
          className="dg-sw"
          style={{ '--C': c }}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', lineHeight: 1.1 }}>
        <strong style={{ fontSize: size < 100 ? 18 : 34 }}>{label ?? `${shown}%`}</strong>
        {sub && <span style={{ display: 'block', fontSize: 11, color: stroke === '#fff' ? 'rgba(255,255,255,0.75)' : 'var(--mut)' }}>{sub}</span>}
      </div>
    </div>
  )
}

export function Sparkline({ values, width = 110, height = 44 }) {
  if (!values || values.length < 2) return null
  const { d, fill } = smoothPath(values, width, height, 4)
  const gradId = uid('spark')
  return (
    <svg className="dg-sp" width={width} height={height} style={{ position: 'absolute', right: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--acc)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke="var(--acc)" strokeWidth="2" />
    </svg>
  )
}

export function AreaChart({ values, labels, width = 560, height = 220 }) {
  if (!values || values.length < 2) return <div className="dg-sub">Not enough data yet</div>
  const { d, fill, x, y } = smoothPath(values, width, height - 26, 22)
  const gradId = uid('area')
  const gridLines = [0, 1, 2, 3].map((i) => 8 + (i * (height - 50)) / 3)
  const last = values.length - 1
  return (
    <svg
      className="dg-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Line chart: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}`}
    >
      {gridLines.map((gy, i) => (
        <line key={i} x1={0} x2={width} y1={gy} y2={gy} stroke="var(--line)" />
      ))}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--acc)" stopOpacity=".4" />
          <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(0 8)">
        <path className="dg-fade" d={fill} fill={`url(#${gradId})`} />
        <path className="dg-draw" pathLength={1} d={d} fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle
            key={i}
            className="dg-dot"
            style={{ animationDelay: `${0.9 + i * 0.08}s` }}
            data-tip={`${labels[i]}: ${v}`}
            cx={x(i)}
            cy={y(v)}
            r={3.5}
            fill="var(--card)"
            stroke="var(--acc)"
            strokeWidth={2}
          />
        ))}
        <circle className="dg-ping" cx={x(last)} cy={y(values[last])} r={4} fill="var(--acc)" />
        <circle cx={x(last)} cy={y(values[last])} r={3} fill="#fff" stroke="var(--acc)" strokeWidth="1.5" />
      </g>
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={height - 4} textAnchor="middle">
          {l}
        </text>
      ))}
    </svg>
  )
}

export function Donut({ slices, size = 150, width = 22 }) {
  const r = (size - width) / 2
  const c = 2 * Math.PI * r
  const total = slices.reduce((a, s) => a + s.value, 0) || 1
  const withOffsets = slices.reduce((acc, s) => {
    const prevEnd = acc.length ? acc[acc.length - 1].end : 0
    const len = (c * s.value) / total
    acc.push({ ...s, len, start: prevEnd, end: prevEnd + len })
    return acc
  }, [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Donut chart: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
      {withOffsets.map((s, i) => (
        <circle
          key={i}
          className="dg-sw"
          style={{ '--C': c, animationDelay: `${0.2 + (s.start / c) * 0.9}s` }}
          data-tip={`${s.label}: ${s.value}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={width}
          strokeDasharray={`${Math.max(s.len - 3, 1)} ${c}`}
          strokeDashoffset={-s.start}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  )
}

export function DonutLegend({ slices }) {
  return (
    <div className="dg-leg">
      {slices.map((s) => (
        <span key={s.label}>
          <i style={{ background: s.color }} />
          {s.label} {s.value}
        </span>
      ))}
    </div>
  )
}

export function Radar({ labels, values, size = 300 }) {
  const c = size / 2
  const r = c - 46
  const n = labels.length
  const rings = [0.25, 0.5, 0.75, 1]
  return (
    <svg className="dg-chart" style={{ maxWidth: 340, margin: 'auto' }} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Radar chart: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}`}>
      {rings.map((k, i) => (
        <polygon key={i} points={labels.map((_, j) => radarPoint(j, n, k, c, c, r).join(',')).join(' ')} fill="none" stroke="var(--line)" />
      ))}
      {labels.map((_, i) => {
        const [x, y] = radarPoint(i, n, 1, c, c, r)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" />
      })}
      <polygon
        className="dg-rp"
        points={values.map((v, i) => radarPoint(i, n, v / 100, c, c, r).join(',')).join(' ')}
        fill="var(--acc)"
        fillOpacity={0.22}
        stroke="var(--acc)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const [x, y] = radarPoint(i, n, v / 100, c, c, r)
        return <circle key={i} data-tip={`${labels[i]}: ${v}%`} cx={x} cy={y} r={5} fill="var(--acc)" style={{ cursor: 'pointer' }} />
      })}
      {labels.map((l, i) => {
        const [x, y] = radarPoint(i, n, 1.2, c, c, r)
        return (
          <text key={i} x={x} y={y + 4} textAnchor="middle">
            {l}
          </text>
        )
      })}
    </svg>
  )
}

export function Heatmap({ values, weeks = 14 }) {
  const cells = []
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const k = w * 7 + d
      const v = values[k] ?? 0
      const opacity = v > 2 ? 1 : v > 1.5 ? 0.65 : v > 0.8 ? 0.35 : v > 0.2 ? 0.16 : 0.06
      cells.push(
        <rect
          key={k}
          className="dg-hc"
          style={{ animationDelay: `${0.3 + k * 9}ms` }}
          data-tip={`${v} activities`}
          x={w * 22}
          y={d * 22}
          width={18}
          height={18}
          rx={5}
          fill="var(--acc)"
          fillOpacity={opacity}
        />,
      )
    }
  }
  return (
    <svg className="dg-chart" viewBox={`0 0 ${weeks * 22} 152`} role="img" aria-label="Activity heatmap">
      {cells}
    </svg>
  )
}

export function BarChart({ data, height = 170 }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--mut)' }}>
          <div
            className="dg-gb2"
            data-tip={`${d.label}: ${d.value}`}
            style={{
              animationDelay: `${0.3 + i * 0.09}s`,
              height: `${((height - 26) * d.value) / max}px`,
              borderRadius: '9px 9px 4px 4px',
              background: 'linear-gradient(180deg,var(--acc),var(--a2))',
              marginBottom: 6,
            }}
          />
          {d.label}
        </div>
      ))}
    </div>
  )
}

export function BarList({ data }) {
  return (
    <>
      {data.map((d) => (
        <div key={d.label} style={{ margin: '14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <b>{d.label}</b>
            <span>{d.pct}%</span>
          </div>
          <div className="dg-bar" style={{ marginTop: 6, height: 10 }}>
            <i style={{ width: `${d.pct}%` }} />
          </div>
        </div>
      ))}
    </>
  )
}

export function KpiCard({ label, value, delta, warn, icon, spark, suffix = '' }) {
  const shown = useCountUp(value)
  const spotlight = useSpotlight()
  return (
    <div className="dg-card dg-kpi dg-c3" onMouseMove={spotlight.onMouseMove}>
      <span className="dg-ic">{icon}</span>
      <div className="dg-l">{label}</div>
      <div className="dg-v">
        {shown}
        {suffix}
      </div>
      <div className={`dg-d${warn ? ' dg-w' : ''}`}>{delta}</div>
      {spark && <Sparkline values={spark} />}
    </div>
  )
}

export function Pill({ tone = 'default', pulse = false, children }) {
  return <span className={`dg-pill${tone !== 'default' ? ` dg-${tone}` : ''}${pulse ? ' dg-pulse' : ''}`}>{children}</span>
}

export function ProgressBar({ pct }) {
  return (
    <div className="dg-bar">
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Avatar({ name }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return <span className="dg-avatar">{initials}</span>
}

export function Hero({ day, title, children, side }) {
  return (
    <section className="dg-hero">
      <i className="dg-orb dg-o1" />
      <i className="dg-orb dg-o2" />
      <div className="dg-grow">
        <div className="dg-day">{day}</div>
        <h1>{title}</h1>
        {children}
      </div>
      {side}
    </section>
  )
}

export function Skeleton({ height = 120 }) {
  return (
    <div
      className="lms-skeleton"
      style={{
        height,
        borderRadius: 12,
      }}
    />
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ padding: '10px 0', color: 'var(--mut)', fontSize: 13 }}>
      <p style={{ margin: '0 0 8px' }}>{message}</p>
      {onRetry && (
        <button className="dg-gb dg-g2" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }) {
  return <p style={{ color: 'var(--mut)', fontSize: 13 }}>{message}</p>
}

if (typeof document !== 'undefined' && !document.getElementById('dg-skel-kf')) {
  const style = document.createElement('style')
  style.id = 'dg-skel-kf'
  style.textContent = '@keyframes dg-skel{0%{background-position:200% 0}100%{background-position:-200% 0}}'
  document.head.appendChild(style)
}
