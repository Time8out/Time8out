import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import RightMenu from "./RightMenu";
import logo from "../assets/logo.svg";

interface LayoutProps {
  children: ReactNode;
}

interface User {
  FirstName: string;
  LastName: string;
  CompanyName: string;
}

function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const raw = sessionStorage.getItem("t8_session");
        if (!raw) return;
        const decoded = atob(raw);
        const email = decoded.split(":")[1];
        const { data, error } = await supabase
          .from("users")
          .select("FirstName, LastName, CompanyName")
          .eq("Email", email)
          .single();
        if (!error && data) setUser(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  // Close sidebar when clicking outside on mobile
  const handleOverlayClick = () => setSidebarOpen(false);

  return (
    <>
      <style>{`
        /* ── Layout shell ── */
        .layout-root {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: var(--font-base);
        }

        /* ── Top Nav ── */
        .layout-nav {
          width: 100%;
          height: 60px;
          background-color: var(--color-white);
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          padding: 0 var(--space-6);
          justify-content: space-between;
          box-shadow: var(--shadow-xs);
          position: sticky;
          top: 0;
          z-index: 100;
          box-sizing: border-box;
        }

        .layout-nav-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .layout-logo img {
          height: 32px;
          object-fit: contain;
          display: block;
        }

        /* Hamburger — only visible on mobile */
        .layout-hamburger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: var(--radius-md);
          border: 1.5px solid var(--color-border);
          background: transparent;
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }
        .layout-hamburger:hover {
          background: var(--brand-orange-light);
          border-color: var(--brand-orange);
          color: var(--brand-orange);
        }

        .layout-nav-right {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .layout-user {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .layout-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: var(--gradient-brand);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-white);
          font-weight: 700;
          font-size: var(--font-size-sm);
          flex-shrink: 0;
        }

        .layout-user-info {
          line-height: 1.3;
        }
        .layout-user-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text);
          white-space: nowrap;
        }
        .layout-user-company {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          white-space: nowrap;
        }

        /* Hide user text on very small screens, keep avatar */
        @media (max-width: 480px) {
          .layout-user-info { display: none; }
          .layout-nav { padding: 0 var(--space-4); }
          .layout-nav-right { gap: var(--space-3); }
        }

        .layout-divider {
          width: 1px;
          height: 28px;
          background-color: var(--color-border);
          flex-shrink: 0;
        }

        .layout-logout {
          background: transparent;
          border: 1.5px solid var(--color-border-dark);
          border-radius: var(--radius-md);
          padding: 6px 14px;
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-base);
          white-space: nowrap;
        }
        .layout-logout:hover {
          border-color: var(--color-danger);
          color: var(--color-danger);
          background: var(--color-danger-light);
        }

        /* ── Body: sidebar + content ── */
        .layout-body {
          display: flex;
          flex: 1;
        }

        /* ── Sidebar overlay (mobile) ── */
        .layout-sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 90;
          animation: overlay-in 0.2s ease;
        }
        @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
        .layout-sidebar-overlay.open { display: block; }

        /* ── Sidebar wrapper ── */
        .layout-sidebar-wrap {
          /* Desktop: static in flow */
          flex-shrink: 0;
        }

        /* ── Main content ── */
        .layout-content {
          flex: 1;
          min-width: 0;
          padding: var(--space-6);
          background-color: var(--color-bg);
        }

        /* ── Mobile breakpoint ── */
        @media (max-width: 768px) {
          .layout-hamburger { display: flex; }

          .layout-sidebar-wrap {
            position: fixed;
            top: 60px;
            left: 0;
            height: calc(100vh - 60px);
            z-index: 95;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
          }
          .layout-sidebar-wrap.open {
            transform: translateX(0);
          }

          .layout-content {
            padding: var(--space-4);
          }
        }
      `}</style>

      <div className="layout-root">

        {/* ── Top Nav ── */}
        <nav className="layout-nav">
          <div className="layout-nav-left">
            {/* Hamburger (mobile only) */}
            <button
              className="layout-hamburger"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? (
                /* X icon */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                /* Hamburger icon */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>

            {/* Logo */}
            <a href="/ETimeModule/EmployeeTime" className="layout-logo" style={{ textDecoration: "none" }}>
              <img src={logo} alt="Time8out" />
            </a>
          </div>

          {/* Right side */}
          <div className="layout-nav-right">
            {!loading && user && (
              <div className="layout-user">
                <div className="layout-avatar">
                  {user.FirstName?.[0]}{user.LastName?.[0]}
                </div>
                <div className="layout-user-info">
                  <div className="layout-user-name">{user.FirstName} {user.LastName}</div>
                  <div className="layout-user-company">{user.CompanyName}</div>
                </div>
              </div>
            )}

            <div className="layout-divider" />

            <button
              className="layout-logout"
              onClick={() => { sessionStorage.clear(); window.location.href = "/"; }}
            >
              Log out
            </button>
          </div>
        </nav>

        {/* ── Sidebar + Content ── */}
        <div className="layout-body">

          {/* Mobile overlay */}
          <div
            className={`layout-sidebar-overlay${sidebarOpen ? " open" : ""}`}
            onClick={handleOverlayClick}
          />

          {/* Sidebar */}
          <div className={`layout-sidebar-wrap${sidebarOpen ? " open" : ""}`}>
            <RightMenu onNavigate={() => setSidebarOpen(false)} />
          </div>

          {/* Page content */}
          <div className="layout-content">
            {children}
          </div>

        </div>
      </div>
    </>
  );
}

export default Layout;