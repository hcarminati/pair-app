import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepIndicator from '../components/StepIndicator'

const STEPS = [{ label: 'Account' }, { label: 'Link partner' }, { label: 'Interests' }]

function generateToken(): string {
  const seg = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  return `${seg()}-${seg()}-${seg()}`
}

export default function LinkPartnerPage() {
  const navigate = useNavigate()
  const [myToken] = useState(generateToken)
  const [partnerToken, setPartnerToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function handleCopy() {
    await navigator.clipboard.writeText(myToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerToken.trim()) {
      setError("Partner token is required")
      return
    }
    setError('')
    // TODO: call POST /auth/link-partner
    console.log('link partner', { partnerToken })
    navigate('/register/interests')
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-content">
        <StepIndicator steps={STEPS} currentStep={1} />

        <section>
          <h2 className="onboarding-section-title">Your invite token</h2>
          <div className="token-box">{myToken}</div>
          <button type="button" className="copy-link" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <p className="token-hint">Expires in 72 hours · single use</p>
        </section>

        <div className="onboarding-divider"><span>or</span></div>

        <form onSubmit={handleSubmit} noValidate>
          <h2 className="onboarding-section-title">{`Paste partner's token`}</h2>
          {error && <p className="form-error">{error}</p>}
          <input
            className="onboarding-input"
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            value={partnerToken}
            onChange={(e) => setPartnerToken(e.target.value)}
          />
          <button type="submit" className="btn-primary onboarding-submit">
            Link accounts
          </button>
        </form>
      </div>
    </div>
  )
}
