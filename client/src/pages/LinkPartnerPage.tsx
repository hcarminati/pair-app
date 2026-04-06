import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import StepIndicator from '../components/StepIndicator'

const STEPS = [{ label: 'Account' }, { label: 'Link partner' }, { label: 'Interests' }]

export default function LinkPartnerPage() {
  const navigate = useNavigate()
  const [myToken, setMyToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenError, setTokenError] = useState('')
  const [partnerToken, setPartnerToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    async function generateToken() {
      const res = await apiFetch('/couples/invite', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setTokenError(data.error ?? 'Failed to generate invite token')
      } else {
        const data = await res.json() as { token: string }
        setMyToken(data.token)
      }
      setTokenLoading(false)
    }
    void generateToken()
  }, [])

  async function handleCopy() {
    if (!myToken) return
    await navigator.clipboard.writeText(myToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerToken.trim()) {
      setLinkError('Partner token is required')
      return
    }
    setLinkError('')
    setLinking(true)

    const res = await apiFetch('/couples/link', {
      method: 'POST',
      body: JSON.stringify({ token: partnerToken.trim() }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setLinkError(data.error ?? 'Failed to link accounts. Please try again.')
      setLinking(false)
      return
    }

    navigate('/register/interests')
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-content">
        <StepIndicator steps={STEPS} currentStep={1} />

        <section>
          <h2 className="onboarding-section-title">Your invite token</h2>
          {tokenLoading && <p className="token-hint">Generating your token…</p>}
          {tokenError && <p className="form-error">{tokenError}</p>}
          {myToken && (
            <>
              <div className="token-box">{myToken}</div>
              <button type="button" className="copy-link" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <p className="token-hint">Expires in 72 hours · single use</p>
            </>
          )}
        </section>

        <div className="onboarding-divider"><span>or</span></div>

        <form onSubmit={handleSubmit} noValidate>
          <h2 className="onboarding-section-title">{"Paste partner's token"}</h2>
          {linkError && <p className="form-error">{linkError}</p>}
          <input
            className="onboarding-input"
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            value={partnerToken}
            onChange={(e) => setPartnerToken(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary onboarding-submit"
            disabled={linking}
          >
            {linking ? 'Linking…' : 'Link accounts'}
          </button>
        </form>
      </div>
    </div>
  )
}
