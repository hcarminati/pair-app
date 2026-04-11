import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";

const MAX_ABOUT_US = 300;
const MAX_LOCATION = 100;

interface PartnerInfo {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

interface CoupleProfile {
  pair_id: string;
  about_us: string | null;
  location: string | null;
  partner1: PartnerInfo;
  partner2: PartnerInfo;
  tags: string[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CouplePreviewTab() {
  const [loading, setLoading] = useState(true);
  const [notPaired, setNotPaired] = useState(false);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);
  const [aboutUs, setAboutUs] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const res = await apiFetch("/pairs/me");
      if (!res.ok) {
        setNotPaired(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as CoupleProfile;
      setProfile(data);
      setAboutUs(data.about_us ?? "");
      setLocation(data.location ?? "");
      setLoading(false);
    }
    void fetchProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    const res = await apiFetch("/couples/me", {
      method: "PATCH",
      body: JSON.stringify({ about_us: aboutUs, location }),
    });

    setSaving(false);

    if (res.ok) {
      setSaveSuccess(true);
      if (profile) {
        setProfile({ ...profile, about_us: aboutUs, location });
      }
    } else {
      const data = (await res.json()) as { error?: string };
      setSaveError(data.error ?? "Failed to save couple profile");
    }
  }

  if (loading) {
    return <div className="profile-tab-pane">Loading couple profile…</div>;
  }

  if (notPaired || !profile) {
    return (
      <div className="profile-tab-pane">
        <p className="placeholder-text">
          You are not paired yet. Link a partner to edit your couple profile.
        </p>
      </div>
    );
  }

  const initials1 = getInitials(profile.partner1.display_name);
  const initials2 = getInitials(profile.partner2.display_name);

  return (
    <div className="profile-tab-pane">
      {/* Preview card — how this couple appears to others */}
      <div className="couple-card couple-card--static">
        <div className="discovery-modal-header">
          <div className="couple-card-identity">
            <div className="avatar-pair">
              <div className="avatar avatar--lg">{initials1}</div>
              <div className="avatar avatar--lg avatar--overlap">{initials2}</div>
            </div>
            <div>
              <h2>
                {profile.partner1.display_name} &amp; {profile.partner2.display_name}
              </h2>
              {profile.location && (
                <p className="discovery-subtitle">{profile.location}</p>
              )}
            </div>
          </div>
        </div>

        {profile.about_us && (
          <div className="discovery-modal-section">
            <h3>About us</h3>
            <p className="text-muted">{profile.about_us}</p>
          </div>
        )}

        {profile.tags.length > 0 && (
          <div className="discovery-modal-section">
            <h3>Interests</h3>
            <div className="interest-pills">
              {profile.tags.map((tag) => (
                <span key={tag} className="pill pill--sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="discovery-modal-section">
          <h3>Partners</h3>
          <div className="couple-grid">
            <div className="couple-card couple-card--static">
              <div className="couple-card-header">
                <div className="couple-card-identity">
                  <div className="avatar avatar--md">{initials1}</div>
                  <span className="couple-names">{profile.partner1.display_name}</span>
                </div>
              </div>
              <p className="discovery-subtitle">
                {profile.partner1.location ?? "No location set"}
              </p>
              <p className="text-muted">
                {profile.partner1.about_me ?? "No bio yet"}
              </p>
              {profile.partner1.tags.length > 0 && (
                <div className="interest-pills" style={{ marginTop: 12 }}>
                  {profile.partner1.tags.map((tag) => (
                    <span key={tag} className="pill pill--sm">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="couple-card couple-card--static">
              <div className="couple-card-header">
                <div className="couple-card-identity">
                  <div className="avatar avatar--md">{initials2}</div>
                  <span className="couple-names">{profile.partner2.display_name}</span>
                </div>
              </div>
              <p className="discovery-subtitle">
                {profile.partner2.location ?? "No location set"}
              </p>
              <p className="text-muted">
                {profile.partner2.about_me ?? "No bio yet"}
              </p>
              {profile.partner2.tags.length > 0 && (
                <div className="interest-pills" style={{ marginTop: 12 }}>
                  {profile.partner2.tags.map((tag) => (
                    <span key={tag} className="pill pill--sm">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit shared fields */}
      <div className="form-field">
        <label htmlFor="aboutUs">About us</label>
        <textarea
          id="aboutUs"
          placeholder="Tell other couples about yourselves..."
          value={aboutUs}
          maxLength={MAX_ABOUT_US}
          onChange={(e) => setAboutUs(e.target.value)}
          rows={4}
        />
        <p className="char-count">
          {aboutUs.length} / {MAX_ABOUT_US}
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="coupleLocation">Location</label>
        <input
          id="coupleLocation"
          type="text"
          placeholder="City, State"
          value={location}
          maxLength={MAX_LOCATION}
          onChange={(e) => setLocation(e.target.value)}
        />
        <p className="char-count">
          {location.length} / {MAX_LOCATION}
        </p>
      </div>

      {saveSuccess && (
        <p className="form-success">Couple profile saved successfully.</p>
      )}
      {saveError && <p className="form-error">{saveError}</p>}

      <button
        type="button"
        className="btn btn--primary"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save couple profile"}
      </button>
    </div>
  );
}
