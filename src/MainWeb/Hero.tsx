import { useState, useEffect } from "react";

// ── Live clock SVG ──────────────────────────────────────────────────────────
function AnimatedClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = time.getSeconds();
  const m = time.getMinutes();
  const h = time.getHours() % 12;
  const sDeg = s * 6;
  const mDeg = m * 6 + s * 0.1;
  const hDeg = h * 30 + m * 0.5;
  const pt = (deg: number, r: number) => ({
    x: 32 + r * Math.sin((deg * Math.PI) / 180),
    y: 32 - r * Math.cos((deg * Math.PI) / 180),
  });
  const sp = pt(sDeg, 20), mp = pt(mDeg, 15), hp = pt(hDeg, 10);
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="29" stroke="var(--color-border)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="29" stroke="var(--brand-orange)" strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${(s / 60) * 182} 182`}
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      {[...Array(12)].map((_, i) => {
        const p = pt(i * 30, 24);
        return <circle key={i} cx={p.x} cy={p.y} r="1.2" fill="var(--color-border-dark)" />;
      })}
      <line x1="32" y1="32" x2={hp.x} y2={hp.y} stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="32" x2={mp.x} y2={mp.y} stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="32" x2={sp.x} y2={sp.y} stroke="var(--brand-orange)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.5" fill="var(--brand-orange)" />
    </svg>
  );
}

// ── Live session timer ──────────────────────────────────────────────────────
function useLiveTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Recent log entries ──────────────────────────────────────────────────────
const LOG_ENTRIES = [
  { name: "Maria S.", action: "Clocked in · 21:05", time: "9:05 PM", status: "in" },
  { name: "James L.", action: "Break out · 23:35",  time: "11:35 PM", status: "break" },
  { name: "Ana R.",   action: "Auto time-out · 06:30", time: "6:30 AM", status: "out" },
  { name: "Tom K.",   action: "Clocked in · 21:12", time: "9:12 PM", status: "in" },
];

