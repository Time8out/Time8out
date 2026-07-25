import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

interface DeductionEntry { Name: string; Formula: string; }
interface BonusEntry { Name: string; Formula: string; }
interface PayStructureEntry { Structure: string; Formula: string; }

interface Props {
  employeeID: string;
  companyCode: string; // now required — needed to scope the Attendance query correctly
  dateFrom: string;
  dateTo: string;
  totalWorkingHours: number; // kept for display only, no longer used in pay math
  totalDays: number;         // kept for display only, no longer used in pay math
  totalDeductionMinutes: number; // kept for display only — the peso amount is now baked into Regular/Holiday already
  onClose: () => void;
}

interface EarningsBreakdown {
  regular: number;
  holiday: number;
  overtime: number;
  nightDiff: number;
}

function evaluateFormula(formula: string, salary: number, totalHours: number, deductionMinutes: number): number {
  try {
    const substituted = formula
      .replace(/\{Salary\}/gi, salary.toString())
      .replace(/\{TotalHours\}/gi, totalHours.toString())
      .replace(/\{DeductionMinutes\}/gi, deductionMinutes.toString());

    const ifMatch = substituted.match(/^\s*if\s+(.+?)\s+then\s+(.+)$/i);
    if (ifMatch) {
      const condition = ifMatch[1].replace(/[^0-9+\-*/.()<>= !&|]/g, "");
      const expr = ifMatch[2].replace(/[^0-9+\-*/.() ]/g, "");
      // eslint-disable-next-line no-new-func
      const conditionResult = new Function(`return (${condition})`)();
      if (!conditionResult) return 0;
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expr})`)();
      return typeof result === "number" && isFinite(result) ? Math.abs(result) : 0;
    }

    const sanitized = substituted.replace(/[^0-9+\-*/.() ]/g, "");
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
  totalDays,
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
  const [earnings, setEarnings] = useState<EarningsBreakdown>({ regular: 0, holiday: 0, overtime: 0, nightDiff: 0 });
  const [daysComputed, setDaysComputed] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      // ── Employee + pay structure config ─────────────────
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

      // ── Sum already-computed daily pay across the period ──
      // Regular/Holiday/Overtime/NightShiftDifferential are written per-day
      // by compute_attendance_pay(), which already accounts for TimeDeduction,
      // holiday rates, OT rules, and night differential. We just total them.
      const { data: attendanceRows, error: attErr } = await supabase
        .from("Attendance")
        .select("Regular, Holiday, Overtime, NightShiftDifferential")
        .eq("EmployeeID", employeeID)
        .eq("CompanyCode", companyCode)
        .gte("AttendanceDate", dateFrom)
        .lte("AttendanceDate", dateTo);

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
        }),
        { regular: 0, holiday: 0, overtime: 0, nightDiff: 0 },
      );

      setEarnings(summed);
      setDaysComputed(rows.length);
      setLoading(false);
    }
    load();
  }, [employeeID, companyCode, dateFrom, dateTo]);

  // ── Computation ──────────────────────────────────────────
  // Gross pay is now the sum of already-computed daily earnings —
  // no client-side recalculation of rates, holiday %, or OT rules here.
  const grossPay = earnings.regular + earnings.holiday + earnings.overtime + earnings.nightDiff;

  // Custom deduction/bonus formulas still run against the computed gross pay.
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

  // NOTE: no separate `monetaryDeduction` subtraction anymore — late/overbreak/
  // auto-logout minutes are already baked into Regular/Holiday by compute_attendance_pay().
  // Subtracting it again here would double-deduct the same minutes.
  const netPay = grossPay - totalDeductions + totalBonuses;

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <style>{`
        .ps-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:400;animation:psFadeIn .15s ease;padding:16px}
        @keyframes psFadeIn{from{opacity:0}to{opacity:1}}
        .ps-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:480px;max-height:94vh;overflow-y:auto;animation:psSlideUp .2s cubic-bezier(.22,1,.36,1)}
        @keyframes psSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .ps-band{height:4px;background:var(--gradient-brand);border-radius:var(--radius-xl) var(--radius-xl) 0 0}
        .ps-body{padding:var(--space-6)}

        .ps-header{margin-bottom:var(--space-5)}
        .ps-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);letter-spacing:-.01em;margin-bottom:2px}
        .ps-period{font-size:var(--font-size-xs);color:var(--color-text-muted);font-weight:600}
        .ps-emp-row{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);margin-bottom:var(--space-5)}
        .ps-emp-avatar{width:36px;height:36px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;flex-shrink:0}
        .ps-emp-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .ps-emp-id{font-size:var(--font-size-xs);color:var(--color-text-muted)}

        .ps-section{margin-bottom:var(--space-4)}
        .ps-section-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:var(--space-2)}
        .ps-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border)}
        .ps-row:last-child{border-bottom:none}
        .ps-row-label{font-size:var(--font-size-sm);color:var(--color-text-secondary)}
        .ps-row-formula{font-size:10px;color:var(--color-text-faint);font-family:monospace;margin-top:1px}
        .ps-row-amount{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .ps-row-amount.deduction{color:#dc2626}
        .ps-row-amount.bonus{color:#15803d}

        .ps-divider{height:1px;background:var(--color-border);margin:var(--space-4) 0}

        .ps-gross{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);margin-bottom:var(--space-3)}
        .ps-gross-label{font-size:var(--font-size-sm);color:var(--color-text-muted);font-weight:600}
        .ps-gross-amount{font-size:var(--font-size-base);font-weight:700;color:var(--color-text)}

        .ps-net{display:flex;align-items:center;justify-content:space-between;padding:var(--space-4);background:var(--color-text);border-radius:var(--radius-lg);margin-bottom:var(--space-5)}
        .ps-net-label{font-size:var(--font-size-sm);color:rgba(255,255,255,0.7);font-weight:600}
        .ps-net-amount{font-size:var(--font-size-2xl);font-weight:700;color:white;letter-spacing:-.02em}

        .ps-empty{font-size:var(--font-size-xs);color:var(--color-text-faint);font-style:italic;padding:var(--space-2) 0}
        .ps-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;background:var(--color-danger-light);color:var(--color-danger);margin-bottom:var(--space-4)}
        .ps-footer{display:flex;justify-content:flex-end;gap:var(--space-3);padding-top:var(--space-4);border-top:1px solid var(--color-border)}
        .ps-meta{font-size:10px;color:var(--color-text-faint);margin-top:2px}

        .ps-skeleton{height:16px;border-radius:6px;background:var(--color-bg-alt);margin-bottom:8px;animation:psSkel 1.2s ease infinite alternate}
        @keyframes psSkel{from{opacity:.5}to{opacity:1}}
      `}</style>

      <div className="ps-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ps-modal">
          <div className="ps-band" />
          <div className="ps-body">

            <div className="ps-header">
              <div className="ps-title">Payslip</div>
              <div className="ps-period">{fmtDate(dateFrom)} — {fmtDate(dateTo)}</div>
            </div>

            {loading ? (
              <>
                <div className="ps-skeleton" style={{ width: "60%" }} />
                <div className="ps-skeleton" style={{ width: "40%" }} />
                <div className="ps-skeleton" style={{ width: "80%", marginTop: 16 }} />
                <div className="ps-skeleton" />
                <div className="ps-skeleton" style={{ width: "70%" }} />
              </>
            ) : error ? (
              <div className="ps-alert">{error}</div>
            ) : (
              <>
                {/* Employee */}
                <div className="ps-emp-row">
                  <div className="ps-emp-avatar">
                    {employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="ps-emp-name">{employeeName}</div>
                    <div className="ps-emp-id">ID: {employeeID}</div>
                  </div>
                </div>

                {/* Earnings — now itemized straight from computed daily pay */}
                <div className="ps-section">
                  <div className="ps-section-label">Earnings</div>

                  {earnings.regular > 0 && (
                    <div className="ps-row">
                      <div>
                        <div className="ps-row-label">Regular Pay
                          {payStructure && (
                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", borderRadius: 99, padding: "1px 8px", color: "var(--color-text-muted)" }}>
                              {payStructure.Structure}
                            </span>
                          )}
                        </div>
                        <div className="ps-row-formula">{daysComputed} day(s) · {totalWorkingHours}h total</div>
                      </div>
                      <div className="ps-row-amount">{formatCurrency(earnings.regular, currency)}</div>
                    </div>
                  )}

                  {earnings.holiday > 0 && (
                    <div className="ps-row">
                      <div>
                        <div className="ps-row-label">Holiday Pay</div>
                      </div>
                      <div className="ps-row-amount">{formatCurrency(earnings.holiday, currency)}</div>
                    </div>
                  )}

                  {earnings.overtime > 0 && (
                    <div className="ps-row">
                      <div>
                        <div className="ps-row-label">Overtime</div>
                      </div>
                      <div className="ps-row-amount">{formatCurrency(earnings.overtime, currency)}</div>
                    </div>
                  )}

                  {earnings.nightDiff > 0 && (
                    <div className="ps-row">
                      <div>
                        <div className="ps-row-label">Night Shift Differential</div>
                      </div>
                      <div className="ps-row-amount">{formatCurrency(earnings.nightDiff, currency)}</div>
                    </div>
                  )}

                  {grossPay === 0 && (
                    <div className="ps-empty">No computed pay found for this period.</div>
                  )}

                  {bonusItems.length > 0 && bonusItems.map((b, i) => (
                    <div key={i} className="ps-row">
                      <div>
                        <div className="ps-row-label">{b.name}</div>
                        <div className="ps-row-formula">{b.formula}</div>
                      </div>
                      <div className="ps-row-amount bonus">+{formatCurrency(b.amount, currency)}</div>
                    </div>
                  ))}
                </div>

                {/* Deductions */}
                <div className="ps-section">
                  <div className="ps-section-label">Deductions</div>
                  {totalDeductionMinutes > 0 && (
                    <div className="ps-row">
                      <div>
                        <div className="ps-row-label">Time Deduction</div>
                        <div className="ps-row-formula">{totalDeductionMinutes} mins late/overbreak/early-out (already applied to earnings above)</div>
                      </div>
                    </div>
                  )}
                  {deductionItems.length === 0 ? (
                    <div className="ps-empty">No deductions on record.</div>
                  ) : deductionItems.map((d, i) => (
                    <div key={i} className="ps-row">
                      <div>
                        <div className="ps-row-label">{d.name}</div>
                        <div className="ps-row-formula">{d.formula}</div>
                      </div>
                      <div className="ps-row-amount deduction">−{formatCurrency(d.amount, currency)}</div>
                    </div>
                  ))}
                </div>

                <div className="ps-divider" />

                {/* Gross */}
                <div className="ps-gross">
                  <span className="ps-gross-label">Gross Pay</span>
                  <span className="ps-gross-amount">{formatCurrency(grossPay + totalBonuses, currency)}</span>
                </div>

                {/* Net */}
                <div className="ps-net">
                  <span className="ps-net-label">Net Pay</span>
                  <span className="ps-net-amount">{formatCurrency(netPay, currency)}</span>
                </div>

                <div className="ps-footer">
                  <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}