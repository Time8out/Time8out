// Faq.tsx — Time8out
// Accordion FAQ: Employee (live), Gym & ESL (coming soon)
// Matches brand.css design system (brand-orange, brand-blue, DM Sans + Syne)

import { useState } from "react";

type FaqItem = {
  q: string;
  a: string;
};

type FaqSection = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeColor: string;
  badgeLabel: string;
  soon: boolean;
  items: FaqItem[];
};

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "employee",
    icon: "🏢",
    title: "Employee Time Tracking",
    subtitle: "Everything you need to know about clocking in, managing shifts, and running payroll-ready reports.",
    color: "var(--brand-orange)",
    bg: "var(--brand-orange-light)",
    border: "var(--brand-orange-muted)",
    badgeBg: "rgba(233,82,14,0.15)",
    badgeColor: "var(--brand-orange-dark)",
    badgeLabel: "Live now",
    soon: false,
    items: [
      {
        q: "How do employees clock in and out?",
        a: "Employees clock in and out with a single tap from any device desktop, tablet, or phone. Via app download or web URL through 3 different methods. QR scanner, Barcode Scanner or Proximity Reader (commonly seen on BPO industries). Just open the Time8out Time logger link on your pc and attach the scanner devices or open the app on your mobile phone or tablet and scan your employee ID that contains the QR code, Barcode or the Proximity Card, The timestamp is recorded instantly.",
      },
      {
        q: "Can employees track their breaks and lunch?",
        a: "Yes. Time8out supports break logging separate from your main shift. Employees can start a break (short break or lunch) and end it independently, so your actual working hours are calculated accurately — breaks are excluded from billable time automatically.",
      },
      {
        q: "How does overtime detection work?",
        a: "You set the daily or weekly hour threshold in your manager settings (e.g. 8 hours/day or 48 hours/week). Once an employee crosses that threshold, their records are automatically flagged as overtime. Managers see this highlighted in the dashboard in real time which is subject for manager's Approval no manual calculation needed.",
      },
      {
        q: "Can managers see who's clocked in right now?",
        a: "Yes. The manager dashboard shows a live view of all currently active employees — who's clocked in, how long they've been working, and whether they're on break. It refreshes automatically so you always have an accurate picture without refreshing the page.",
      },
      {
        q: "Is there an audit trail or history I can review?",
        a: "Every clock-in and clock-out is logged with a precise timestamp and stored permanently. Managers can filter records by employee, date range, or shift type. You can review, correct (with a note), and export attendance history at any time — making payroll reconciliation straightforward.",
      },
      {
        q: "How do I export attendance data for payroll?",
        a: "From the manager dashboard, go to Reports → Export. You can export to CSV (compatible with Excel and Google Sheets) or generate a PDF summary per employee for a selected pay period. The export includes total hours worked, overtime hours, and break time deducted.",
      },
      {
        q: "How many employees can I add?",
        a: "Time8out has plans for every business size — Free (up to 20 employees), Silver (21–100, ₱200/month), Platinum (101–500, ₱1,500/month), Gold (501–1,000, ₱2,500/month), and VIP (unlimited, ₱4,000/month). Not sure which fits? Start on Free and upgrade anytime as your team grows.",
      },
      {
        q: "What if an employee forgets to clock out?",
        a: "Managers receive a notification (and a dashboard flag) when a shift runs unusually long — typically beyond the expected shift end time. Managers can manually close a shift on behalf of an employee, log the correct out-time, and add an optional note explaining the correction.",
      },
      {
        q: "Is my data secure?",
        a: "All data is encrypted in transit (HTTPS) and at rest. Time8out does not sell or share your attendance data with third parties. Each business account is isolated — your employees' records are only visible to authorized managers in your organization.",
      },
    ],
  },
  {
    id: "gym",
    icon: "🏋️",
    title: "Gym & Fitness Management",
    subtitle: "Member check-ins, subscription tracking, and session limits — built for gyms and fitness studios.",
    color: "var(--brand-blue)",
    bg: "var(--brand-blue-light)",
    border: "var(--brand-blue-muted)",
    badgeBg: "rgba(14,165,233,0.12)",
    badgeColor: "var(--brand-blue-dark)",
    badgeLabel: "Coming soon",
    soon: true,
    items: [
      {
        q: "How will member check-in tracking work?",
        a: "Members will be able to check in via a QR code, Barcode, or Proximity Card at the front desk. Each check-in is timestamped and linked to the member's profile, allowing staff to see real-time attendance and session history. This replaces manual logbooks and provides accurate data for membership management.",
      },
      {
        q: "Will the system handle membership renewals and alerts?",
        a: "Yes. Time8out will automatically track each member's subscription end date and send renewal alerts to both the member (via SMS or email) and gym staff before the membership expires — reducing lapses and keeping your revenue predictable.",
      },
      {
        q: "Will I be able to see full attendance history per member?",
        a: "Yes. Each member profile will include a full attendance history — visit dates, times, session durations, and any notes added by staff. This is useful for identifying inactive members and for resolving billing disputes.",
      },
    ],
  },
  {
    id: "esl",
    icon: "📚",
    title: "ESL & Class Scheduling",
    subtitle: "Teacher and student scheduling, class session timers, and attendance tracking for ESL schools and tutoring centers.",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    badgeBg: "rgba(124,58,237,0.10)",
    badgeColor: "#6d28d9",
    badgeLabel: "Coming soon",
    soon: true,
    items: [
      {
        q: "How will teacher and student scheduling work?",
        a: "ESL coordinators will be able to create class schedules — assigning teachers, students, from a visual calendar interface. Conflicts are flagged automatically and both teachers and students can view their own upcoming class schedules.",
      },
    ],
  },
];

