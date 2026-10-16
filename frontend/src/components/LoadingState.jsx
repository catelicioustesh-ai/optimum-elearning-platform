export default function LoadingState({ label = 'Loading…', compact = false }) {
  return (
    <div className={`lms-loading-state${compact ? ' lms-loading-state-compact' : ''}`} role="status" aria-live="polite">
      <span className="lms-loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{label}</span>
    </div>
  )
}
