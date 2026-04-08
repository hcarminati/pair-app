import { useState } from 'react'

const PRESET_INTERESTS = [
  'hiking', 'board games', 'cooking', 'films', 'cycling',
  'travel', 'yoga', 'trivia', 'wine', 'running',
]
const MAX_INTERESTS = 10

export function MyProfileTab() {
  const [tags, setTags] = useState<string[]>(PRESET_INTERESTS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customTag, setCustomTag] = useState('')
  const [aboutMe, setAboutMe] = useState('')
  const [location, setLocation] = useState('')

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

  function handleSave() {
    // TODO: PATCH /profiles/me
    console.log('save profile', { selected: [...selected], aboutMe, location })
  }

  return (
    <div className="profile-tab-pane">
      <div className="profile-user-header">
        <div className="profile-avatar">KO</div>
        <p className="profile-display-name">Kim O.</p>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="displayName">Display name</label>
          <input id="displayName" type="text" placeholder="Enter your name" readOnly />
        </div>
        <div className="form-field">
          <label htmlFor="profileEmail">Email</label>
          <input id="profileEmail" type="email" placeholder="you@example.com" readOnly />
        </div>
      </div>

      <div className="form-field">
        <label>Interests</label>
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
      </div>

      <div className="form-field">
        <label htmlFor="aboutMe">About me</label>
        <textarea
          id="aboutMe"
          placeholder="Tell others about yourself..."
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          rows={4}
        />
      </div>

      <div className="form-field">
        <label htmlFor="profileLocation">Location</label>
        <input
          id="profileLocation"
          type="text"
          placeholder="City, State"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <button type="button" className="btn-primary" onClick={handleSave}>
        Save profile
      </button>
    </div>
  )
}
