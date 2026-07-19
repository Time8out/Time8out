// About.tsx — Time8out
// Story-driven editorial layout: origin, problem, solution, vision

const PROBLEMS = [
  {
    icon: "📋",
    label: "Spreadsheet chaos",
    desc: "Manually tracking clock-ins on Google Sheets — error-prone, hard to audit, and a nightmare to summarize at payroll.",
  },
  {
    icon: "📝",
    label: "Paper sign-in logs",
    desc: "Notebooks at the reception desk. Illegible handwriting, lost pages, no real-time visibility for managers.",
  },
  {
    icon: "💬",
    label: "Chat-based updates",
    desc: '"Sir, I\'m Here" texts in a group chat. No timestamps, no accountability, no archive.',
  },
];

const PILLARS = [
  {
    icon: "⏱️",
    title: "Clock In & Out",
    color: "var(--brand-orange)",
    bg: "var(--brand-orange-light)",
    border: "var(--brand-orange-muted)",
    points: [
      "One-tap clock in & clock out",
      "QR code or proximity card scanning",
      "Break and lunch logging",
      "Overtime detection",
    ],
  },
  {
    icon: "📊",
    title: "Attendance Monitoring",
    color: "var(--brand-blue)",
    bg: "var(--brand-blue-light)",
    border: "var(--brand-blue-muted)",
    points: [
      "Live manager dashboard",
      "Auto time-out for missed punches",
      "Late, absent & early-out tracking",
      "Full attendance history",
    ],
  },
  {
    icon: "💰",
    title: "Payroll Ready",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    points: [
      "Hourly, daily & monthly pay structures",
      "Custom deduction & bonus formulas",
      "Auto deduction from time violations",
      "Per-period payslip generation",
    ],
  },
];

const STATS = [
  { value: "1", label: "Focused vertical — Employee Time", suffix: "" },
  { value: "100", label: "% free to start", suffix: "%" },
  { value: "SMEs", label: "Primary audience", suffix: "" },
  { value: "1", label: "Developer. Marlon.", suffix: "" },
];

