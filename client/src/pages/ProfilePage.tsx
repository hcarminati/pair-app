import { useState } from 'react'
import { getIsPaired } from '../lib/authStore'
import { MyProfileTab } from '../components/profile/MyProfileTab'
import { LinkPartnerTab } from '../components/profile/LinkPartnerTab'
import { CouplePreviewTab } from '../components/profile/CouplePreviewTab'

type Tab = 'my-profile' | 'link-partner' | 'couple-preview'

const TABS: { id: Tab; label: string }[] = [
  { id: 'my-profile', label: 'My profile' },
  { id: 'link-partner', label: 'Link partner' },
  { id: 'couple-preview', label: 'Couple preview' },
]

export default function ProfilePage() {
  const isPaired = getIsPaired()
  const [activeTab, setActiveTab] = useState<Tab>(isPaired ? 'my-profile' : 'link-partner')

  return (
    <div className="profile-page">
      <div className="profile-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`profile-tab${activeTab === id ? ' profile-tab--active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'my-profile' && <MyProfileTab />}
      {activeTab === 'link-partner' && <LinkPartnerTab />}
      {activeTab === 'couple-preview' && <CouplePreviewTab />}
    </div>
  )
}
