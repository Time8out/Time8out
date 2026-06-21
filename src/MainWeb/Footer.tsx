// Footer.tsx — Time8out
// Dark brand footer matching Contact.tsx aesthetic
// Uses brand.css design system (brand-orange, brand-blue, DM Sans + Syne)

const NAV_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Use Cases",
    links: [
      { label: "Small Businesses", href: "#employee" },
      { label: "Gyms & Fitness Studios", href: "#gym" },
      { label: "ESL & Tutoring Centers", href: "#esl" },
      { label: "Other Industries", href: "#other" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Contact", href: "#contact" },
      { label: "Privacy Policy", href: "#privacy" },
      { label: "Terms of Service", href: "#terms" },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    label: "Facebook",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "#",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        /* ── Footer shell ── */
        .footer {
          font-family: var(--font-base);
          background: var(--color-white);
          border-top: 1px solid var(--color-border);
          position: relative;
          overflow: hidden;
        }

        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 var(--space-6);
        }

        /* ── Top CTA strip ── */
        .footer-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-6);
          padding: var(--space-12) 0;
          border-bottom: 1px solid var(--color-border);
        }
        .footer-cta-copy { display: flex; flex-direction: column; gap: var(--space-2); }
        .footer-cta-eyebrow {
          display: inline-flex; align-items: center; gap: var(--space-2);
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--brand-orange);
        }
        .footer-cta-headline {
          font-family: 'Syne', sans-serif;
          font-size: clamp(22px, 2.5vw, 32px);
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.025em;
          color: var(--color-text);
        }
        .footer-cta-headline em {
          font-style: normal;
          background: var(--gradient-brand);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .footer-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 13px 28px;
          border-radius: var(--radius-md);
          border: none;
          background: var(--gradient-orange);
          color: var(--color-white);
          font-family: var(--font-base);
          font-size: var(--font-size-base);
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: var(--shadow-brand-orange);
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .footer-cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(233,82,14,0.38);
        }

        /* ── Main grid ── */
        .footer-main {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--space-16);
          padding: var(--space-12) 0;
          border-bottom: 1px solid var(--color-border);
        }

        /* Brand column */
        .footer-brand {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }
        .footer-logo {
          display: inline-flex;
          align-items: center;
          gap: var(--space-3);
          text-decoration: none;
        }
        .footer-logo-mark {
          width: 42px; height: 42px;
          border-radius: var(--radius-md);
          background: var(--gradient-orange);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          box-shadow: var(--shadow-brand-orange);
          flex-shrink: 0;
        }
        .footer-logo-name {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--color-text);
        }
        .footer-logo-name span {
          background: var(--gradient-brand);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .footer-brand-desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }

        /* Social links */
        .footer-socials {
          display: flex;
          gap: var(--space-3);
        }
        .footer-social-link {
          width: 36px; height: 36px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-dark);
          background: var(--color-bg);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          text-decoration: none;
          transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s;
        }
        .footer-social-link:hover {
          background: rgba(233,82,14,0.15);
          border-color: rgba(233,82,14,0.35);
          color: var(--brand-orange);
          transform: translateY(-2px);
        }

        /* Location badge */
        .footer-location {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          letter-spacing: 0.03em;
          width: fit-content;
        }

        /* Nav columns */
        .footer-nav {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-8);
        }
        .footer-nav-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .footer-nav-heading {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-faint);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--color-border);
        }
        .footer-nav-links {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .footer-nav-link {
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-text-muted);
          text-decoration: none;
          transition: color 0.15s, transform 0.15s;
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          width: fit-content;
        }
        .footer-nav-link:hover {
          color: var(--brand-orange);
          transform: translateX(3px);
        }

        /* ── Bottom bar ── */
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-6) 0;
          flex-wrap: wrap;
        }
        .footer-copyright {
          font-size: var(--font-size-xs);
          color: var(--color-text-faint);
          line-height: 1.6;
          letter-spacing: 0.01em;
        }
        .footer-copyright a {
          color: var(--color-text-muted);
          text-decoration: none;
          transition: color 0.15s;
        }
        .footer-copyright a:hover { color: var(--brand-orange); }

        .footer-bottom-links {
          display: flex;
          align-items: center;
          gap: var(--space-5);
        }
        .footer-bottom-link {
          font-size: var(--font-size-xs);
          color: var(--color-text-faint);
          text-decoration: none;
          letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .footer-bottom-link:hover { color: var(--color-text-secondary); }

        .footer-bottom-dot {
          width: 3px; height: 3px;
          border-radius: 50%;
          background: var(--color-border-dark);
          flex-shrink: 0;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .footer-main {
            grid-template-columns: 1fr;
            gap: var(--space-10);
          }
        }
        @media (max-width: 768px) {
          .footer-cta {
            flex-direction: column;
            align-items: flex-start;
          }
          .footer-nav {
            grid-template-columns: repeat(2, 1fr);
          }
          .footer-bottom {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-3);
          }
        }
        @media (max-width: 480px) {
          .footer-nav { grid-template-columns: 1fr; }
          .footer-inner { padding: 0 var(--space-4); }
        }
      `}</style>

      <footer className="footer">
        <div className="footer-inner">

          {/* ── CTA strip ── */}
          <div className="footer-cta">
            <div className="footer-cta-copy">
              <span className="footer-cta-eyebrow">⏱️ Ready to start?</span>
              <div className="footer-cta-headline">
                Stop losing track of<br />
                <em>who's in and who's out.</em>
              </div>
            </div>
            <a href="#contact" className="footer-cta-btn">
              Get in touch →
            </a>
          </div>

          {/* ── Main grid: brand + nav ── */}
          <div className="footer-main">

            {/* Brand column */}
            <div className="footer-brand">
              <a href="#" className="footer-logo">
                <div className="footer-logo-mark">⏱</div>
                <span className="footer-logo-name">
                  Time<span>8out</span>
                </span>
              </a>

              <p className="footer-brand-desc">
                Simple, reliable attendance tracking for small businesses,
                gyms, and ESL schools in the Philippines. Built by someone
                who actually lives the problem.
              </p>

              <div className="footer-socials">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    className="footer-social-link"
                    aria-label={s.label}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>

              <div className="footer-location">
                📍 Baguio City, Philippines
              </div>
            </div>

            {/* Nav columns */}
            <nav className="footer-nav" aria-label="Footer navigation">
              {NAV_LINKS.map((col) => (
                <div key={col.heading} className="footer-nav-col">
                  <div className="footer-nav-heading">{col.heading}</div>
                  <div className="footer-nav-links">
                    {col.links.map((link) => (
                      <a key={link.label} href={link.href} className="footer-nav-link">
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

          </div>

          {/* ── Bottom bar ── */}
          <div className="footer-bottom">
            <p className="footer-copyright">
              © {currentYear} Time8out. Built with care by{" "}
              <a href="mailto:servicesjmseptember@gmail.com">Time8out</a>.
            </p>
            <div className="footer-bottom-links">
              <a href="#privacy" className="footer-bottom-link">Privacy Policy</a>
              <div className="footer-bottom-dot" />
              <a href="#terms" className="footer-bottom-link">Terms of Service</a>
              <div className="footer-bottom-dot" />
              <a href="#contact" className="footer-bottom-link">Contact</a>
            </div>
          </div>

        </div>
      </footer>
    </>
  );
}