const FEATURES = [
  {
    icon: "⏱️",
    label: "Clock In & Out",
    desc: "QR, barcode, or proximity card scanning",
    color: "var(--brand-orange)",
    bg: "var(--brand-orange-light)",
    border: "var(--brand-orange-muted)",
  },
  {
    icon: "☕",
    label: "Break Tracking",
    desc: "Lunch, short breaks — all logged separately",
    color: "var(--brand-blue)",
    bg: "var(--brand-blue-light)",
    border: "var(--brand-blue-muted)",
  },
  {
    icon: "💰",
    label: "Payroll Ready",
    desc: "Auto deductions, bonuses & payslip generation",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
];

const PAYSLIP_PREVIEW = {
  name: "Maria S.",
  period: "Jun 1 – Jun 15",
  schedule: "21:00 – 06:00",
  hours: "135h",
  rate: "Monthly · ₱15,000",
  grossPay: "₱15,000.00",
  deductions: [
    { label: "Late / Overbreak (163 mins)", amount: "−₱302.08" },
    { label: "Tax · {Salary} × .05", amount: "−₱750.00" },
  ],
  bonus: { label: "Perfect Attendance", amount: "+₱1,000.00" },
  netPay: "₱14,947.92",
};

// ── Hero Component ──────────────────────────────────────────────────────────
export default function Hero() {
  const [visible, setVisible] = useState(false);
  const elapsed = useLiveTimer();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        .hero { position: relative; overflow: hidden; background: var(--color-white); min-height: 100vh; display: flex; align-items: center; font-family: var(--font-base); }

        .hero-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
        .hero-bg-dots { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px); background-size: 26px 26px; mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%); }
        .hero-bg-blob-1 { position: absolute; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(233,82,14,0.08) 0%, transparent 70%); top: -220px; right: -60px; }
        .hero-bg-blob-2 { position: absolute; width: 480px; height: 480px; border-radius: 50%; background: radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%); bottom: -160px; left: -100px; }
        .hero-bg-wordmark { position: absolute; right: -20px; top: 50%; transform: translateY(-50%); font-family: 'Syne', sans-serif; font-size: 520px; font-weight: 800; line-height: 1; color: transparent; -webkit-text-stroke: 1.5px rgba(233,82,14,0.055); user-select: none; pointer-events: none; }

        .hero-container { position: relative; z-index: 1; width: 100%; max-width: 1200px; margin: 0 auto; padding: var(--space-20) var(--space-6); display: grid; grid-template-columns: 1fr 460px; gap: var(--space-16); align-items: center; }

        .hero-copy { display: flex; flex-direction: column; gap: var(--space-6); }

        .hero-eyebrow { display: inline-flex; align-items: center; gap: var(--space-2); background: var(--brand-orange-light); border: 1px solid var(--brand-orange-muted); color: var(--brand-orange-dark); font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; padding: 5px 13px; border-radius: var(--radius-full); width: fit-content; opacity: 0; transform: translateY(14px); transition: opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s; }
        .hero-eyebrow.visible { opacity: 1; transform: translateY(0); }
        .hero-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand-orange); animation: blink 2s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }

        .hero-headline { font-family: 'Syne', sans-serif; font-size: clamp(40px, 5.2vw, 68px); font-weight: 800; line-height: 1.06; letter-spacing: -0.03em; color: var(--color-text); opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s; }
        .hero-headline.visible { opacity: 1; transform: translateY(0); }
        .hero-headline .accent { background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        .hero-lead { font-size: var(--font-size-md); color: var(--color-text-muted); line-height: 1.7; max-width: 460px; opacity: 0; transform: translateY(14px); transition: opacity 0.6s ease 0.33s, transform 0.6s ease 0.33s; }
        .hero-lead.visible { opacity: 1; transform: translateY(0); }

        .hero-features { display: flex; flex-wrap: wrap; gap: var(--space-2); opacity: 0; transform: translateY(12px); transition: opacity 0.6s ease 0.44s, transform 0.6s ease 0.44s; }
        .hero-features.visible { opacity: 1; transform: translateY(0); }
        .hero-feature-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius-full); border: 1.5px solid; font-size: var(--font-size-sm); font-weight: 500; transition: transform 0.15s ease; }
        .hero-feature-pill:hover { transform: translateY(-1px); }

        .hero-actions { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; opacity: 0; transform: translateY(14px); transition: opacity 0.6s ease 0.56s, transform 0.6s ease 0.56s; }
        .hero-actions.visible { opacity: 1; transform: translateY(0); }
        .hero-btn-primary { display: inline-flex; align-items: center; gap: var(--space-2); font-family: var(--font-base); font-size: var(--font-size-base); font-weight: 600; padding: 13px 30px; border-radius: var(--radius-md); border: none; background: var(--gradient-orange); color: var(--color-white); box-shadow: var(--shadow-brand-orange); cursor: pointer; text-decoration: none; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .hero-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(233,82,14,0.38); }
        .hero-btn-ghost { display: inline-flex; align-items: center; gap: var(--space-2); font-family: var(--font-base); font-size: var(--font-size-base); font-weight: 500; padding: 13px 22px; border-radius: var(--radius-md); border: 1.5px solid var(--color-border-dark); background: transparent; color: var(--color-text-secondary); cursor: pointer; text-decoration: none; transition: border-color 0.15s, color 0.15s, background 0.15s; }
        .hero-btn-ghost:hover { border-color: var(--brand-blue); color: var(--brand-blue); background: var(--brand-blue-light); }

        /* Dashboard card */
        .hero-card-wrap { position: relative; opacity: 0; transform: translateX(28px); transition: opacity 0.7s ease 0.42s, transform 0.7s ease 0.42s; }
        .hero-card-wrap.visible { opacity: 1; transform: translateX(0); }
        .hero-card-glow { position: absolute; inset: -28px; border-radius: var(--radius-xl); background: radial-gradient(ellipse at 60% 40%, rgba(233,82,14,0.11) 0%, rgba(14,165,233,0.07) 55%, transparent 80%); filter: blur(20px); z-index: 0; }
        .hero-card { position: relative; z-index: 1; background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-5); box-shadow: var(--shadow-xl); display: flex; flex-direction: column; gap: var(--space-4); }

        .hc-header { display: flex; align-items: center; justify-content: space-between; }
        .hc-header-left { display: flex; align-items: center; gap: var(--space-3); }
        .hc-header-left h3 { font-family: 'Syne', sans-serif; font-size: var(--font-size-base); font-weight: 700; color: var(--color-text); }
        .hc-header-left p { font-size: var(--font-size-xs); color: var(--color-text-faint); margin-top: 1px; }
        .hc-timer-badge { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 6px 12px; text-align: right; }
        .hc-timer-value { font-family: 'Syne', sans-serif; font-size: var(--font-size-xl); font-weight: 800; line-height: 1; letter-spacing: -0.03em; background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hc-timer-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-faint); margin-top: 2px; }

        .hc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
        .hc-stat { background: var(--color-bg); border-radius: var(--radius-md); padding: var(--space-3); text-align: center; }
        .hc-stat-val { font-family: 'Syne', sans-serif; font-size: var(--font-size-lg); font-weight: 800; color: var(--color-text); line-height: 1; }
        .hc-stat-lbl { font-size: 10px; color: var(--color-text-faint); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.04em; }

        .hc-divider { height: 1px; background: var(--color-border); }

        .hc-feed-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-faint); margin-bottom: 2px; }
        .hc-feed { display: flex; flex-direction: column; gap: var(--space-2); }
        .hc-feed-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-white); }
        .hc-feed-left { display: flex; align-items: center; gap: 8px; }
        .hc-feed-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--gradient-brand); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: white; flex-shrink: 0; }
        .hc-feed-name { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); }
        .hc-feed-action { font-size: var(--font-size-xs); color: var(--color-text-muted); }
        .hc-feed-right { display: flex; align-items: center; gap: 6px; }
        .hc-feed-time { font-size: var(--font-size-xs); color: var(--color-text-faint); }
        .hc-feed-dot { width: 7px; height: 7px; border-radius: 50%; }
        .dot-in    { background: var(--color-success); box-shadow: 0 0 0 2px rgba(22,163,74,0.18); }
        .dot-break { background: var(--color-warning); box-shadow: 0 0 0 2px rgba(217,119,6,0.18); }
        .dot-out   { background: var(--color-text-faint); }

        .hc-footer { display: flex; align-items: center; justify-content: space-between; }
        .hc-live { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted); }
        .hc-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 0 2px rgba(22,163,74,0.2); animation: blink 2s ease-in-out infinite; }

        .hero-float { position: absolute; top: -14px; right: var(--space-5); background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 5px 12px 5px 8px; display: flex; align-items: center; gap: 6px; box-shadow: var(--shadow-md); font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); white-space: nowrap; z-index: 2; animation: floaty 3s ease-in-out infinite; }
        @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .hero-float-icon { width: 22px; height: 22px; border-radius: 50%; background: var(--gradient-orange); display: flex; align-items: center; justify-content: center; font-size: 12px; }

        .hc-payslip { background: var(--color-bg); border-radius: var(--radius-lg); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
        .hc-payslip-header { display: flex; align-items: flex-start; justify-content: space-between; }
        .hc-payslip-title { font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text); text-transform: uppercase; letter-spacing: .06em; }
        .hc-payslip-period { font-size: 10px; color: var(--color-text-faint); margin-top: 1px; font-family: monospace; }
        .hc-payslip-hours { font-family: 'Syne', sans-serif; font-size: var(--font-size-base); font-weight: 800; color: var(--brand-orange); }
        .hc-payslip-rate { font-size: 10px; color: var(--color-text-muted); background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 3px 8px; display: inline-block; font-family: monospace; width: fit-content; }
        .hc-payslip-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
        .hc-payslip-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-text-muted); }
        .hc-payslip-deduct-label { font-size: 10px; color: var(--color-text-faint); }
        .hc-payslip-bonus-label { font-size: 10px; color: #15803d; font-weight: 600; }
        .hc-payslip-val { font-family: monospace; font-size: 11px; font-weight: 700; color: var(--color-text); }
        .hc-payslip-val.deduct { color: #dc2626; }
        .hc-payslip-val.bonus { color: #15803d; }
        .hc-payslip-net { display: flex; justify-content: space-between; align-items: center; background: var(--color-text); border-radius: var(--radius-md); padding: 8px 10px; font-size: var(--font-size-sm); font-weight: 700; color: white; margin-top: 4px; }

        @media (max-width: 1024px) { .hero-container { grid-template-columns: 1fr; gap: var(--space-12); padding: var(--space-16) var(--space-6); } .hero-card-wrap { max-width: 500px; margin: 0 auto; width: 100%; } .hero-bg-wordmark { display: none; } }
        @media (max-width: 640px) { .hero-actions { flex-direction: column; align-items: flex-start; } }
      `}</style>

      <section className="hero" id="home">
        <div className="hero-bg">
          <div className="hero-bg-dots" />
          <div className="hero-bg-blob-1" />
          <div className="hero-bg-blob-2" />
          <div className="hero-bg-wordmark">T8</div>
        </div>

        <div className="hero-container">

          {/* ── LEFT: Copy ── */}
          <div className="hero-copy">

            <div className={`hero-eyebrow${visible ? " visible" : ""}`}>
              <span className="hero-eyebrow-dot" />
              Now in open beta · Free to start
            </div>

            <h1 className={`hero-headline${visible ? " visible" : ""}`}>
              Every clock-in.<br />
              Every break.<br />
              <span className="accent">Accounted for.</span>
            </h1>

            <p className={`hero-lead${visible ? " visible" : ""}`}>
              Time8out is the employee time management platform for small businesses —
              shift logging, break tracking, deduction computation, and payslip
              generation, all in real time.
            </p>

            <div className={`hero-features${visible ? " visible" : ""}`}>
              {FEATURES.map(f => (
                <span key={f.label} className="hero-feature-pill"
                  style={{ color: f.color, background: f.bg, borderColor: f.border }}>
                  {f.icon} {f.label}
                </span>
              ))}
            </div>

            <div className={`hero-actions${visible ? " visible" : ""}`}>
              <a href="/register" className="hero-btn-primary">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Start tracking free
              </a>
              <a href="#how-it-works" className="hero-btn-ghost">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                See how it works
              </a>
            </div>

          </div>

          {/* ── RIGHT: Dashboard Card ── */}
          <div className={`hero-card-wrap${visible ? " visible" : ""}`}>
            <div className="hero-card-glow" />

            <div className="hero-float">
              <span className="hero-float-icon">🟢</span>
              8 employees on shift now
            </div>

            <div className="hero-card">

              <div className="hc-header">
                <div className="hc-header-left">
                  <AnimatedClock />
                  <div>
                    <h3>Shift Dashboard</h3>
                    <p>{dateStr}</p>
                  </div>
                </div>
                <div className="hc-timer-badge">
                  <div className="hc-timer-value">{elapsed}</div>
                  <div className="hc-timer-label">your session</div>
                </div>
              </div>

              <div className="hc-stats">
                {[
                  { val: "8",    lbl: "Clocked in" },
                  { val: "2",    lbl: "On break" },
                  { val: "30m",  lbl: "Avg deduction" },
                ].map(s => (
                  <div className="hc-stat" key={s.lbl}>
                    <div className="hc-stat-val">{s.val}</div>
                    <div className="hc-stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              <div className="hc-divider" />

              <div className="hc-feed">
                <div className="hc-feed-label">Recent activity</div>
                {LOG_ENTRIES.map(entry => (
                  <div className="hc-feed-row" key={entry.name + entry.time}>
                    <div className="hc-feed-left">
                      <div className="hc-feed-avatar">
                        {entry.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <div className="hc-feed-name">{entry.name}</div>
                        <div className="hc-feed-action">{entry.action}</div>
                      </div>
                    </div>
                    <div className="hc-feed-right">
                      <span className="hc-feed-time">{entry.time}</span>
                      <span className={`hc-feed-dot ${entry.status === "in" ? "dot-in" : entry.status === "break" ? "dot-break" : "dot-out"}`} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="hc-divider" />

              {/* Payslip preview */}
              <div className="hc-payslip">
                <div className="hc-payslip-header">
                  <div>
                    <div className="hc-payslip-title">Payslip Preview</div>
                    <div className="hc-payslip-period">{PAYSLIP_PREVIEW.period} · {PAYSLIP_PREVIEW.schedule}</div>
                  </div>
                  <div className="hc-payslip-hours">{PAYSLIP_PREVIEW.hours}</div>
                </div>
                <div className="hc-payslip-rate">{PAYSLIP_PREVIEW.rate}</div>
                <div className="hc-payslip-rows">
                  <div className="hc-payslip-row">
                    <span>Basic Pay</span>
                    <span className="hc-payslip-val">{PAYSLIP_PREVIEW.grossPay}</span>
                  </div>
                  {PAYSLIP_PREVIEW.deductions.map(d => (
                    <div key={d.label} className="hc-payslip-row">
                      <span className="hc-payslip-deduct-label">{d.label}</span>
                      <span className="hc-payslip-val deduct">{d.amount}</span>
                    </div>
                  ))}
                  <div className="hc-payslip-row">
                    <span className="hc-payslip-bonus-label">{PAYSLIP_PREVIEW.bonus.label}</span>
                    <span className="hc-payslip-val bonus">{PAYSLIP_PREVIEW.bonus.amount}</span>
                  </div>
                </div>
                <div className="hc-payslip-net">
                  <span>Net Pay</span>
                  <span>{PAYSLIP_PREVIEW.netPay}</span>
                </div>
              </div>

              <div className="hc-footer">
                <span className="hc-live">Syncing in real-time</span>
                <span style={{ fontSize: "11px", fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "var(--color-text-faint)" }}>
                  Time8out
                </span>
              </div>

            </div>
          </div>
        </div>
      </section>
    </>
  );
}