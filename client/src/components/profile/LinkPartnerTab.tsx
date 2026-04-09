import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { setIsPaired } from "../../lib/authStore";

interface LinkPartnerTabProps {
  paired: boolean;
  inviteToken: string | null;
  tokenLoading: boolean;
  tokenError: string;
  onUnlink: () => Promise<void>;
}

export function LinkPartnerTab({
  paired,
  inviteToken,
  tokenLoading,
  tokenError,
  onUnlink,
}: LinkPartnerTabProps) {
  const navigate = useNavigate();
  const [partnerToken, setPartnerToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  async function handleCopy() {
    if (!inviteToken) return;
    await navigator.clipboard.writeText(inviteToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerToken.trim()) {
      setLinkError("Partner token is required");
      return;
    }
    setLinkError("");
    setLinking(true);
    const res = await apiFetch("/couples/link", {
      method: "POST",
      body: JSON.stringify({ token: partnerToken.trim() }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setLinkError(data.error ?? "Failed to link accounts. Please try again.");
      setLinking(false);
      return;
    }
    setIsPaired(true);
    navigate("/");
  }

  async function handleUnlink() {
    setUnlinking(true);
    await onUnlink();
    setUnlinking(false);
  }

  if (paired) {
    return (
      <div className="profile-tab-pane">
        <p className="token-hint">You are linked with your partner.</p>
        <button
          type="button"
          className="btn-primary"
          onClick={handleUnlink}
          disabled={unlinking}
        >
          {unlinking ? "Unlinking…" : "Unlink partner"}
        </button>
      </div>
    );
  }

  return (
    <div className="profile-tab-pane">
      <section>
        <h2 className="onboarding-section-title">Your invite token</h2>
        {tokenLoading && <p className="token-hint">Generating your token…</p>}
        {tokenError && <p className="form-error">{tokenError}</p>}
        {inviteToken && (
          <>
            <div className="token-box">{inviteToken}</div>
            <button type="button" className="copy-link" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            <p className="token-hint">Expires in 72 hours · single use</p>
          </>
        )}
      </section>

      <div className="onboarding-divider">
        <span>or</span>
      </div>

      <form onSubmit={handleLinkSubmit} noValidate>
        <h2 className="onboarding-section-title">{`Paste partner's token`}</h2>
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
          {linking ? "Linking…" : "Link accounts"}
        </button>
      </form>
    </div>
  );
}
