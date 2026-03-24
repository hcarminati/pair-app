import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepIndicator from '../components/StepIndicator'

const STEPS = [{ label: 'Account' }, { label: 'Link partner' }, { label: 'Interests' }]

const PRESET_INTERESTS = [
  'hiking', 'board games', 'cooking', 'films', 'cycling',
  'travel', 'yoga', 'trivia', 'wine', 'running',
]

const MAX_INTERESTS = 10

export default function AddInterestsPage() {
  const navigate = useNavigate()
  const [tags, setTags] = useState<string[]>(PRESET_INTERESTS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customTag, setCustomTag] = useState('')

  function toggleTag(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else if (next.size < MAX_INTERESTS) {
        next.add(tag)
      }
      return next
    })
  }

  function handleAddCustom() {
    const trimmed = customTag.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) return
    setTags((prev) => [...prev, trimmed])
    setSelected((prev) => {
      if (prev.size < MAX_INTERESTS) return new Set([...prev, trimmed])
      return prev
    })
    setCustomTag('')
  }

  function handleSubmit() {
    // TODO: call PATCH /users/me/interests
    console.log('interests', [...selected])
    navigate('/')
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-content">
        <StepIndicator steps={STEPS} currentStep={2} />

        <div className="interest-tags">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`tag${selected.has(tag) ? ' tag--selected' : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="custom-tag-row">
          <input
            className="onboarding-input"
            type="text"
            placeholder="Add custom tag"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCustom()
              }
            }}
          />
          <button type="button" className="btn-outlined" onClick={handleAddCustom}>
            Add
          </button>
        </div>

        <p className="interests-count">{selected.size} / {MAX_INTERESTS} selected</p>

        <button type="button" className="btn-primary" onClick={handleSubmit}>
          Save & continue
        </button>
      </div>
    </div>
  )
}
