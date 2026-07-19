// Faq.tsx — Time8out

import { useState } from "react";

type FaqItem = { q: string; a: string; };

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "How do employees clock in and out?",
    a: "Employees clock in and out with a single tap from any device — desktop, tablet, or phone. Via app download or web URL through 3 different methods: QR scanner, Barcode Scanner, or Proximity Reader (commonly seen in BPO industries). Just open the Time8out Time Logger link on your PC and attach the scanner devices, or open the app on your mobile phone or tablet and scan your employee ID that contains the QR code, Barcode, or Proximity Card. The timestamp is recorded instantly.",
  },
  {
    q: "Can employees track their breaks and lunch?",
    a: "Yes. Time8out supports break logging separate from your main shift. Employees can start a break (short break or lunch) and end it independently, so actual working hours are calculated accurately — breaks are excluded from billable time automatically.",
  },
  {
    q: "How does overtime detection work?",
    a: "You set the daily or weekly hour threshold in your manager settings (e.g. 8 hours/day or 48 hours/week). Once an employee crosses that threshold, their records are automatically flagged as overtime. Managers see this highlighted in the dashboard in real time — no manual calculation needed.",
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
    a: "Managers receive a notification (and a dashboard flag) when a shift runs unusually long — typically beyond the expected shift end time. The system can also auto time-out the employee after a configurable window. Managers can manually close a shift on behalf of an employee, log the correct out-time, and add an optional note explaining the correction.",
  },
  {
    q: "How are deductions and bonuses computed?",
    a: "Time8out includes a flexible formula builder where admins can create custom deduction and bonus rules using variables like {Salary}, {TotalHours}, and {DeductionMinutes}. Formulas support conditions (e.g. 'if {TotalHours} > 130 then 1500') and are evaluated automatically when generating a payslip for a pay period.",
  },
  {
    q: "What pay structures are supported?",
    a: "Time8out supports Hourly, Daily, and Monthly pay structures. Each employee can be assigned their own rate and currency ($ or ₱). Gross pay is computed automatically based on hours worked or days present for the selected period, then deductions and bonuses are applied on top.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit (HTTPS) and at rest. Time8out does not sell or share your attendance data with third parties. Each business account is isolated — your employees' records are only visible to authorized managers in your organization.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        .faq { background: var(--color-bg); font-family: var(--font-base); overflow: hidden; padding: var(--space-20) var(--space-6); position: relative; }
        .faq::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--gradient-brand); }
        .faq-inner { max-width: 900px; margin: 0 auto; }

        .faq-header { text-align: center; margin-bottom: var(--space-12); }
        .faq-kicker { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-orange); margin-bottom: var(--space-3); }
        .faq-title { font-family: 'Syne', sans-serif; font-size: clamp(28px, 3.5vw, 44px); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--color-text); margin-bottom: var(--space-4); }
        .faq-title span { background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .faq-subtitle { font-size: var(--font-size-md); color: var(--color-text-muted); line-height: 1.7; max-width: 520px; margin: 0 auto; }

        .faq-count { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-faint); letter-spacing: 0.06em; text-transform: uppercase; background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-full); padding: 5px 14px; margin-bottom: var(--space-8); }

        .faq-accordion { display: flex; flex-direction: column; gap: var(--space-3); }
        .faq-item { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; transition: box-shadow 0.2s, border-color 0.2s; }
        .faq-item:hover { box-shadow: var(--shadow-md); }
        .faq-item.is-open { border-color: var(--brand-orange-muted); box-shadow: var(--shadow-lg); }

        .faq-question { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-5) var(--space-6); font-family: var(--font-base); font-size: var(--font-size-base); font-weight: 600; color: var(--color-text); background: transparent; border: none; cursor: pointer; text-align: left; line-height: 1.5; transition: background 0.15s; }
        .faq-question:hover { background: var(--color-bg); }

        .faq-chevron { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid var(--color-border-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 13px; color: var(--color-text-muted); transition: transform 0.25s ease, background 0.2s, border-color 0.2s, color 0.2s; }
        .faq-item.is-open .faq-chevron { transform: rotate(180deg); background: var(--brand-orange-light); border-color: var(--brand-orange-muted); color: var(--brand-orange); }

        .faq-answer-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.28s ease; }
        .faq-item.is-open .faq-answer-wrap { grid-template-rows: 1fr; }
        .faq-answer-inner { overflow: hidden; }
        .faq-answer { padding: 0 var(--space-6) var(--space-5); font-size: var(--font-size-base); color: var(--color-text-muted); line-height: 1.75; border-top: 1px solid var(--color-border); padding-top: var(--space-4); }

        @media (max-width: 600px) {
          .faq-question { padding: var(--space-4) var(--space-5); font-size: var(--font-size-sm); }
          .faq-answer { padding: 0 var(--space-5) var(--space-4); padding-top: var(--space-4); font-size: var(--font-size-sm); }
        }
      `}</style>

      <section className="faq" id="faq">
        <div className="faq-inner">

          <div className="faq-header">
            <span className="faq-kicker">❓ Frequently asked questions</span>
            <h2 className="faq-title">
              Everything you need to know<br />
              about <span>Time8out.</span>
            </h2>
            <p className="faq-subtitle">
              Common questions about employee time tracking, attendance management,
              and payroll computation with Time8out.
            </p>
          </div>

          <div style={{ textAlign: "center" }}>
            <span className="faq-count">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {FAQ_ITEMS.length} questions answered
            </span>
          </div>

          <div className="faq-accordion">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={i} className={`faq-item${isOpen ? " is-open" : ""}`}>
                  <button className="faq-question" onClick={() => toggle(i)} aria-expanded={isOpen}>
                    <span>{item.q}</span>
                    <span className="faq-chevron">▾</span>
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
      </section>
    </>
  );
}