import { useState } from "react";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName || !email || !password) {
      setError("All fields are required");
      return;
    }
    setError("");
    // TODO: call POST /auth/register
    console.log("register", { displayName, email, password });
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-panel-content">
          <h1 className="auth-title">Create account</h1>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {error && <p className="form-error">{error}</p>}
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
            <button type="submit" className="btn-primary">
              Create account
            </button>
          </form>
          <p className="auth-link">
            Already have an account? <Link to="/login">Login</Link>
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
