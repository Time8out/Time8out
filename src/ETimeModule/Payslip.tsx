import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

interface DeductionEntry { Name: string; Formula: string; }
interface BonusEntry { Name: string; Formula: string; }
interface PayStructureEntry { Structure: string; Formula: string; }

interface Props {
  employeeID: string;
  companyCode: string;
  dateFrom: string;
  dateTo: string;
  totalWorkingHours: number;
  totalDeductionMinutes: number;
  onClose: () => void;
}

interface EarningsBreakdown {
  regular: number;
  holiday: number;
  overtime: number;
  nightDiff: number;
  expectedRegular: number;
  expectedHoliday: number;
  expectedOvertime: number;
  expectedNightDiff: number;
}

interface StampFeedbackEntry {
  type: string;
  actualTime?: string;
  scheduledTime?: string;
  deductionMinutes: number;
  deductionAmount?: number;
}

interface FeedbackItem extends StampFeedbackEntry {
  date: string;
}

const FEEDBACK_LABELS: Record<string, string> = {
  late: "Late Arrival",
  system_auto_logout: "Auto Logout",
  system_auto_breakout: "Auto Break-out",
  missed: "Missed Shift",
};

const FEEDBACK_ACCENT: Record<string, string> = {
  late: "#F59E0B",
  system_auto_logout: "#DC2626",
  system_auto_breakout: "#EA580C",
  missed: "#991B1B",
};

function feedbackLabel(type: string): string {
  return FEEDBACK_LABELS[type] ?? type;
}

function feedbackAccent(type: string): string {
  return FEEDBACK_ACCENT[type] ?? "#DC2626";
}

