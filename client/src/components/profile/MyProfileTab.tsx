import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearTokens } from "../../lib/authStore";
import { logout, apiFetch } from "../../lib/api";

const PRESET_INTERESTS = [
  "hiking",
  "board games",
  "cooking",
  "films",
  "cycling",
  "travel",
  "yoga",
  "trivia",
  "wine",
  "running",
];
const MAX_INTERESTS = 10;

interface ProfileData {
  display_name: string;
  about_me: string | null;
  location: string | null;
  email: string | null;
  tags: string[];
}

export function MyProfileTab() {
  const navigate = useNavigate();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<string[]>(PRESET_INTERESTS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const res = await apiFetch("/profiles/me");
      if (!res.ok) {
        setLoadingProfile(false);
        return;
      }
      const data = (await res.json()) as ProfileData;
      setDisplayName(data.display_name);
      setEmail(data.email ?? "");
      setAboutMe(data.about_me ?? "");
      setLocation(data.location ?? "");

      // Merge user's custom tags into the tag list
      const userTags = data.tags;
      const merged = [
        ...PRESET_INTERESTS,
        ...userTags.filter((t) => !PRESET_INTERESTS.includes(t)),
      ];
      setTags(merged);
      setSelected(new Set(userTags));
      setLoadingProfile(false);
    }
    void fetchProfile();
  }, []);

  function toggleTag(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else if (next.size < MAX_INTERESTS) {
        next.add(tag);
      }
      return next;
    });
  }

  function handleAddCustom() {
    const trimmed = customTag.trim().toLowerCase();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setSelected((prev) => {
      if (prev.size < MAX_INTERESTS) return new Set([...prev, trimmed]);
      return prev;
    });
    setCustomTag("");
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    const res = await apiFetch("/profiles/me", {
      method: "PATCH",
      body: JSON.stringify({
        display_name: displayName,
        about_me: aboutMe,
        location,
        tags: [...selected],
      }),
    });

    setSaving(false);

    if (res.ok) {
      setSaveSuccess(true);
    } else {
      const data = (await res.json()) as { error?: string };
      setSaveError(data.error ?? "Failed to save profile");
    }
  }

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loadingProfile) {
    return <div className="profile-tab-pane">Loading profile…</div>;
  }

  return (
    <div className="profile-tab-pane">
      <div className="profile-user-header">
        <div className="profile-avatar">{initials || "?"}</div>
        <p className="profile-display-name">{displayName}</p>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            type="text"
            placeholder="Enter your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="profileEmail">Email</label>
          <input
            id="profileEmail"
            type="email"
            value={email}
            readOnly
          />
        </div>
      </div>

      <div className="form-field">
        <label>Interests</label>
        <div className="interest-tags">
          {tags.map((tag) => {
            const isSelected = selected.has(tag);
            const isDisabled = !isSelected && selected.size >= MAX_INTERESTS;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                disabled={isDisabled}
                className={`tag${isSelected ? " tag--selected" : ""}`}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <div className="custom-tag-row">
          <input
            className="onboarding-input"
            type="text"
            placeholder="Add custom tag"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom();
              }
            }}
          />
          <button
            type="button"
            className="btn-outlined"
            onClick={handleAddCustom}
          >
            Add
          </button>
        </div>
        <p className="interests-count">
          {selected.size} / {MAX_INTERESTS} selected
        </p>
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

      {saveSuccess && (
        <p className="form-success">Profile saved successfully.</p>
      )}
      {saveError && <p className="form-error">{saveError}</p>}

      <button
        type="button"
        className="btn-primary"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
      <button
        type="button"
        className="btn-outlined"
        disabled={loggingOut}
        onClick={async () => {
          setLoggingOut(true);
          await logout();
          clearTokens();
          navigate("/login");
        }}
      >
        {loggingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}
