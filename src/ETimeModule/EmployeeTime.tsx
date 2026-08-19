import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import Payslip from "./Payslip";

interface BreakEntry {
  breakIn: string;
  breakOut: string;
  ActualBreakIn: string;
  ActualBreakOut: string;
}

interface ShiftEntry {
  timeIn: string;
  TimeOut: string;
  ActualTimeIn: string;
  ActualTimeOut: string;
  breaks: BreakEntry[];
}

interface AttendanceRecord {
  id: number;
  AttendanceDate: string;
  status: string;
  TimeDeduction: number;
  TotalWorkingHours: number | null;
  ScheduleTimeAndAttendance: ShiftEntry[];
  StampsFeedback: any[];
}

function formatMinutes(mins: number): string {
  if (!mins || mins === 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatHours(hours: number | null): string {
  if (!hours || hours === 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getStatusStyle(status: string): React.CSSProperties {
  const map: Record<string, { background: string; color: string; borderColor: string }> = {
    Finished: { background: "#EAF3DE", color: "#27500A", borderColor: "#97C459" },
    Absent:   { background: "#FCEBEB", color: "#791F1F", borderColor: "#F09595" },
    Open:     { background: "#E6F1FB", color: "#0C447C", borderColor: "#85B7EB" },
  };
  return map[status] ?? { background: "#F1EFE8", color: "#5F5E5A", borderColor: "#B4B2A9" };
}

function getShiftStatus(shift: ShiftEntry): { label: string; color: string } {
  if (shift.ActualTimeIn === "MISSED") return { label: "Missed", color: "#dc2626" };
  if (!shift.ActualTimeIn) return { label: "No time-in", color: "#b45309" };
  if (!shift.ActualTimeOut) return { label: "No time-out", color: "#b45309" };
  return { label: "Complete", color: "#15803d" };
}

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

function ShiftBreakdown({ rec }: { rec: AttendanceRecord }) {
  return (
    <>
      <div className="et-detail-title">Shift Breakdown</div>
      {(rec.ScheduleTimeAndAttendance ?? []).map((s, si) => {
        const ss = getShiftStatus(s);
        return (
          <div key={si} className="et-shift">
            <div className="et-shift-header">
              <div>
                <div className="et-shift-times">{s.timeIn} – {s.TimeOut}</div>
                <div className="et-shift-actual">
                  Time in: <strong>{s.ActualTimeIn || "—"}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Time out: <strong>{s.ActualTimeOut || "—"}</strong>
                </div>
              </div>
              <span className="et-shift-status" style={{ color: ss.color }}>{ss.label}</span>
            </div>
            {(s.breaks?.length ?? 0) > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Breaks</div>
                <div className="et-breaks">
                  {s.breaks.map((b, bi) => (
                    <div key={bi} className="et-break-row">
                      <span className="et-break-sched">
                        <span className="et-break-label">Sched </span>{b.breakIn} – {b.breakOut}
                      </span>
                      {b.ActualBreakIn === "MISSED"
                        ? <span className="et-missed">Missed</span>
                        : <>
                            <span className="et-break-actual">
                              <span className="et-break-label">In </span>{b.ActualBreakIn || "—"}
                            </span>
                            <span className="et-break-actual">
                              <span className="et-break-label">Out </span>{b.ActualBreakOut || "—"}
                            </span>
                          </>
                      }
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function EmployeeTime() {
  const [employeeID, setEmployeeID] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [allowSelfPayslip, setAllowSelfPayslip] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showPayslip, setShowPayslip] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<{ newPassword?: string; confirmNewPassword?: string }>({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(fmt(firstOfMonth));
  const [dateTo, setDateTo] = useState(fmt(today));

  useEffect(() => {
    const raw = sessionStorage.getItem("t8_session");
    if (!raw) { setError("No session found."); return; }
    const decoded = atob(raw);
    const email = decoded.split(":")[1];
    setUserEmail(email);
    supabase.from("users").select("EmployeeID, CompanyCode, InitialLogin, UserType, PayStructure").eq("Email", email).single()
      .then(({ data, error: e }) => {
        if (e || !data) { setError("Could not load user."); return; }
        setEmployeeID(data.EmployeeID);
        setCompanyCode(data.CompanyCode);
        setAllowSelfPayslip(data.PayStructure?.[0]?.AllowSelfPayslip !== false);
        const requiresPasswordChange = data.UserType !== "Special" && data.InitialLogin === true;
        if (requiresPasswordChange) setForcePasswordChange(true);
      });
  }, []);

  function validatePasswordChange(): boolean {
    const e: { newPassword?: string; confirmNewPassword?: string } = {};
    if (!newPassword) e.newPassword = "New password is required.";
    else if (newPassword.length < 8) e.newPassword = "Password must be at least 8 characters.";
    if (!confirmNewPassword) e.confirmNewPassword = "Please confirm your new password.";
    else if (newPassword !== confirmNewPassword) e.confirmNewPassword = "Passwords do not match.";
    setPasswordErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePasswordChange()) return;
    if (!userEmail) { setPasswordMsg("No session found."); return; }

    setPasswordLoading(true);
    setPasswordMsg(null);

    const { error: updateError } = await supabase
      .from("users")
      .update({ Password: newPassword, InitialLogin: false })
      .eq("Email", userEmail);

    if (updateError) {
      setPasswordMsg(updateError.message);
      setPasswordLoading(false);
      return;
    }

    window.location.reload();
  }

  async function fetchAttendance() {
    if (!employeeID) { setError("Employee ID not found."); return; }
    if (!dateFrom || !dateTo) { setError("Please select a date range."); return; }
    if (dateFrom > dateTo) { setError("Start date must be before end date."); return; }
    setLoading(true); setError(null); setExpandedId(null);
    const { data, error: e } = await supabase
      .from("Attendance")
      .select("*")
      .eq("EmployeeID", employeeID)
      .gte("AttendanceDate", dateFrom)
      .lte("AttendanceDate", dateTo)
      .order("AttendanceDate", { ascending: false });
    if (e) { setError(e.message); }
    else { setRecords(data ?? []); }
    setLoading(false);
  }

  useEffect(() => {
    if (employeeID) fetchAttendance();
  }, [employeeID]);

  const totalDays = records.length;
  const presentDays = records.filter(r => r.status === "Finished" && (r.TotalWorkingHours ?? 0) > 0).length;
  const absentDays = records.filter(r => {
    const shift = r.ScheduleTimeAndAttendance?.[0];
    return shift?.ActualTimeIn === "MISSED";
  }).length;
  const totalDeduction = records.reduce((sum, r) => sum + (r.TimeDeduction ?? 0), 0);
  const totalHours = records.reduce((sum, r) => sum + (r.TotalWorkingHours ?? 0), 0);

  return (
    <>
      <style>{`
        .et-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .et-header{margin-bottom:var(--space-6)}
        .et-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .et-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}

        /* Filter */
        .et-filter{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);display:flex;align-items:flex-end;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-5);box-shadow:var(--shadow-xs)}
        .et-filter-field{display:flex;flex-direction:column;gap:var(--space-2)}
        .et-filter-label{font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em}
        .et-filter-input{height:38px;width:160px}
        @media(max-width:480px){.et-filter{flex-direction:column;align-items:stretch}.et-filter-input{width:100%}}

        /* Stats */
        .et-stats{display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap}
        .et-stat{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);flex:1;min-width:80px;box-shadow:var(--shadow-xs)}
        .et-stat-num{font-size:var(--font-size-xl);font-weight:700;line-height:1.2}
        .et-stat-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}

        /* Table */
        .et-table-wrap{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:auto;box-shadow:var(--shadow-sm);margin-bottom:var(--space-5)}
        @media(max-width:760px){.et-table-wrap{display:none}}
        .et-table{width:100%;border-collapse:collapse;min-width:720px}
        .et-table thead tr{border-bottom:2px solid var(--color-border)}
        .et-table th{text-align:left;font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-muted);letter-spacing:.07em;text-transform:uppercase;padding:10px 14px;white-space:nowrap}
        .et-table td{padding:12px 14px;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border);vertical-align:middle}
        .et-table tbody tr.et-main-row{cursor:pointer;transition:background var(--transition-fast)}
        .et-table tbody tr.et-main-row:hover{background:var(--brand-orange-light)}
        .et-table tbody tr.et-main-row:hover td{color:var(--color-text)}

        .et-status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
        .et-mono{font-family:monospace;font-size:12px}
        .et-missed{color:#dc2626;font-weight:700}
        .et-muted{color:var(--color-text-faint)}
        .et-chevron{color:var(--color-text-faint);font-size:11px}

        /* Mobile card list — replaces the table below 760px so columns never get squeezed/wrapped */
        .et-card-list{display:none;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-5)}
        @media(max-width:760px){.et-card-list{display:flex}}
        .et-record-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);box-shadow:var(--shadow-xs);cursor:pointer;transition:box-shadow .15s,border-color .15s}
        .et-record-card:active{box-shadow:none}
        .et-record-top{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3)}
        .et-record-date{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .et-record-shift{font-size:12px;color:var(--color-text-muted);font-family:monospace}
        .et-record-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-3);margin-bottom:var(--space-3)}
        .et-record-cell{display:flex;flex-direction:column;gap:2px;min-width:0}
        .et-record-label{font-size:10px;font-weight:700;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.05em}
        .et-record-chevron{font-size:11px;font-weight:700;color:var(--brand-orange);text-align:center;padding-top:var(--space-2);border-top:1px dashed var(--color-border)}
        .et-record-detail{margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-border)}

        /* Expanded detail */
        .et-detail td{padding:0;background:var(--color-bg-alt)}
        .et-detail-inner{padding:var(--space-4) var(--space-5)}
        .et-detail-title{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:var(--space-3)}
        .et-shift{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3)}
        .et-shift:last-child{margin-bottom:0}
        .et-shift-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-3)}
        .et-shift-times{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .et-shift-actual{font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:3px}
        .et-shift-status{font-size:11px;font-weight:700;flex-shrink:0}
        .et-breaks{display:flex;flex-direction:column;gap:6px}
        .et-break-row{display:flex;align-items:center;gap:var(--space-3);font-size:var(--font-size-xs);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:6px 10px;flex-wrap:wrap}
        .et-break-sched{color:var(--color-text-muted);flex:1;min-width:120px}
        .et-break-actual{color:var(--color-text);font-weight:600}
        .et-break-label{font-size:10px;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.05em}

        /* Total hours footer */
        .et-total-bar{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);box-shadow:var(--shadow-xs);transition:border-color .15s,box-shadow .15s}
        .et-total-bar:hover{border-color:var(--color-border-secondary);box-shadow:var(--shadow-sm)}
        .et-total-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-muted)}
        .et-total-value{font-size:var(--font-size-xl);font-weight:700;color:var(--color-text)}
        .et-total-sub{font-size:var(--font-size-xs);color:var(--color-text-muted)}
        .et-total-left{min-width:0}
        .et-total-left .et-total-sub{margin-top:2px}
        .et-total-right{display:flex;align-items:center;gap:var(--space-4);flex-shrink:0}
        .et-total-right-text{text-align:right}
        .et-total-right-text .et-total-sub{margin-top:2px;white-space:nowrap}
        .et-total-icon{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-md);background:var(--color-bg-alt);border:1px solid var(--color-border);flex-shrink:0}
        @media(max-width:560px){
          .et-total-bar{flex-direction:column;align-items:stretch}
          .et-total-right{width:100%;justify-content:space-between}
          .et-total-right-text .et-total-sub{white-space:normal}
        }

        .et-empty{padding:var(--space-12);text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)}
        .et-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4);background:var(--color-danger-light);color:var(--color-danger)}

        /* Force password change modal */
        .pc-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px}
        .pc-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:420px;overflow:hidden}
        .pc-modal-band{height:4px;background:var(--gradient-brand)}
        .pc-modal-body{padding:var(--space-6) var(--space-6) var(--space-8)}
        .pc-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:var(--space-1);letter-spacing:-0.01em}
        .pc-subtitle{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-6);line-height:1.6}
        .pc-form{display:flex;flex-direction:column;gap:var(--space-4)}
        .pc-field{display:flex;flex-direction:column;gap:var(--space-2)}
        .pc-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary)}
        .pc-error{font-size:var(--font-size-xs);color:var(--color-danger);font-weight:600}
        .pc-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;background:var(--color-danger-light);color:var(--color-danger);margin-bottom:var(--space-4)}
        .pc-submit{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:13px;border-radius:var(--radius-md);border:none;background:var(--gradient-orange);color:var(--color-white);font-family:var(--font-base);font-size:var(--font-size-base);font-weight:700;cursor:pointer;box-shadow:var(--shadow-brand-orange);margin-top:var(--space-2);transition:transform var(--transition-fast),opacity var(--transition-fast)}
        .pc-submit:hover:not(:disabled){transform:translateY(-2px)}
        .pc-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none}
      `}</style>

      <div className="et-page">
        <div className="et-header">
          <h1 className="et-title">My Attendance</h1>
          <p className="et-sub">Select a date range to view your attendance records.</p>
        </div>

        {/* ── Filter ── */}
        <div className="et-filter">
          <div className="et-filter-field">
            <span className="et-filter-label">From</span>
            <input
              className="form-input et-filter-input"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div className="et-filter-field">
            <span className="et-filter-label">To</span>
            <input
              className="form-input et-filter-input"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ height: 38, alignSelf: "flex-end" }}
            onClick={fetchAttendance}
            disabled={loading || !employeeID}
          >
            {loading ? "Loading…" : "Search"}
          </button>
        </div>

        {error && <div className="et-alert">{error}</div>}

        {/* ── Stats ── */}
        <div className="et-stats">
          {[
            { num: totalDays,                  label: "Total Days",      color: "var(--color-text)" },
            { num: presentDays,                label: "Present",         color: "#15803d" },
            { num: absentDays,                 label: "Absent",          color: "#dc2626" },
            { num: formatMinutes(totalDeduction), label: "Deductions",   color: "#b45309" },
            { num: formatHours(totalHours),    label: "Total Hours",     color: "var(--brand-blue)" },
          ].map(({ num, label, color }) => (
            <div key={label} className="et-stat">
              <div className="et-stat-num" style={{ color }}>{num}</div>
              <div className="et-stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <>
            <div className="et-table-wrap">
              {records.length === 0 ? (
                <div className="et-empty">No attendance records found for the selected date range.</div>
              ) : (
                <table className="et-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shift</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th className="et-col-hours">Hours</th>
                      <th className="et-col-deduction">Deduction</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(rec => {
                      const shift = rec.ScheduleTimeAndAttendance?.[0];
                      const isExpanded = expandedId === rec.id;
                      const statusStyle = getStatusStyle(rec.status);
                      const isMissed = shift?.ActualTimeIn === "MISSED";

                      return (
                        <>
                          <tr key={rec.id} className="et-main-row" onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
                            <td style={{ fontWeight: 600, color: "var(--color-text)" }}>
                              {new Date(rec.AttendanceDate + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="et-mono">
                              {shift ? `${shift.timeIn} – ${shift.TimeOut}` : "—"}
                            </td>
                            <td className="et-mono">
                              {isMissed
                                ? <span className="et-missed">Missed</span>
                                : shift?.ActualTimeIn
                                  ? shift.ActualTimeIn
                                  : <span className="et-muted">—</span>}
                            </td>
                            <td className="et-mono">
                              {isMissed
                                ? <span className="et-missed">Missed</span>
                                : shift?.ActualTimeOut
                                  ? shift.ActualTimeOut
                                  : <span className="et-muted">—</span>}
                            </td>
                            <td className="et-col-hours" style={{ fontWeight: (rec.TotalWorkingHours ?? 0) > 0 ? 600 : 400, color: "var(--color-text)" }}>
                              {formatHours(rec.TotalWorkingHours)}
                            </td>
                            <td className="et-col-deduction" style={{ color: (rec.TimeDeduction ?? 0) > 0 ? "#dc2626" : "var(--color-text-muted)", fontWeight: (rec.TimeDeduction ?? 0) > 0 ? 700 : 400 }}>
                              {(rec.TimeDeduction ?? 0) > 0 ? `−${formatMinutes(rec.TimeDeduction)}` : "—"}
                            </td>
                            <td>
                              <span className="et-status-badge" style={statusStyle}>{rec.status}</span>
                            </td>
                            <td className="et-chevron">{isExpanded ? "▴" : "▾"}</td>
                          </tr>

                          {isExpanded && (
                            <tr key={`${rec.id}-detail`} className="et-detail">
                              <td colSpan={8}>
                                <div className="et-detail-inner">
                                  <ShiftBreakdown rec={rec} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Mobile card list — same records/state, no squeezed columns ── */}
            {records.length > 0 && (
              <div className="et-card-list">
                {records.map(rec => {
                  const shift = rec.ScheduleTimeAndAttendance?.[0];
                  const isExpanded = expandedId === rec.id;
                  const statusStyle = getStatusStyle(rec.status);
                  const isMissed = shift?.ActualTimeIn === "MISSED";

                  return (
                    <div key={rec.id} className="et-record-card" onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
                      <div className="et-record-top">
                        <div>
                          <div className="et-record-date">
                            {new Date(rec.AttendanceDate + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="et-record-shift">{shift ? `${shift.timeIn} – ${shift.TimeOut}` : "—"}</div>
                        </div>
                        <span className="et-status-badge" style={statusStyle}>{rec.status}</span>
                      </div>

                      <div className="et-record-grid">
                        <div className="et-record-cell">
                          <span className="et-record-label">Time In</span>
                          <span className="et-mono">
                            {isMissed ? <span className="et-missed">Missed</span> : shift?.ActualTimeIn ? shift.ActualTimeIn : <span className="et-muted">—</span>}
                          </span>
                        </div>
                        <div className="et-record-cell">
                          <span className="et-record-label">Time Out</span>
                          <span className="et-mono">
                            {isMissed ? <span className="et-missed">Missed</span> : shift?.ActualTimeOut ? shift.ActualTimeOut : <span className="et-muted">—</span>}
                          </span>
                        </div>
                        <div className="et-record-cell">
                          <span className="et-record-label">Hours</span>
                          <span style={{ fontWeight: (rec.TotalWorkingHours ?? 0) > 0 ? 600 : 400, color: "var(--color-text)" }}>
                            {formatHours(rec.TotalWorkingHours)}
                          </span>
                        </div>
                        <div className="et-record-cell">
                          <span className="et-record-label">Deduction</span>
                          <span style={{ color: (rec.TimeDeduction ?? 0) > 0 ? "#dc2626" : "var(--color-text-muted)", fontWeight: (rec.TimeDeduction ?? 0) > 0 ? 700 : 400 }}>
                            {(rec.TimeDeduction ?? 0) > 0 ? `−${formatMinutes(rec.TimeDeduction)}` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="et-record-chevron">{isExpanded ? "▴ Hide details" : "▾ View details"}</div>

                      {isExpanded && (
                        <div className="et-record-detail">
                          <ShiftBreakdown rec={rec} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Total Hours Footer ── */}
            {records.length > 0 && (
              <div
                className="et-total-bar"
                onClick={() => { if (allowSelfPayslip) setShowPayslip(true); }}
                style={{ cursor: allowSelfPayslip ? "pointer" : "default" }}
                title={allowSelfPayslip ? "Click to view payslip" : "Payslip generation has been disabled by your administrator"}
              >
                <div className="et-total-left">
                  <div className="et-total-label">Total working hours</div>
                  <div className="et-total-sub">{dateFrom} → {dateTo} · {totalDays} day{totalDays !== 1 ? "s" : ""}</div>
                </div>
                <div className="et-total-right">
                  <div className="et-total-right-text">
                    <div className="et-total-value">{formatHours(totalHours)}</div>
                    <div className="et-total-sub">{presentDays} present · {absentDays} absent · {formatMinutes(totalDeduction)} deducted</div>
                  </div>
                  {!allowSelfPayslip && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>Disabled</span>
                  )}
                  <div className="et-total-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </>
      </div>

      {showPayslip && employeeID && companyCode && (
        <Payslip
          employeeID={employeeID}
          companyCode={companyCode}
          dateFrom={dateFrom}
          dateTo={dateTo}
          totalWorkingHours={totalHours}
          totalDeductionMinutes={totalDeduction}
          onClose={() => setShowPayslip(false)}
        />
      )}

      {forcePasswordChange && (
        <div className="pc-overlay">
          <div className="pc-modal">
            <div className="pc-modal-band" />
            <div className="pc-modal-body">
              <div className="pc-title">Set a new password</div>
              <div className="pc-subtitle">This is your first time logging in. Please set a new password before continuing.</div>

              {passwordMsg && <div className="pc-alert">{passwordMsg}</div>}

              <form className="pc-form" onSubmit={handlePasswordChange} noValidate>
                <div className="pc-field">
                  <label className="pc-label" htmlFor="new-password">New password</label>
                  <input id="new-password" type="password"
                    className={`form-input${passwordErrors.newPassword ? " is-error" : ""}`}
                    placeholder="Min. 8 characters" value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPasswordErrors(p => ({ ...p, newPassword: undefined })); }}
                    autoComplete="new-password" autoFocus />
                  {passwordErrors.newPassword && <span className="pc-error">⚠ {passwordErrors.newPassword}</span>}
                </div>

                <div className="pc-field">
                  <label className="pc-label" htmlFor="confirm-new-password">Confirm new password</label>
                  <input id="confirm-new-password" type="password"
                    className={`form-input${passwordErrors.confirmNewPassword ? " is-error" : ""}`}
                    placeholder="Repeat your new password" value={confirmNewPassword}
                    onChange={e => { setConfirmNewPassword(e.target.value); setPasswordErrors(p => ({ ...p, confirmNewPassword: undefined })); }}
                    autoComplete="new-password" />
                  {passwordErrors.confirmNewPassword && <span className="pc-error">⚠ {passwordErrors.confirmNewPassword}</span>}
                </div>

                <button type="submit" className="pc-submit" disabled={passwordLoading}>
                  {passwordLoading ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}