export default function Faq() {
  const [activeSection, setActiveSection] = useState<string>("employee");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const current = FAQ_SECTIONS.find((s) => s.id === activeSection)!;

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  const handleSection = (id: string) => {
    setActiveSection(id);
    setOpenIndex(0);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        /* ── Section shell ── */
        .faq {
          background: var(--color-bg);
          font-family: var(--font-base);
          overflow: hidden;
          padding: var(--space-20) var(--space-6);
          position: relative;
        }

        /* Subtle top accent line */
        .faq::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: var(--gradient-brand);
        }

        .faq-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ── Header ── */
        .faq-header {
          text-align: center;
          margin-bottom: var(--space-12);
        }
        .faq-kicker {
          display: inline-block;
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--brand-orange);
          margin-bottom: var(--space-3);
        }
        .faq-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(28px, 3.5vw, 44px);
          font-weight: 800; letter-spacing: -0.025em; line-height: 1.15;
          color: var(--color-text);
          margin-bottom: var(--space-4);
        }
        .faq-title span {
          background: var(--gradient-brand);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .faq-subtitle {
          font-size: var(--font-size-md);
          color: var(--color-text-muted);
          line-height: 1.7;
          max-width: 520px;
          margin: 0 auto;
        }

        /* ── Tab switcher ── */
        .faq-tabs {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-10);
          flex-wrap: wrap;
          justify-content: center;
        }
        .faq-tab {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 10px 20px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-sm);
          font-weight: 600;
          font-family: var(--font-base);
          cursor: pointer;
          border: 1.5px solid var(--color-border-dark);
          background: var(--color-white);
          color: var(--color-text-muted);
          transition: all 0.2s ease;
          position: relative;
        }
        .faq-tab:hover {
          border-color: var(--brand-orange);
          color: var(--color-text);
        }
        .faq-tab.active-employee {
          background: var(--brand-orange-light);
          border-color: var(--brand-orange);
          color: var(--brand-orange-dark);
        }
        .faq-tab.active-gym {
          background: var(--brand-blue-light);
          border-color: var(--brand-blue);
          color: var(--brand-blue-dark);
        }
        .faq-tab.active-esl {
          background: #f5f3ff;
          border-color: #c4b5fd;
          color: #6d28d9;
        }
        .faq-tab-soon {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: var(--radius-full);
          background: var(--color-bg-alt);
          color: var(--color-text-faint);
          margin-left: 2px;
        }

        /* ── Content body: sidebar + accordion ── */
        .faq-body {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: var(--space-8);
          align-items: start;
        }

        /* Section info card (left) */
        .faq-section-card {
          border-radius: var(--radius-xl);
          border: 1.5px solid;
          padding: var(--space-8) var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          position: sticky;
          top: var(--space-8);
        }
        .faq-section-badge {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          width: fit-content;
        }
        .faq-section-icon { font-size: 36px; }
        .faq-section-name {
          font-family: 'Syne', sans-serif;
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text);
          line-height: 1.2;
        }
        .faq-section-desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
          line-height: 1.65;
        }
        .faq-section-count {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-faint);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border);
        }

        /* Coming soon overlay on card */
        .faq-soon-banner {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          background: var(--color-bg-alt);
          border: 1px dashed var(--color-border-dark);
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-muted);
          letter-spacing: 0.03em;
        }

        /* ── Accordion ── */
        .faq-accordion {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .faq-item {
          background: var(--color-white);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .faq-item:hover {
          box-shadow: var(--shadow-md);
        }
        .faq-item.is-open {
          border-color: transparent;
          box-shadow: var(--shadow-lg);
        }

        .faq-question {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-5) var(--space-6);
          font-family: var(--font-base);
          font-size: var(--font-size-base);
          font-weight: 600;
          color: var(--color-text);
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          line-height: 1.5;
          transition: background 0.15s;
        }
        .faq-question:hover { background: var(--color-bg); }

        .faq-chevron {
          width: 28px; height: 28px;
          border-radius: 50%;
          border: 1.5px solid var(--color-border-dark);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 13px;
          color: var(--color-text-muted);
          transition: transform 0.25s ease, background 0.2s, border-color 0.2s, color 0.2s;
        }
        .faq-item.is-open .faq-chevron {
          transform: rotate(180deg);
        }

        /* Animated answer */
        .faq-answer-wrap {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.28s ease;
        }
        .faq-item.is-open .faq-answer-wrap {
          grid-template-rows: 1fr;
        }
        .faq-answer-inner { overflow: hidden; }
        .faq-answer {
          padding: 0 var(--space-6) var(--space-5);
          font-size: var(--font-size-base);
          color: var(--color-text-muted);
          line-height: 1.75;
          border-top: 1px solid var(--color-border);
          margin-top: 0;
          padding-top: var(--space-4);
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .faq-body {
            grid-template-columns: 1fr;
          }
          .faq-section-card {
            position: static;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: flex-start;
            gap: var(--space-4);
            padding: var(--space-6);
          }
          .faq-section-icon { display: none; }
          .faq-section-count { width: 100%; border-top: 1px solid var(--color-border); }
        }
        @media (max-width: 600px) {
          .faq-tabs { gap: var(--space-2); }
          .faq-tab { padding: 8px 14px; font-size: var(--font-size-xs); }
          .faq-section-card { flex-direction: column; }
          .faq-question { padding: var(--space-4) var(--space-5); font-size: var(--font-size-sm); }
          .faq-answer { padding: 0 var(--space-5) var(--space-4); padding-top: var(--space-4); font-size: var(--font-size-sm); }
        }
      `}</style>

      <section className="faq" id="faq">
        <div className="faq-inner">

          {/* ── Header ── */}
          <div className="faq-header">
            <span className="faq-kicker">❓ Frequently asked questions</span>
            <h2 className="faq-title">
              Everything you need to know<br />
              about <span>Time8out.</span>
            </h2>
            <p className="faq-subtitle">
              Browse by module below. The employee tracker is live — gym and ESL
              features are actively being built.
            </p>
          </div>

          {/* ── Tab switcher ── */}
          <div className="faq-tabs" role="tablist">
            {FAQ_SECTIONS.map((s) => {
              const isActive = activeSection === s.id;
              const activeClass = isActive ? `active-${s.id}` : "";
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`faq-tab ${activeClass}`}
                  onClick={() => handleSection(s.id)}
                >
                  <span>{s.icon}</span>
                  <span>{s.title.split(" ")[0]} {s.title.split(" ")[1]}</span>
                  {s.soon && (
                    <span className="faq-tab-soon">Soon</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Body ── */}
          <div className="faq-body">

            {/* Left: section info card */}
            <div
              className="faq-section-card"
              style={{ background: current.bg, borderColor: current.border }}
            >
              <span
                className="faq-section-badge"
                style={{ background: current.badgeBg, color: current.badgeColor }}
              >
                {current.badgeLabel}
              </span>
              <div className="faq-section-icon">{current.icon}</div>
              <div className="faq-section-name">{current.title}</div>
              <p className="faq-section-desc">{current.subtitle}</p>
              {current.soon && (
                <div className="faq-soon-banner">
                  🚧 &nbsp;These answers reflect planned features — not yet released.
                </div>
              )}
              <div className="faq-section-count">
                {current.items.length} question{current.items.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Right: accordion */}
            <div
              className="faq-accordion"
              role="tabpanel"
              key={current.id}
            >
              {current.items.map((item, i) => {
                const isOpen = openIndex === i;
                return (
                  <div
                    key={i}
                    className={`faq-item${isOpen ? " is-open" : ""}`}
                    style={isOpen ? { borderColor: current.border } : {}}
                  >
                    <button
                      className="faq-question"
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.q}</span>
                      <span
                        className="faq-chevron"
                        style={isOpen ? {
                          background: current.bg,
                          borderColor: current.border,
                          color: current.color,
                        } : {}}
                      >
                        ▾
                      </span>
                    </button>
                    <div className="faq-answer-wrap">
                      <div className="faq-answer-inner">
                        <div className="faq-answer">{item.a}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>
    </>
  );
}