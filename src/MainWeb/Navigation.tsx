import { useState, useEffect } from "react";
import logo from "../assets/logo.svg";
const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [activeLink, setActiveLink] = useState("Home");

  useEffect(() => {
    // Check both token and user keys in sessionStorage
    const checkSession = () => {
  const session = sessionStorage.getItem("t8_session");
  setHasSession(!!session);
};

    checkSession();

    const handleStorage = () => checkSession();
    window.addEventListener("storage", handleStorage);

    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <style>{`
        .nav-root {
          position: sticky;
          top: 0;
          z-index: 100;
          width: 100%;
          background: var(--color-white);
          font-family: var(--font-base);
          transition: box-shadow var(--transition-base);
        }

        .nav-root.scrolled {
          box-shadow: var(--shadow-md);
        }

        /* Gradient accent bar — reuses .divider-brand concept */
        .nav-accent-bar {
          height: 3px;
          background: var(--gradient-brand);
          width: 100%;
          border-radius: 0;
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 var(--space-6);
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }

        /* Logo */
        .nav-logo {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          text-decoration: none;
          flex-shrink: 0;
        }

        .nav-logo img {
          height: 45px;
          width: auto;
        }

        /* Links */
        .nav-links {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          list-style: none;
          margin: 0;
          padding: 0;
          flex: 1;
          justify-content: center;
        }

        .nav-links li a {
          position: relative;
          text-decoration: none;
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-text-secondary);
          padding: var(--space-1) 11px;
          border-radius: var(--radius-md);
          transition: color var(--transition-fast), background var(--transition-fast);
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        .nav-links li a::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -2px;
          transform: translateX(-50%) scaleX(0);
          width: 60%;
          height: 2px;
          border-radius: var(--radius-full);
          background: var(--gradient-brand);
          transition: transform var(--transition-base);
        }

        .nav-links li a:hover {
          color: var(--brand-orange);
          background: var(--brand-orange-light);
        }

        .nav-links li a:hover::after,
        .nav-links li a.active::after {
          transform: translateX(-50%) scaleX(1);
        }

        .nav-links li a.active {
          color: var(--brand-orange);
          font-weight: 600;
        }

        /* CTA Button — reuses .btn .btn-primary pattern */
        .nav-cta {
          flex-shrink: 0;
        }

        .nav-cta a {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          text-decoration: none;
          font-family: var(--font-base);
          font-size: var(--font-size-sm);
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 9px var(--space-5);
          border-radius: var(--radius-md);
          background: var(--gradient-orange);
          color: var(--color-white);
          box-shadow: var(--shadow-brand-orange);
          transition: transform var(--transition-fast),
                      box-shadow var(--transition-fast),
                      background var(--transition-fast);
          white-space: nowrap;
        }

        .nav-cta a:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(233,82,14,0.38);
          background: linear-gradient(135deg, var(--brand-orange-dark) 0%, var(--brand-orange) 100%);
        }

        .nav-cta a:active {
          transform: translateY(0);
        }

        /* Dashboard button — .btn-secondary style */
        .nav-cta a.dashboard {
          background: var(--gradient-blue);
          box-shadow: var(--shadow-brand-blue);
        }

        .nav-cta a.dashboard:hover {
          background: linear-gradient(135deg, var(--brand-blue-dark) 0%, var(--brand-blue) 100%);
          box-shadow: 0 6px 20px rgba(14,165,233,0.38);
        }

        /* Hamburger */
        .nav-hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: var(--space-1);
          border-radius: var(--radius-md);
          transition: background var(--transition-fast);
        }

        .nav-hamburger:hover {
          background: var(--color-bg-alt);
        }

        .nav-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          border-radius: var(--radius-full);
          background: var(--color-text-secondary);
          transition: transform var(--transition-slow), opacity var(--transition-slow);
        }

        .nav-hamburger.open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }
        .nav-hamburger.open span:nth-child(2) {
          opacity: 0;
        }
        .nav-hamburger.open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* Mobile menu */
        .nav-mobile {
          display: none;
          flex-direction: column;
          background: var(--color-white);
          border-top: 1px solid var(--color-border);
          padding: var(--space-2) var(--space-4) var(--space-5);
          gap: var(--space-1);
          box-shadow: var(--shadow-lg);
        }

        .nav-mobile.open {
          display: flex;
          animation: slideDown 0.22s cubic-bezier(0.4,0,0.2,1);
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .nav-mobile a {
          text-decoration: none;
          font-size: var(--font-size-base);
          font-weight: 500;
          color: var(--color-text-secondary);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          transition: color var(--transition-fast), background var(--transition-fast);
          display: flex;
          align-items: center;
          min-height: 44px;
        }

        .nav-mobile a:hover,
        .nav-mobile a.active {
          color: var(--brand-orange);
          background: var(--brand-orange-light);
        }

        .nav-mobile .mobile-divider {
          height: 1px;
          background: var(--color-border);
          margin: var(--space-2) 0;
        }

        .nav-mobile .mobile-cta {
          margin-top: var(--space-1);
        }

        .nav-mobile .mobile-cta a {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: var(--color-white);
          background: var(--gradient-orange);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          box-shadow: var(--shadow-brand-orange);
          min-height: 48px;
        }

        .nav-mobile .mobile-cta a.dashboard {
          background: var(--gradient-blue);
          box-shadow: var(--shadow-brand-blue);
        }

        /* Responsive — tablet */
        @media (max-width: 900px) {
          .nav-links li a {
            font-size: var(--font-size-xs);
            padding: var(--space-1) var(--space-2);
          }
          .nav-cta a {
            font-size: var(--font-size-xs);
            padding: var(--space-2) var(--space-3);
          }
        }

        /* Responsive — mobile */
        @media (max-width: 700px) {
          .nav-links,
          .nav-cta {
            display: none;
          }
          .nav-hamburger {
            display: flex;
          }
          .nav-inner {
            padding: 0 var(--space-4);
          }
        }
      `}</style>

      <nav className={`nav-root${scrolled ? " scrolled" : ""}`} role="navigation" aria-label="Main navigation">
        <div className="nav-accent-bar" />

        <div className="nav-inner">
          {/* Logo */}
          <a href="#home" className="nav-logo" aria-label="Go to homepage">
            <img src={logo} alt="Logo" />
          </a>

          {/* Desktop Links */}
          <ul className="nav-links" role="list">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  className={activeLink === label ? "active" : ""}
                  onClick={() => setActiveLink(label)}
                  aria-current={activeLink === label ? "page" : undefined}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop CTA */}
          <div className="nav-cta">
            {hasSession ? (
              <a href="/Account/Dashboard" className="dashboard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Go to Dashboard
              </a>
            ) : (
              <a href="/login">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Login / Register
              </a>
            )}
          </div>

          {/* Hamburger */}
          <button
            className={`nav-hamburger${menuOpen ? " open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`nav-mobile${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className={activeLink === label ? "active" : ""}
              onClick={() => { setActiveLink(label); setMenuOpen(false); }}
            >
              {label}
            </a>
          ))}
          <div className="mobile-divider" />
          <div className="mobile-cta">
            {hasSession ? (
              <a href="/Account/Dashboard" className="dashboard">Go to Dashboard</a>
            ) : (
              <a href="/login">Login / Register</a>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}