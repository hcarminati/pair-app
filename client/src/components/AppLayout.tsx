import { Link, NavLink, Outlet } from 'react-router-dom'
import { getIsPaired } from '../lib/authStore'

export default function AppLayout() {
  const isPaired = getIsPaired()

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">Pair</div>
        <nav className="app-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
          >
            Discover
          </NavLink>
          <NavLink
            to="/inbound-requests"
            className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
          >
            Inbound Requests
          </NavLink>
          <NavLink
            to="/partner-interests"
            className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
          >
            {`Partner's Interests`}
          </NavLink>
          <NavLink
            to="/connections"
            className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
          >
            Connections
          </NavLink>
        </nav>
        <div className="app-sidebar-footer">
          {!isPaired && (
            <>
              <div className="partner-unlinked-card">
                <p className="partner-unlinked-title">Partner Unlinked</p>
                <p className="partner-unlinked-sub">Reconnect to continue</p>
              </div>
              <Link to="/profile" className="app-nav-link">
                Link Partner
              </Link>
            </>
          )}
          <NavLink
            to="/profile"
            className={({ isActive }) => `app-sidebar-profile-link${isActive ? ' app-sidebar-profile-link--active' : ''}`}
          >
            My Profile
          </NavLink>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