export default function About() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        .about { background: var(--color-white); font-family: var(--font-base); overflow: hidden; }

        /* ── 1. ORIGIN BAND ── */
        .about-origin { background: var(--color-text); position: relative; overflow: hidden; padding: var(--space-20) var(--space-6); }
        .about-origin-noise { position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); background-size: 200px 200px; opacity: 0.35; pointer-events: none; }
        .about-origin-glow { position: absolute; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(233,82,14,0.18) 0%, transparent 65%); top: -200px; right: -150px; pointer-events: none; }
        .about-origin-inner { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-16); align-items: center; }

        .about-origin-copy { display: flex; flex-direction: column; gap: var(--space-6); }
        .about-kicker { display: inline-flex; align-items: center; gap: var(--space-2); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-orange); padding-bottom: var(--space-2); border-bottom: 1px solid rgba(233,82,14,0.3); width: fit-content; }
        .about-origin-headline { font-family: 'Syne', sans-serif; font-size: clamp(32px, 4vw, 52px); font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; color: #ffffff; }
        .about-origin-headline em { font-style: normal; background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .about-origin-body { font-size: var(--font-size-md); line-height: 1.75; color: rgba(255,255,255,0.62); max-width: 480px; }
        .about-origin-body strong { color: rgba(255,255,255,0.9); font-weight: 600; }

        .about-creator { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-xl); padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-5); backdrop-filter: blur(12px); }
        .about-creator-top { display: flex; align-items: center; gap: var(--space-4); }
        .about-creator-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--gradient-orange); display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: white; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(233,82,14,0.3); }
        .about-creator-name { font-family: 'Syne', sans-serif; font-size: var(--font-size-lg); font-weight: 800; color: white; }
        .about-creator-title { font-size: var(--font-size-sm); color: rgba(255,255,255,0.5); margin-top: 2px; }
        .about-creator-location { display: inline-flex; align-items: center; gap: 5px; font-size: var(--font-size-xs); color: var(--brand-orange); font-weight: 600; letter-spacing: 0.03em; }
        .about-creator-quote { font-size: var(--font-size-base); line-height: 1.7; color: rgba(255,255,255,0.7); border-left: 3px solid var(--brand-orange); padding-left: var(--space-4); font-style: italic; }
        .about-creator-quote strong { color: white; font-style: normal; }

        /* ── 2. PROBLEM STRIP ── */
        .about-problem { background: var(--color-bg); padding: var(--space-16) var(--space-6); position: relative; }
        .about-problem::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--gradient-brand); }
        .about-problem-inner { max-width: 1200px; margin: 0 auto; }
        .about-problem-header { display: grid; grid-template-columns: auto 1fr; gap: var(--space-8); align-items: end; margin-bottom: var(--space-10); }
        .about-problem-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-faint); margin-bottom: var(--space-2); }
        .about-problem-title { font-family: 'Syne', sans-serif; font-size: clamp(26px, 3vw, 40px); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--color-text); }
        .about-problem-title span { background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .about-problem-note { font-size: var(--font-size-base); color: var(--color-text-muted); line-height: 1.7; max-width: 380px; align-self: end; }
        .about-problem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); }
        .about-problem-card { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); transition: box-shadow 0.2s, transform 0.2s; }
        .about-problem-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); }
        .about-problem-icon { width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--color-bg-alt); display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .about-problem-card h4 { font-family: 'Syne', sans-serif; font-size: var(--font-size-base); font-weight: 700; color: var(--color-text); }
        .about-problem-card p { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.65; }
        .about-problem-arrow { width: 28px; height: 28px; border-radius: 50%; background: var(--brand-orange-light); border: 1px solid var(--brand-orange-muted); display: flex; align-items: center; justify-content: center; color: var(--brand-orange); font-size: 14px; margin-top: auto; }

        /* ── 3. SOLUTION PILLARS ── */
        .about-solution { background: var(--color-white); padding: var(--space-20) var(--space-6); }
        .about-solution-inner { max-width: 1200px; margin: 0 auto; }
        .about-solution-header { text-align: center; margin-bottom: var(--space-12); }
        .about-section-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-orange); display: block; margin-bottom: var(--space-3); }
        .about-solution-title { font-family: 'Syne', sans-serif; font-size: clamp(28px, 3.5vw, 44px); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--color-text); margin-bottom: var(--space-4); }
        .about-solution-sub { font-size: var(--font-size-md); color: var(--color-text-muted); line-height: 1.7; max-width: 520px; margin: 0 auto; }
        .about-pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); }
        .about-pillar { border-radius: var(--radius-xl); border: 1.5px solid; padding: var(--space-8) var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); position: relative; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
        .about-pillar:hover { transform: translateY(-4px); box-shadow: var(--shadow-xl); }
        .about-pillar-badge { position: absolute; top: var(--space-4); right: var(--space-4); font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 9px; border-radius: var(--radius-full); background: rgba(233,82,14,0.15); color: var(--brand-orange-dark); }
        .about-pillar-icon { font-size: 32px; }
        .about-pillar-title { font-family: 'Syne', sans-serif; font-size: var(--font-size-xl); font-weight: 800; color: var(--color-text); }
        .about-pillar-points { display: flex; flex-direction: column; gap: var(--space-2); }
        .about-pillar-point { display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; }
        .about-pillar-check { width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; margin-top: 1px; font-weight: 700; color: white; }

        /* ── 4. MISSION ── */
        .about-mission { background: var(--color-bg); padding: var(--space-16) var(--space-6); border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
        .about-mission-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-16); align-items: center; }
        .about-mission-copy { display: flex; flex-direction: column; gap: var(--space-5); }
        .about-mission-headline { font-family: 'Syne', sans-serif; font-size: clamp(26px, 3vw, 38px); font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; color: var(--color-text); }
        .about-mission-headline em { font-style: normal; color: var(--brand-orange); }
        .about-mission-body { font-size: var(--font-size-base); color: var(--color-text-muted); line-height: 1.75; }
        .about-mission-body strong { color: var(--color-text); font-weight: 600; }
        .about-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        .about-stat-card { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-2); transition: box-shadow 0.2s; }
        .about-stat-card:hover { box-shadow: var(--shadow-md); }
        .about-stat-val { font-family: 'Syne', sans-serif; font-size: var(--font-size-3xl); font-weight: 800; line-height: 1; background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .about-stat-lbl { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.4; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .about-origin-inner, .about-mission-inner { grid-template-columns: 1fr; gap: var(--space-10); }
          .about-problem-header { grid-template-columns: 1fr; gap: var(--space-4); }
          .about-problem-note { max-width: 100%; }
          .about-pillars { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
        }
        @media (max-width: 768px) {
          .about-problem-grid { grid-template-columns: 1fr; }
          .about-stats-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .about-stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="about" id="about">

        {/* ── 1. ORIGIN ── */}
        <div className="about-origin">
          <div className="about-origin-noise" />
          <div className="about-origin-glow" />
          <div className="about-origin-inner">
            <div className="about-origin-copy">
              <span className="about-kicker">⚡ Why Time8out exists</span>
              <h2 className="about-origin-headline">
                Built from watching<br />
                businesses <em>struggle</em><br />
                with a notebook.
              </h2>
              <p className="about-origin-body">
                Walking through <strong>small business districts</strong> — offices,
                BPO teams, retail stores — the same scene kept repeating:
                someone at a desk, tracking employee attendance on a spreadsheet
                or a paper logbook, spending hours on something that should take seconds.
              </p>
              <p className="about-origin-body">
                Time8out was built to <strong>bridge that gap</strong> — to give every
                starting-up business the kind of professional time management
                system that used to only be accessible to large enterprises.
              </p>
            </div>
            <div className="about-creator">
              <div className="about-creator-top">
                <div className="about-creator-avatar">MA</div>
                <div>
                  <div className="about-creator-name">Marlon Ampoon</div>
                  <div className="about-creator-title">Founder & Developer, Time8out</div>
                  <div className="about-creator-location" style={{ marginTop: "6px" }}>📍 Philippines</div>
                </div>
              </div>
              <blockquote className="about-creator-quote">
                "I saw small business owners spending their Sunday nights
                reconciling attendance on Excel, manually computing deductions,
                and chasing employees for sign-in logs.<br /><br />
                <strong>There had to be a better way — and it didn't need to cost a fortune.</strong>"
              </blockquote>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["SME-focused", "Open beta"].map(tag => (
                  <span key={tag} style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. PROBLEM ── */}
        <div className="about-problem">
          <div className="about-problem-inner">
            <div className="about-problem-header">
              <div>
                <div className="about-problem-eyebrow">The problem</div>
                <h2 className="about-problem-title">
                  Most small businesses are<br />
                  still doing this <span>manually.</span>
                </h2>
              </div>
              <p className="about-problem-note">
                Enterprise software is overkill. Spreadsheets are fragile.
                Time8out fills the gap with a system that's simple enough for day one,
                powerful enough to grow with you.
              </p>
            </div>
            <div className="about-problem-grid">
              {PROBLEMS.map(p => (
                <div className="about-problem-card" key={p.label}>
                  <div className="about-problem-icon">{p.icon}</div>
                  <h4>{p.label}</h4>
                  <p>{p.desc}</p>
                  <div className="about-problem-arrow">→</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. SOLUTION ── */}
        <div className="about-solution" id="services">
          <div className="about-solution-inner">
            <div className="about-solution-header">
              <span className="about-section-kicker">What Time8out does</span>
              <h2 className="about-solution-title">
                Everything you need to manage<br />
                employee time — in one place.
              </h2>
              <p className="about-solution-sub">
                From clock-in to payslip, Time8out handles the full employee time
                tracking cycle with automation, real-time visibility, and flexible
                pay computation built in.
              </p>
            </div>
            <div className="about-pillars">
              {PILLARS.map(p => (
                <div key={p.title} className="about-pillar" style={{ background: p.bg, borderColor: p.border }}>
                  <span className="about-pillar-badge">Live now</span>
                  <div className="about-pillar-icon">{p.icon}</div>
                  <div className="about-pillar-title">{p.title}</div>
                  <div className="about-pillar-points">
                    {p.points.map(pt => (
                      <div className="about-pillar-point" key={pt}>
                        <span className="about-pillar-check" style={{ background: p.color }}>✓</span>
                        {pt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 4. MISSION ── */}
        <div className="about-mission">
          <div className="about-mission-inner">
            <div className="about-mission-copy">
              <span className="about-section-kicker">Our mission</span>
              <h2 className="about-mission-headline">
                Professional tools<br />
                for businesses that are<br />
                <em>just getting started.</em>
              </h2>
              <p className="about-mission-body">
                You shouldn't need a full IT department or a ₱50,000/month enterprise
                contract just to know who's clocked in today. Time8out gives
                <strong> small businesses</strong> the same professional-grade time
                management that big companies take for granted — at a price that
                actually makes sense.
              </p>
              <p className="about-mission-body">
                Built <strong>by a Filipino developer, for hardworking business owners</strong> who
                deserve better tools without the enterprise price tag.
              </p>
            </div>
            <div className="about-stats-grid">
              {STATS.map(s => (
                <div className="about-stat-card" key={s.label}>
                  <div className="about-stat-val">{s.value}{s.suffix}</div>
                  <div className="about-stat-lbl">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>
    </>
  );
}