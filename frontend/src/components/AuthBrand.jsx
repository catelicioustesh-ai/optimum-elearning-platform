import Logo from './Logo.jsx'

export default function AuthBrand({ compact = false }) {
  return (
    <div className={`auth-brand${compact ? ' auth-brand-compact' : ''}`}>
      <Logo mark height={compact ? 48 : 64} />
      <div className="auth-brand-copy">
        <p className="auth-brand-title"><span>Optimum</span> <span>LMS</span></p>
        <p className="auth-brand-subtitle">Learning Platform</p>
      </div>
    </div>
  )
}