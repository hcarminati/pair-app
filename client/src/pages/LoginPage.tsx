import { useState } from "react";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("All fields are required");
      return;
    }
    setError("");
    // TODO: call POST /auth/login
    console.log("login", { email, password });
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
            <button type="submit" className="btn-primary">
              Log in
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
