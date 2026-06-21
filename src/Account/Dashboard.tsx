// Dashboard.tsx — Time8out

import React, { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import logo from "../assets/logo.svg";

type UserRow = {
  FirstName: string;
  LastName: string;
  UserName: string;
  CompanyName: string;
  Email: string;
  System: Array<{
    EmployeeTime: string;
    GymTracker: string;
    ESLScheduler: string;
  }>;
};

type SystemConfig = {
  sysKey: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  colorLight: string;
  gradient: string;
};

const SYSTEMS: SystemConfig[] = [
  {
    sysKey: "EmployeeTime",
    label: "Employee Time Tracker",
    desc: "Clock-in/out, timesheets, attendance reports, and overtime tracking for your team.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    href: "/ETimeModule/EmployeeTime",
    color: "var(--brand-orange)",
    colorLight: "var(--brand-orange-light)",
    gradient: "var(--gradient-orange)",
  },
  {
    sysKey: "GymTracker",
    label: "Gym & Subscription Tracker",
    desc: "Member management, subscription billing, and gym access logs.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
    href: "/Account/GymTracker",
    color: "var(--brand-blue)",
    colorLight: "var(--brand-blue-light)",
    gradient: "var(--gradient-blue)",
  },
  {
    sysKey: "ESLScheduler",
    label: "ESL Class Scheduler",
    desc: "Class bookings, student progress tracking, and teacher schedule management.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    href: "/Account/ESLScheduler",
    color: "#8b5cf6",
    colorLight: "#ede9fe",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
  },
];

export default function Dashboard() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const fetchUser = async () => {
      const token = sessionStorage.getItem("t8_session");
      if (!token) { window.location.href = "/login"; return; }
      try {
        const decoded = atob(token);
        const email = decoded.split(":")[1];
        const { data } = await supabase
          .from("users")
          .select("FirstName, LastName, UserName, CompanyName, Email, System")
          .eq("Email", email)
          .single();
        setUser(data ?? null);
      } catch {
        sessionStorage.clear();
        window.location.href = "/login";
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const greeting = () => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const systemAccess = user?.System?.[0] ?? null;

  const isEnabled = (sysKey: string): boolean => {
    if (!systemAccess) return false;
    return (systemAccess as Record<string, string>)[sysKey] === "YES";
  };

  const renderSystemCard = (sys: SystemConfig) => {
    const active = isEnabled(sys.sysKey);

    if (active) {
      return (
        <a key={sys.sysKey} href={sys.href} className="dash-sys-card enabled">
          <div className="dash-sys-card-strip" style={{ background: sys.gradient }} />
          <div className="dash-sys-icon-wrap" style={{ background: sys.colorLight, color: sys.color }}>
            {sys.icon}
          </div>
          <div className="dash-sys-body">
            <div className="dash-sys-name">{sys.label}</div>
            <div className="dash-sys-desc">{sys.desc}</div>
          </div>
          <div className="dash-sys-footer">
            <span className="dash-sys-badge active-badge">
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
              Active
            </span>
            <div className="dash-sys-arrow" style={{ color: sys.color }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        </a>
      );
    }

    return (
      <div key={sys.sysKey} className="dash-sys-card disabled">
        <div className="dash-sys-card-strip" style={{ background: "var(--color-border)" }} />
        <div className="dash-sys-icon-wrap" style={{ background: "var(--color-bg-alt)", color: "var(--color-text-faint)" }}>
          {sys.icon}
        </div>
        <div className="dash-sys-body">
          <div className="dash-sys-name">{sys.label}</div>
          <div className="dash-sys-desc">{sys.desc}</div>
        </div>
        <div className="dash-sys-footer">
          <span className="dash-sys-badge inactive-badge">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
            Not enabled
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        /* ── Reset ── */
        *, *::before, *::after { box-sizing: border-box; }

        .dash-page {
          min-height: 100vh;
          background: var(--color-bg);
          font-family: var(--font-base);
        }

        .dash-accent-bar {
          height: 3px;
          background: var(--gradient-brand);
          width: 100%;
        }

        /* ══════════════ NAV ══════════════ */
        .dash-nav {
          background: var(--color-white);
          box-shadow: var(--shadow-md);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .dash-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 var(--space-6);
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }
        .dash-nav-logo img {
          height: 40px;
          width: auto;
          display: block;
        }
        .dash-nav-right {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          min-width: 0;
        }
        .dash-nav-user {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          min-width: 0;
        }
        .dash-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--gradient-orange);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: var(--font-size-sm);
          flex-shrink: 0;
        }
        .dash-nav-user-text {
          min-width: 0;
          overflow: hidden;
        }
        .dash-nav-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dash-nav-company {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dash-logout {
          padding: 7px var(--space-4);
          border-radius: var(--radius-md);
          border: 1.5px solid var(--color-border);
          background: transparent;
          font-family: var(--font-base);
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: border-color var(--transition-fast), color var(--transition-fast);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .dash-logout:hover {
          border-color: var(--brand-orange);
          color: var(--brand-orange);
        }

        /* Nav responsive */
        @media (max-width: 600px) {
          .dash-nav-inner {
            padding: 0 var(--space-4);
            height: 58px;
          }
          .dash-nav-logo img { height: 32px; }
          /* Hide name/company text, keep avatar */
          .dash-nav-user-text { display: none; }
          .dash-nav-right { gap: var(--space-3); }
          /* Shorten logout button */
          .dash-logout {
            padding: 6px 10px;
            font-size: var(--font-size-xs);
          }
        }

        /* ══════════════ MAIN ══════════════ */
        .dash-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-10) var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-10);
        }

        /* ══════════════ HERO ══════════════ */
        .dash-hero {
          background: var(--color-white);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-md);
          padding: var(--space-8) var(--space-10);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-6);
          position: relative;
          overflow: hidden;
        }
        .dash-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: var(--gradient-brand);
        }
        .dash-hero::after {
          content: '';
          position: absolute;
          right: -60px; top: -60px;
          width: 260px; height: 260px;
          border-radius: 50%;
          background: var(--gradient-brand);
          opacity: 0.04;
          pointer-events: none;
        }
        .dash-hero-greeting {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--brand-orange);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: var(--space-2);
        }
        .dash-hero-name {
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--color-text);
          line-height: 1.2;
          margin-bottom: var(--space-2);
        }
        .dash-hero-sub {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }
        .dash-hero-right {
          text-align: right;
          flex-shrink: 0;
        }
        .dash-clock {
          font-size: 2.2rem;
          font-weight: 700;
          letter-spacing: -0.04em;
          color: var(--color-text);
          line-height: 1;
          margin-bottom: var(--space-1);
        }
        .dash-date {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          font-weight: 500;
        }

        /* Hero responsive */
        @media (max-width: 640px) {
          .dash-hero {
            flex-direction: column;
            align-items: flex-start;
            padding: var(--space-6) var(--space-6);
            gap: var(--space-5);
          }
          .dash-hero-right {
            text-align: left;
            width: 100%;
            padding-top: var(--space-4);
            border-top: 1px solid var(--color-border);
          }
          .dash-hero-name { font-size: 1.5rem; }
          .dash-clock { font-size: 1.8rem; }
        }

        /* ══════════════ SECTION HEAD ══════════════ */
        .dash-section-head {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: var(--space-5);
        }
        .dash-section-title {
          font-size: var(--font-size-md);
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.02em;
        }
        .dash-section-sub {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }

        /* ══════════════ SYSTEM CARDS ══════════════ */
        .dash-systems {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-5);
        }
        @media (max-width: 900px) {
          .dash-systems { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .dash-systems { grid-template-columns: 1fr; }
        }

        .dash-sys-card {
          background: var(--color-white);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          text-decoration: none;
          position: relative;
          overflow: hidden;
          transition: box-shadow var(--transition-fast), transform var(--transition-fast), border-color var(--transition-fast);
        }
        .dash-sys-card.enabled {
          cursor: pointer;
          box-shadow: var(--shadow-sm);
        }
        .dash-sys-card.enabled:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-3px);
        }
        .dash-sys-card.disabled {
          cursor: not-allowed;
          background: var(--color-bg);
          opacity: 0.55;
          filter: grayscale(0.3);
        }
        .dash-sys-card-strip {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          transition: height var(--transition-fast);
        }
        .dash-sys-card.enabled:hover .dash-sys-card-strip { height: 5px; }
        .dash-sys-icon-wrap {
          width: 52px; height: 52px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: var(--space-2);
        }
        .dash-sys-body { flex: 1; }
        .dash-sys-name {
          font-size: var(--font-size-base);
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.01em;
          margin-bottom: var(--space-2);
        }
        .dash-sys-desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
          line-height: 1.6;
        }
        .dash-sys-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: var(--space-3);
          border-top: 1px solid var(--color-border);
          margin-top: auto;
        }
        .dash-sys-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: var(--font-size-xs);
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: var(--radius-full);
        }
        .dash-sys-badge.active-badge {
          background: var(--color-success-light);
          color: var(--color-success);
        }
        .dash-sys-badge.inactive-badge {
          background: var(--color-bg-alt);
          color: var(--color-text-faint);
        }
        .dash-sys-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px; height: 30px;
          border-radius: 50%;
          transition: transform var(--transition-fast);
        }
        .dash-sys-card.enabled:hover .dash-sys-arrow { transform: translateX(3px); }

        /* ══════════════ UTILITIES ══════════════ */
        .dash-skeleton {
          background: linear-gradient(90deg, var(--color-bg) 25%, var(--color-border) 50%, var(--color-bg) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: var(--radius-md);
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .dash-fade-in {
          animation: dash-rise 0.4s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes dash-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Main content responsive */
        @media (max-width: 640px) {
          .dash-main {
            padding: var(--space-6) var(--space-4);
            gap: var(--space-6);
          }
        }
      `}</style>

      <div className="dash-page">
        <div className="dash-accent-bar" />

        {/* ── Nav ── */}
        <nav className="dash-nav">
          <div className="dash-nav-inner">
            <a href="/Account/Dashboard" className="dash-nav-logo">
              <img src={logo} alt="Time8out" />
            </a>

            <div className="dash-nav-right">
              {!loading && user && (
                <div className="dash-nav-user">
                  <div className="dash-avatar">
                    {user.FirstName?.[0]}{user.LastName?.[0]}
                  </div>
                  <div className="dash-nav-user-text">
                    <div className="dash-nav-name">{user.FirstName} {user.LastName}</div>
                    <div className="dash-nav-company">{user.CompanyName}</div>
                  </div>
                </div>
              )}

              <button
                className="dash-logout"
                onClick={() => { sessionStorage.clear(); window.location.href = "/"; }}
              >
                Log out
              </button>
            </div>
          </div>
        </nav>

        {/* ── Main ── */}
        <main className="dash-main dash-fade-in">

          {/* Hero */}
          <div className="dash-hero">
            <div>
              <div className="dash-hero-greeting">{greeting()}</div>
              {loading ? (
                <div className="dash-skeleton" style={{ width: 220, height: 36, marginBottom: 8 }} />
              ) : (
                <div className="dash-hero-name">
                  {user ? `${user.FirstName} ${user.LastName}` : "Welcome"}
                </div>
              )}
              <div className="dash-hero-sub">
                {loading ? (
                  <div className="dash-skeleton" style={{ width: 160, height: 16 }} />
                ) : (
                  user ? `${user.CompanyName} · @${user.UserName}` : "Welcome to your Time8out dashboard."
                )}
              </div>
            </div>
            <div className="dash-hero-right">
              <div className="dash-clock">{formatTime(time)}</div>
              <div className="dash-date">{formatDate(time)}</div>
            </div>
          </div>

          {/* Systems */}
          <div>
            <div className="dash-section-head">
              <div className="dash-section-title">Your Systems</div>
              <div className="dash-section-sub">Select a system to get started.</div>
            </div>
            <div className="dash-systems">
              {SYSTEMS.map((sys) => renderSystemCard(sys))}
            </div>
          </div>

        </main>
      </div>
    </>
  );
}