function evaluateFormula(formula: string, salary: number, totalHours: number, deductionMinutes: number): number {
  try {
    let substituted = formula
      .replace(/\{Salary\}/gi, salary.toString())
      .replace(/\{TotalHours\}/gi, totalHours.toString())
      .replace(/\{DeductionMinutes\}/gi, deductionMinutes.toString());

    // Convert natural-language logical connectors to JS operators BEFORE
    // sanitizing — otherwise the character-whitelist below silently deletes
    // the letters in "and"/"or" rather than converting them, turning
    // "Salary > 20000 and Salary < 30000" into two comparisons mashed
    // together with no operator, which throws and gets swallowed as 0.
    substituted = substituted
      .replace(/\band\b/gi, "&&")
      .replace(/\bor\b/gi, "||");

    const looksLikeIfFormula = /^\s*if\b/i.test(substituted);
    const ifMatch = substituted.match(/^\s*if\s+(.+?)\s+then\s+(.+)$/i);

    if (ifMatch) {
      const condition = ifMatch[1].replace(/[^0-9+\-*/.()<>=&|! ]/g, "");
      const expr = ifMatch[2].replace(/[^0-9+\-*/.() ]/g, "");
      if (!condition.trim() || !expr.trim()) return 0;
      // eslint-disable-next-line no-new-func
      const conditionResult = new Function(`return (${condition})`)();
      if (!conditionResult) return 0;
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expr})`)();
      return typeof result === "number" && isFinite(result) ? Math.abs(result) : 0;
    }

    // A formula that starts with "if" but didn't match the if/then shape
    // (e.g. missing the "then <amount>" part) is malformed — return 0
    // rather than falling through to evaluating its leftover fragments
    // as plain arithmetic, which could silently produce a wrong number.
    if (looksLikeIfFormula) return 0;

    const sanitized = substituted.replace(/[^0-9+\-*/.() ]/g, "");
    if (!sanitized.trim()) return 0;
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${sanitized})`)();
    return typeof result === "number" && isFinite(result) ? Math.abs(result) : 0;
  } catch {
    return 0;
  }
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Payslip({
  employeeID,
  companyCode,
  dateFrom,
  dateTo,
  totalWorkingHours,
  totalDeductionMinutes,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeName, setEmployeeName] = useState("");
  const [payStructure, setPayStructure] = useState<PayStructureEntry | null>(null);
  const [currency, setCurrency] = useState("$");
  const [deductions, setDeductions] = useState<DeductionEntry[]>([]);
  const [bonuses, setBonuses] = useState<BonusEntry[]>([]);
  const [earnings, setEarnings] = useState<EarningsBreakdown>({
    regular: 0, holiday: 0, overtime: 0, nightDiff: 0,
    expectedRegular: 0, expectedHoliday: 0, expectedOvertime: 0, expectedNightDiff: 0,
  });
  const [daysComputed, setDaysComputed] = useState(0);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("FirstName, LastName, PayStructure, Currency, Deductions, BonusAndIncentives")
        .eq("EmployeeID", employeeID)
        .eq("CompanyCode", companyCode)
        .single();

      if (userErr || !userData) {
        setError("Could not load employee data.");
        setLoading(false);
        return;
      }

      setEmployeeName(`${userData.FirstName} ${userData.LastName}`);
      setPayStructure(userData.PayStructure?.[0] ?? null);
      setCurrency(userData.Currency ?? "$");
      setDeductions(userData.Deductions ?? []);
      setBonuses(userData.BonusAndIncentives ?? []);

      const { data: attendanceRows, error: attErr } = await supabase
        .from("Attendance")
        .select("AttendanceDate, Regular, Holiday, Overtime, NightShiftDifferential, ExpectedRegular, ExpectedHoliday, ExpectedOvertime, ExpectedNightShiftDifferential, StampsFeedback")
        .eq("EmployeeID", employeeID)
        .eq("CompanyCode", companyCode)
        .gte("AttendanceDate", dateFrom)
        .lte("AttendanceDate", dateTo)
        .order("AttendanceDate", { ascending: true });

      if (attErr) {
        setError("Could not load attendance/pay data.");
        setLoading(false);
        return;
      }

      const rows = attendanceRows ?? [];
      const summed = rows.reduce(
        (acc, r) => ({
          regular: acc.regular + (r.Regular ?? 0),
          holiday: acc.holiday + (r.Holiday ?? 0),
          overtime: acc.overtime + (r.Overtime ?? 0),
          nightDiff: acc.nightDiff + (r.NightShiftDifferential ?? 0),
          expectedRegular: acc.expectedRegular + (r.ExpectedRegular ?? 0),
          expectedHoliday: acc.expectedHoliday + (r.ExpectedHoliday ?? 0),
          expectedOvertime: acc.expectedOvertime + (r.ExpectedOvertime ?? 0),
          expectedNightDiff: acc.expectedNightDiff + (r.ExpectedNightShiftDifferential ?? 0),
        }),
        { regular: 0, holiday: 0, overtime: 0, nightDiff: 0, expectedRegular: 0, expectedHoliday: 0, expectedOvertime: 0, expectedNightDiff: 0 },
      );

      const allFeedback: FeedbackItem[] = [];
      for (const row of rows) {
        const raw = row.StampsFeedback;
        const parsed: StampFeedbackEntry[] = typeof raw === "string"
          ? (raw ? JSON.parse(raw) : [])
          : (raw ?? []);
        for (const entry of parsed) {
          allFeedback.push({ ...entry, date: row.AttendanceDate });
        }
      }

      setEarnings(summed);
      setDaysComputed(rows.length);
      setFeedbackItems(allFeedback);
      setLoading(false);
    }
    load();
  }, [employeeID, companyCode, dateFrom, dateTo]);

  const grossPay = earnings.regular + earnings.holiday + earnings.overtime + earnings.nightDiff;
  const expectedGrossPay = earnings.expectedRegular + earnings.expectedHoliday + earnings.expectedOvertime + earnings.expectedNightDiff;
  const retainedPct = expectedGrossPay > 0 ? Math.min(100, (grossPay / expectedGrossPay) * 100) : 100;
  const lostToDeductions = Math.max(0, expectedGrossPay - grossPay);

  const deductionItems = deductions.map(d => ({
    name: d.Name,
    formula: d.Formula,
    amount: evaluateFormula(d.Formula, grossPay, totalWorkingHours, totalDeductionMinutes),
  }));

  const bonusItems = bonuses.map(b => ({
    name: b.Name,
    formula: b.Formula,
    amount: evaluateFormula(b.Formula, grossPay, totalWorkingHours, totalDeductionMinutes),
  }));

  const totalDeductions = deductionItems.reduce((sum, d) => sum + d.amount, 0);
  const totalBonuses = bonusItems.reduce((sum, b) => sum + b.amount, 0);
  const netPay = grossPay - totalDeductions + totalBonuses;

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const fmtDateLong = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <style>{`
        :root {
          --ps-font-display: 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --ps-font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --ps-font-mono: 'IBM Plex Mono', 'SFMono-Regular', Menlo, Consolas, monospace;
          --ps-accent-from: #F97316;
          --ps-accent-to: #3B82F6;
          --ps-ink: #14181F;
          --ps-muted: #6B7280;
          --ps-faint: #9CA3AF;
          --ps-border: #E7E9EE;
          --ps-surface: #FFFFFF;
          --ps-bg-alt: #F7F8FA;
          --ps-green: #16A34A;
          --ps-green-bg: #F0FDF4;
          --ps-red: #DC2626;
          --ps-red-bg: #FEF2F2;
        }

        .ps2-overlay {
          position: fixed; inset: 0; background: rgba(15, 18, 25, 0.5);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 400; animation: ps2Fade .15s ease;
          font-family: var(--ps-font-body);
        }
        @media (min-width: 860px) {
          .ps2-overlay { align-items: center; padding: 24px; }
        }
        @keyframes ps2Fade { from { opacity: 0 } to { opacity: 1 } }

        .ps2-sheet {
          background: var(--ps-surface);
          width: 100%; max-width: 100%;
          height: 92vh; max-height: 92vh;
          border-radius: 20px 20px 0 0;
          box-shadow: 0 -8px 40px rgba(0,0,0,0.18);
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: ps2SlideUp .22s cubic-bezier(.22,1,.36,1);
        }
        @media (min-width: 860px) {
          .ps2-sheet {
            width: 920px; height: auto; max-height: 88vh;
            border-radius: 18px;
            animation: ps2Pop .18s cubic-bezier(.22,1,.36,1);
          }
        }
        @keyframes ps2SlideUp { from { opacity: 0; transform: translateY(28px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes ps2Pop { from { opacity: 0; transform: translateY(12px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }

        .ps2-band { height: 3px; flex-shrink: 0; background: linear-gradient(90deg, var(--ps-accent-from), var(--ps-accent-to)); }

        .ps2-header {
          flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px; border-bottom: 1px solid var(--ps-border); gap: 12px;
        }
        .ps2-header-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .ps2-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--ps-accent-from), var(--ps-accent-to));
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: var(--ps-font-display); font-weight: 700; font-size: 13px;
        }
        .ps2-emp-name { font-family: var(--ps-font-display); font-weight: 700; font-size: 14px; color: var(--ps-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ps2-emp-meta { font-size: 11px; color: var(--ps-muted); }
        .ps2-close {
          width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--ps-border);
          background: var(--ps-surface); color: var(--ps-muted); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background .12s ease, color .12s ease;
        }
        .ps2-close:hover { background: var(--ps-bg-alt); color: var(--ps-ink); }

        .ps2-print-btn {
          height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--ps-border);
          background: var(--ps-surface); color: var(--ps-ink); flex-shrink: 0; font-size: 12px; font-weight: 600;
          display: flex; align-items: center; gap: 6px; cursor: pointer;
          transition: background .12s ease, border-color .12s ease;
        }
        .ps2-print-btn:hover { background: var(--ps-bg-alt); border-color: #D1D5DB; }

        .ps2-body {
          flex: 1; min-height: 0; overflow-y: auto;
          display: flex; flex-direction: column;
        }
        @media (min-width: 860px) {
          .ps2-body { flex-direction: row; overflow: hidden; }
        }

        .ps2-main { flex: 1; min-width: 0; overflow-y: auto; padding: 20px; }
        @media (min-width: 860px) {
          .ps2-main { padding: 24px; border-right: 1px solid var(--ps-border); }
        }

        .ps2-title-row { margin-bottom: 18px; }
        .ps2-title { font-family: var(--ps-font-display); font-size: 20px; font-weight: 800; color: var(--ps-ink); letter-spacing: -0.01em; }
        .ps2-period { font-size: 12px; color: var(--ps-muted); font-weight: 600; margin-top: 2px; }

        /* ── Pay Bridge (signature element) ───────────────── */
        .ps2-bridge { margin-bottom: 24px; }
        .ps2-bridge-labels { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
        .ps2-bridge-expected { font-size: 11px; color: var(--ps-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
        .ps2-bridge-pct { font-family: var(--ps-font-mono); font-size: 12px; font-weight: 600; color: var(--ps-green); }
        .ps2-bridge-pct.short { color: var(--ps-red); }
        .ps2-bridge-track {
          position: relative; height: 34px; border-radius: 10px;
          background: var(--ps-bg-alt); border: 1px solid var(--ps-border);
          overflow: hidden;
        }
        .ps2-bridge-fill {
          position: absolute; inset: 0; height: 100%;
          background: linear-gradient(90deg, var(--ps-accent-from), var(--ps-accent-to));
          border-radius: 9px 0 0 9px;
          display: flex; align-items: center; padding-left: 10px;
          transition: width .5s cubic-bezier(.22,1,.36,1);
        }
        .ps2-bridge-fill-label { font-family: var(--ps-font-mono); font-size: 11px; font-weight: 700; color: white; white-space: nowrap; }
        .ps2-bridge-gap {
          position: absolute; top: 0; bottom: 0; right: 0;
          background-image: repeating-linear-gradient(-45deg, var(--ps-red-bg), var(--ps-red-bg) 4px, #FEE2E2 4px, #FEE2E2 8px);
          border-left: 1px dashed var(--ps-red);
        }
        .ps2-bridge-foot { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--ps-faint); }
        .ps2-bridge-foot b { color: var(--ps-red); font-family: var(--ps-font-mono); }

        .ps2-section { margin-bottom: 22px; }
        .ps2-section-label {
          font-family: var(--ps-font-display); font-size: 11px; font-weight: 800; color: var(--ps-ink);
          text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px;
          display: flex; align-items: center; gap: 6px;
        }
        .ps2-section-dot { width: 6px; height: 6px; border-radius: 50%; }

        .ps2-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid var(--ps-border);
        }
        .ps2-row:last-child { border-bottom: none; }
        .ps2-row-main { min-width: 0; }
        .ps2-row-label { font-size: 13px; font-weight: 600; color: var(--ps-ink); display: flex; align-items: center; gap: 6px; }
        .ps2-row-sub { font-size: 11px; color: var(--ps-faint); margin-top: 1px; }
        .ps2-row-amount { font-family: var(--ps-font-mono); font-size: 13px; font-weight: 700; color: var(--ps-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ps2-row-amount.pos { color: var(--ps-green); }
        .ps2-row-amount.neg { color: var(--ps-red); }
        .ps2-badge {
          font-size: 9px; font-weight: 700; padding: 1px 7px; border-radius: 99px;
          background: var(--ps-bg-alt); border: 1px solid var(--ps-border); color: var(--ps-muted);
          text-transform: uppercase; letter-spacing: .04em;
        }

        .ps2-fb-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        .ps2-empty { font-size: 12px; color: var(--ps-faint); font-style: italic; padding: 6px 0; }
        .ps2-alert { padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; background: var(--ps-red-bg); color: var(--ps-red); margin-bottom: 16px; }

        /* ── Summary panel ─────────────────────────────────── */
        .ps2-summary {
          flex-shrink: 0; padding: 20px;
          border-top: 1px solid var(--ps-border);
          background: var(--ps-surface);
        }
        @media (min-width: 860px) {
          .ps2-summary { width: 300px; border-top: none; overflow-y: auto; }
        }

        .ps2-sum-card {
          background: var(--ps-bg-alt); border: 1px solid var(--ps-border); border-radius: 12px;
          padding: 14px 16px; margin-bottom: 10px;
        }
        .ps2-sum-label { font-size: 11px; color: var(--ps-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
        .ps2-sum-value { font-family: var(--ps-font-mono); font-size: 18px; font-weight: 700; color: var(--ps-ink); font-variant-numeric: tabular-nums; }

        .ps2-net-card {
          background: linear-gradient(135deg, #14181F, #262C38);
          border-radius: 12px; padding: 16px; margin-top: 6px;
        }
        .ps2-net-label { font-size: 11px; color: rgba(255,255,255,0.65); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
        .ps2-net-value { font-family: var(--ps-font-mono); font-size: 26px; font-weight: 800; color: white; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }

        .ps2-skeleton { height: 16px; border-radius: 6px; background: var(--ps-bg-alt); margin-bottom: 8px; animation: ps2Skel 1.2s ease infinite alternate; }
        @keyframes ps2Skel { from { opacity: .5 } to { opacity: 1 } }

        /* ── Print ──────────────────────────────────────────
           The on-screen layout is a fixed-position, scroll-clipped,
           dark-gradient modal — none of that survives printing well,
           so we unwind it back into normal document flow, drop the
           backdrop/shadow/animation, and swap the dark Net Pay card
           for a bordered light one (a solid dark fill either prints
           as a black block or gets silently stripped by the browser). */
        @media print {
          /* Isolate the payslip: hide everything else on the page, then
             pull the payslip out to the top-left of the print flow so it
             starts fresh on page 1 and paginates naturally if it runs
             longer than one sheet. */
          body * { visibility: hidden !important; }
          #payslip-print-area, #payslip-print-area * { visibility: visible !important; }
          #payslip-print-area {
            position: absolute !important; top: 0 !important; left: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 0 !important;
            background: none !important; display: block !important;
          }

          .ps2-sheet {
            width: 100%; max-width: 100%; height: auto; max-height: none;
            border-radius: 0; box-shadow: none; animation: none;
            display: block; overflow: visible !important; /* base rule sets overflow:hidden — this was clipping content past the on-screen modal height */
          }
          .ps2-band { background: var(--ps-ink); height: 2px; }
          .ps2-close, .ps2-print-btn { display: none !important; }

          /* Compact type + spacing scale, print-only — the on-screen sizing
             is tuned for a touch-friendly modal, not a dense paper document */
          .ps2-header { padding: 10px 4px; border-bottom: 1.5px solid var(--ps-ink); }
          .ps2-avatar { width: 30px; height: 30px; font-size: 11px; }
          .ps2-emp-name { font-size: 12px; }
          .ps2-emp-meta { font-size: 9.5px; }
          .ps2-title { font-size: 15px; }
          .ps2-period { font-size: 9.5px; margin-top: 0; }
          .ps2-title-row { margin-bottom: 10px; }

          .ps2-body { display: block; overflow: visible; }
          .ps2-main {
            border-right: none; overflow: visible; padding: 12px 4px 4px;
          }

          /* Earnings + Deductions side-by-side to use the page's width
             instead of stacking, which is what actually buys back the
             vertical space needed to fit on one sheet. */
          .ps2-bridge { margin-bottom: 12px; }
          .ps2-bridge-track { height: 22px; }
          .ps2-bridge-fill-label { font-size: 9.5px; }
          .ps2-bridge-labels { margin-bottom: 4px; }
          .ps2-bridge-expected, .ps2-bridge-pct { font-size: 9.5px; }
          .ps2-bridge-foot { font-size: 9.5px; margin-top: 3px; }

          .ps2-earnings-dedections-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px;
            align-items: start;
          }
          .ps2-section { margin-bottom: 0; }
          .ps2-section-label { font-size: 9px; margin-bottom: 4px; }
          .ps2-row { padding: 4px 0; }
          .ps2-row-label { font-size: 10.5px; gap: 4px; }
          .ps2-row-sub { font-size: 8.5px; }
          .ps2-row-amount { font-size: 10.5px; }
          .ps2-badge { font-size: 7.5px; padding: 0 5px; }
          .ps2-fb-dot, .ps2-section-dot { width: 5px; height: 5px; }

          .ps2-summary {
            width: 100%; overflow: visible; border-top: 1.5px solid var(--ps-ink);
            display: flex; gap: 10px; padding: 10px 4px 0; margin-top: 12px;
          }
          .ps2-sum-card, .ps2-net-card { flex: 1; margin-bottom: 0; padding: 8px 12px; }
          .ps2-sum-label, .ps2-net-label { font-size: 8.5px; }
          .ps2-sum-value { font-size: 13px; }
          .ps2-net-value { font-size: 17px; }
          .ps2-net-card {
            background: var(--ps-surface); border: 1.5px solid var(--ps-ink);
          }
          .ps2-net-label { color: var(--ps-muted); }
          .ps2-net-value { color: var(--ps-ink); }

          .ps2-bridge-fill { background: var(--ps-ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ps2-fb-dot, .ps2-section-dot { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ps2-section, .ps2-bridge, .ps2-row { break-inside: avoid; }

          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div id="payslip-print-area" className="ps2-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ps2-sheet">
          <div className="ps2-band" />

          <div className="ps2-header">
            <div className="ps2-header-id">
              <div className="ps2-avatar">
                {employeeName.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="ps2-emp-name">{loading ? "Loading…" : employeeName}</div>
                <div className="ps2-emp-meta">ID: {employeeID} · {fmtDateLong(dateFrom)} – {fmtDateLong(dateTo)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button className="ps2-print-btn" onClick={() => window.print()} aria-label="Print payslip">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M5 8V3h10v5M5 15H3.5A1.5 1.5 0 0 1 2 13.5v-4A1.5 1.5 0 0 1 3.5 8h13A1.5 1.5 0 0 1 18 9.5v4a1.5 1.5 0 0 1-1.5 1.5H15M5 12h10v6H5v-6Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Print</span>
              </button>
              <button className="ps2-close" onClick={onClose} aria-label="Close payslip">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              <div className="ps2-skeleton" style={{ width: "40%", height: 32 }} />
              <div className="ps2-skeleton" style={{ width: "100%", height: 34, marginTop: 16 }} />
              <div className="ps2-skeleton" style={{ width: "80%" }} />
              <div className="ps2-skeleton" style={{ width: "70%" }} />
              <div className="ps2-skeleton" style={{ width: "60%" }} />
            </div>
          ) : error ? (
            <div style={{ padding: 24 }}>
              <div className="ps2-alert">{error}</div>
            </div>
          ) : (
            <div className="ps2-body">
              <div className="ps2-main">
                <div className="ps2-title-row">
                  <div className="ps2-title">Payslip</div>
                  <div className="ps2-period">{daysComputed} day(s) computed · {totalWorkingHours}h total</div>
                </div>

                {/* Pay Bridge — Expected Salary vs. what actually landed */}
                <div className="ps2-bridge">
                  <div className="ps2-bridge-labels">
                    <span className="ps2-bridge-expected">Expected {formatCurrency(expectedGrossPay, currency)}</span>
                    <span className={`ps2-bridge-pct ${retainedPct < 100 ? "short" : ""}`}>{retainedPct.toFixed(1)}% retained</span>
                  </div>
                  <div className="ps2-bridge-track">
                    {lostToDeductions > 0 && (
                      <div className="ps2-bridge-gap" style={{ width: `${100 - retainedPct}%` }} />
                    )}
                    <div className="ps2-bridge-fill" style={{ width: `${retainedPct}%` }}>
                      <span className="ps2-bridge-fill-label">{formatCurrency(grossPay, currency)}</span>
                    </div>
                  </div>
                  {lostToDeductions > 0 && (
                    <div className="ps2-bridge-foot">
                      <span>Actual earnings</span>
                      <span><b>−{formatCurrency(lostToDeductions, currency)}</b> lost to deductions</span>
                    </div>
                  )}
                </div>

                <div className="ps2-earnings-dedections-grid">
                {/* Earnings */}
                <div className="ps2-section">
                  <div className="ps2-section-label">
                    <span className="ps2-section-dot" style={{ background: "var(--ps-green)" }} />
                    Earnings
                  </div>

                  {earnings.regular > 0 && (
                    <div className="ps2-row">
                      <div className="ps2-row-main">
                        <div className="ps2-row-label">
                          Regular Pay
                          {payStructure && <span className="ps2-badge">{payStructure.Structure}</span>}
                        </div>
                        <div className="ps2-row-sub">{daysComputed} day(s)</div>
                      </div>
                      <div className="ps2-row-amount pos">{formatCurrency(earnings.regular, currency)}</div>
                    </div>
                  )}
                  {earnings.holiday > 0 && (
                    <div className="ps2-row">
                      <div className="ps2-row-main"><div className="ps2-row-label">Holiday Pay</div></div>
                      <div className="ps2-row-amount pos">{formatCurrency(earnings.holiday, currency)}</div>
                    </div>
                  )}
                  {earnings.overtime > 0 && (
                    <div className="ps2-row">
                      <div className="ps2-row-main"><div className="ps2-row-label">Overtime</div></div>
                      <div className="ps2-row-amount pos">{formatCurrency(earnings.overtime, currency)}</div>
                    </div>
                  )}
                  {earnings.nightDiff > 0 && (
                    <div className="ps2-row">
                      <div className="ps2-row-main"><div className="ps2-row-label">Night Shift Differential</div></div>
                      <div className="ps2-row-amount pos">{formatCurrency(earnings.nightDiff, currency)}</div>
                    </div>
                  )}
                  {bonusItems.map((b, i) => (
                    <div className="ps2-row" key={`bonus-${i}`}>
                      <div className="ps2-row-main">
                        <div className="ps2-row-label">{b.name}</div>
                        <div className="ps2-row-sub">{b.formula}</div>
                      </div>
                      <div className="ps2-row-amount pos">+{formatCurrency(b.amount, currency)}</div>
                    </div>
                  ))}
                  {grossPay === 0 && bonusItems.length === 0 && (
                    <div className="ps2-empty">No computed pay found for this period.</div>
                  )}
                </div>

                {/* Deductions */}
                <div className="ps2-section">
                  <div className="ps2-section-label">
                    <span className="ps2-section-dot" style={{ background: "var(--ps-red)" }} />
                    Deductions
                  </div>

                  {feedbackItems.map((f, i) => (
                    <div className="ps2-row" key={`fb-${i}`}>
                      <div className="ps2-row-main">
                        <div className="ps2-row-label">
                          <span className="ps2-fb-dot" style={{ background: feedbackAccent(f.type) }} />
                          {feedbackLabel(f.type)}
                        </div>
                        <div className="ps2-row-sub">
                          {fmtDate(f.date)}
                          {f.scheduledTime && f.actualTime ? ` · ${f.scheduledTime} → ${f.actualTime}` : ""}
                          {` · ${f.deductionMinutes}m`}
                        </div>
                      </div>
                      <div className="ps2-row-amount neg">
                        {f.deductionAmount !== undefined ? `−${formatCurrency(f.deductionAmount, currency)}` : "—"}
                      </div>
                    </div>
                  ))}

                  {deductionItems.map((d, i) => (
                    <div className="ps2-row" key={`ded-${i}`}>
                      <div className="ps2-row-main">
                        <div className="ps2-row-label">{d.name}</div>
                        <div className="ps2-row-sub">{d.formula}</div>
                      </div>
                      <div className="ps2-row-amount neg">−{formatCurrency(d.amount, currency)}</div>
                    </div>
                  ))}

                  {feedbackItems.length === 0 && deductionItems.length === 0 && (
                    <div className="ps2-empty">No deductions on record.</div>
                  )}
                </div>
                </div>
              </div>

              {/* Summary — sticky footer on mobile, sticky right column on desktop */}
              <div className="ps2-summary">
                <div className="ps2-sum-card">
                  <div className="ps2-sum-label">Expected Salary</div>
                  <div className="ps2-sum-value">{formatCurrency(expectedGrossPay, currency)}</div>
                </div>
                <div className="ps2-sum-card">
                  <div className="ps2-sum-label">Actual Gross</div>
                  <div className="ps2-sum-value">{formatCurrency(grossPay + totalBonuses, currency)}</div>
                </div>
                <div className="ps2-net-card">
                  <div className="ps2-net-label">Net Pay</div>
                  <div className="ps2-net-value">{formatCurrency(netPay, currency)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}