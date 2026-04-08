import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { setIsPaired, setTokens } from "../lib/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("All fields are required");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: { access_token: string; refresh_token: string };
        partnerId?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }
      if (data.session) {
        setTokens(data.session.access_token, data.session.refresh_token);
      }
      setIsPaired(!!data.partnerId);
      navigate(data.partnerId ? "/" : "/profile");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-panel-content">
          <h1 className="auth-title">Log in</h1>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {error && <p className="form-error">{error}</p>}
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              <span className="btn-primary-inner">
                {isSubmitting && <span className="btn-spinner" />}
                {isSubmitting ? "Logging in…" : "Log in"}
              </span>
            </button>
          </form>
          <p className="auth-link">
            No account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
      <div className="auth-info-panel">
        <div className="auth-info-content">
          <h2 className="auth-info-title">How it works</h2>
          <ol className="auth-steps">
            <li>Both partners register</li>
            <li>Link with your partner</li>
            <li>Both opt in to connect</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
