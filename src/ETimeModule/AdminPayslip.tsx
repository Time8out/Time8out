import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import Payslip from "./Payslip";

interface Employee {
  FirstName: string;
  LastName: string;
  UserName: string;
  EmployeeID: string | null;
  UserType: string;
}

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

function roleLabel(userType: string): string {
  return userType === "Special" ? "Owner" : userType === "Privilege" ? "Admin" : "Employee";
}

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

export default function AdminPayslip() {
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayslip, setShowPayslip] = useState(false);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(fmt(firstOfMonth));
  const [dateTo, setDateTo] = useState(fmt(today));

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setBootstrapError("No session found."); setEmployeesLoading(false); return; }
      const decoded = atob(raw);
      const email = decoded.split(":")[1];
      const { data: userData, error: userErr } = await supabase
        .from("users").select("CompanyCode").eq("Email", email).single();
      if (userErr || !userData) { setBootstrapError("Could not load user."); setEmployeesLoading(false); return; }
      setCompanyCode(userData.CompanyCode);

      const { data: empData, error: empErr } = await supabase
        .from("users")
        .select("FirstName, LastName, UserName, EmployeeID, UserType")
        .eq("CompanyCode", userData.CompanyCode)
        .order("FirstName", { ascending: true });
      if (empErr) { setBootstrapError("Could not load employees."); setEmployeesLoading(false); return; }
      setEmployees((empData ?? []).filter(e => e.EmployeeID?.trim()));
      setEmployeesLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchAttendance() {
    if (!selectedEmployee?.EmployeeID) return;
    if (!dateFrom || !dateTo) { setError("Please select a date range."); return; }
    if (dateFrom > dateTo) { setError("Start date must be before end date."); return; }
    setLoading(true); setError(null);
    const { data, error: e } = await supabase
      .from("Attendance")
      .select("*")
      .eq("EmployeeID", selectedEmployee.EmployeeID)
      .eq("CompanyCode", companyCode)
      .gte("AttendanceDate", dateFrom)
      .lte("AttendanceDate", dateTo)
      .order("AttendanceDate", { ascending: false });
    if (e) { setError(e.message); }
    else { setRecords(data ?? []); }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedEmployee) fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee]);

  function pickEmployee(emp: Employee) {
    setSelectedEmployee(emp);
    setRecords([]);
    setError(null);
    setShowPayslip(false);
  }

  function changeEmployee() {
    setSelectedEmployee(null);
    setRecords([]);
    setError(null);
    setShowPayslip(false);
    setSearch("");
  }

  const filteredEmployees = employees.filter(e => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${e.FirstName} ${e.LastName}`.toLowerCase().includes(q) ||
      e.EmployeeID?.toLowerCase().includes(q) ||
      e.UserName?.toLowerCase().includes(q)
    );
  });

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
        .ap-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .ap-header{margin-bottom:var(--space-6)}
        .ap-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .ap-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}

        /* Employee picker */
        .ap-picker{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-xs);margin-bottom:var(--space-5);overflow:hidden}
        .ap-picker-search{padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border)}
        .ap-picker-list{max-height:360px;overflow-y:auto}
        .ap-emp-row{display:flex;align-items:center;gap:var(--space-3);padding:12px var(--space-5);cursor:pointer;border-bottom:1px solid var(--color-border);transition:background var(--transition-fast)}
        .ap-emp-row:last-child{border-bottom:none}
        .ap-emp-row:hover{background:var(--brand-orange-light)}
        .ap-emp-avatar{width:32px;height:32px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0}
        .ap-emp-info{flex:1;min-width:0}
        .ap-emp-name{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text)}
        .ap-emp-sub{font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:1px}
        .ap-emp-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;background:var(--color-bg-alt);color:var(--color-text-muted);flex-shrink:0}
        .ap-picker-empty{padding:var(--space-8);text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)}

        /* Selected employee bar */
        .ap-selected-bar{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-xs);padding:var(--space-4) var(--space-5);display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-5)}
        .ap-selected-info{flex:1;min-width:0}

        /* Filter */
        .ap-filter{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);display:flex;align-items:flex-end;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-5);box-shadow:var(--shadow-xs)}
        .ap-filter-field{display:flex;flex-direction:column;gap:var(--space-2)}
        .ap-filter-label{font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em}
        .ap-filter-input{height:38px;width:160px}
        @media(max-width:480px){.ap-filter{flex-direction:column;align-items:stretch}.ap-filter-input{width:100%}}

        /* Stats */
        .ap-stats{display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap}
        .ap-stat{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);flex:1;min-width:80px;box-shadow:var(--shadow-xs)}
        .ap-stat-num{font-size:var(--font-size-xl);font-weight:700;line-height:1.2}
        .ap-stat-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}

        /* Table */
        .ap-table-wrap{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:auto;box-shadow:var(--shadow-sm);margin-bottom:var(--space-5)}
        .ap-table{width:100%;border-collapse:collapse;min-width:640px}
        .ap-table thead tr{border-bottom:2px solid var(--color-border)}
        .ap-table th{text-align:left;font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-muted);letter-spacing:.07em;text-transform:uppercase;padding:10px 14px;white-space:nowrap}
        .ap-table td{padding:12px 14px;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border);vertical-align:middle}
        .ap-table tbody tr:last-child td{border-bottom:none}
        .ap-status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
        .ap-mono{font-family:monospace;font-size:12px}
        .ap-missed{color:#dc2626;font-weight:700}
        .ap-muted{color:var(--color-text-faint)}

        /* Total hours footer */
        .ap-total-bar{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-5);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);box-shadow:var(--shadow-xs);transition:border-color .15s,box-shadow .15s;cursor:pointer}
        .ap-total-bar:hover{border-color:var(--color-border-secondary);box-shadow:var(--shadow-sm)}
        .ap-total-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-muted)}
        .ap-total-value{font-size:var(--font-size-xl);font-weight:700;color:var(--color-text)}
        .ap-total-sub{font-size:var(--font-size-xs);color:var(--color-text-muted)}
        .ap-total-left{min-width:0}
        .ap-total-left .ap-total-sub{margin-top:2px}
        .ap-total-right{display:flex;align-items:center;gap:var(--space-4);flex-shrink:0}
        .ap-total-right-text{text-align:right}
        .ap-total-right-text .ap-total-sub{margin-top:2px;white-space:nowrap}
        @media(max-width:560px){
          .ap-total-bar{flex-direction:column;align-items:stretch}
          .ap-total-right{width:100%;justify-content:space-between}
        }

        .ap-empty{padding:var(--space-12);text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)}
        .ap-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4);background:var(--color-danger-light);color:var(--color-danger)}
      `}</style>

      <div className="ap-page">
        <div className="ap-header">
          <h1 className="ap-title">Generate Payslip</h1>
          <p className="ap-sub">Select an employee and a date range to generate their payslip.</p>
        </div>

        {bootstrapError && <div className="ap-alert">{bootstrapError}</div>}

        {!selectedEmployee ? (
          <div className="ap-picker">
            <div className="ap-picker-search">
              <input
                className="form-input"
                placeholder="Search by name, employee ID, or username…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ap-picker-list">
              {employeesLoading ? (
                <div className="ap-picker-empty">Loading employees…</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="ap-picker-empty">No employees found.</div>
              ) : (
                filteredEmployees.map((emp, i) => (
                  <div key={i} className="ap-emp-row" onClick={() => pickEmployee(emp)}>
                    <div className="ap-emp-avatar">{emp.FirstName?.[0]}{emp.LastName?.[0]}</div>
                    <div className="ap-emp-info">
                      <div className="ap-emp-name">{emp.FirstName} {emp.LastName}</div>
                      <div className="ap-emp-sub">ID: {emp.EmployeeID} · @{emp.UserName}</div>
                    </div>
                    <span className="ap-emp-badge">{roleLabel(emp.UserType)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="ap-selected-bar">
              <div className="ap-emp-avatar">{selectedEmployee.FirstName?.[0]}{selectedEmployee.LastName?.[0]}</div>
              <div className="ap-selected-info">
                <div className="ap-emp-name">{selectedEmployee.FirstName} {selectedEmployee.LastName}</div>
                <div className="ap-emp-sub">ID: {selectedEmployee.EmployeeID} · @{selectedEmployee.UserName}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={changeEmployee}>Change employee</button>
            </div>

            <div className="ap-filter">
              <div className="ap-filter-field">
                <span className="ap-filter-label">From</span>
                <input
                  className="form-input ap-filter-input"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div className="ap-filter-field">
                <span className="ap-filter-label">To</span>
                <input
                  className="form-input ap-filter-input"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ height: 38, alignSelf: "flex-end" }}
                onClick={fetchAttendance}
                disabled={loading}
              >
                {loading ? "Loading…" : "Search"}
              </button>
            </div>

            {error && <div className="ap-alert">{error}</div>}

            <div className="ap-stats">
              {[
                { num: totalDays,                  label: "Total Days",   color: "var(--color-text)" },
                { num: presentDays,                label: "Present",      color: "#15803d" },
                { num: absentDays,                 label: "Absent",       color: "#dc2626" },
                { num: formatMinutes(totalDeduction), label: "Deductions", color: "#b45309" },
                { num: formatHours(totalHours),    label: "Total Hours",  color: "var(--brand-blue)" },
              ].map(({ num, label, color }) => (
                <div key={label} className="ap-stat">
                  <div className="ap-stat-num" style={{ color }}>{num}</div>
                  <div className="ap-stat-label">{label}</div>
                </div>
              ))}
            </div>

            <div className="ap-table-wrap">
              {records.length === 0 ? (
                <div className="ap-empty">No attendance records found for the selected date range.</div>
              ) : (
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shift</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Hours</th>
                      <th>Deduction</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(rec => {
                      const shift = rec.ScheduleTimeAndAttendance?.[0];
                      const statusStyle = getStatusStyle(rec.status);
                      const isMissed = shift?.ActualTimeIn === "MISSED";
                      return (
                        <tr key={rec.id}>
                          <td style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            {new Date(rec.AttendanceDate + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="ap-mono">{shift ? `${shift.timeIn} – ${shift.TimeOut}` : "—"}</td>
                          <td className="ap-mono">
                            {isMissed ? <span className="ap-missed">Missed</span> : shift?.ActualTimeIn ? shift.ActualTimeIn : <span className="ap-muted">—</span>}
                          </td>
                          <td className="ap-mono">
                            {isMissed ? <span className="ap-missed">Missed</span> : shift?.ActualTimeOut ? shift.ActualTimeOut : <span className="ap-muted">—</span>}
                          </td>
                          <td style={{ fontWeight: (rec.TotalWorkingHours ?? 0) > 0 ? 600 : 400, color: "var(--color-text)" }}>
                            {formatHours(rec.TotalWorkingHours)}
                          </td>
                          <td style={{ color: (rec.TimeDeduction ?? 0) > 0 ? "#dc2626" : "var(--color-text-muted)", fontWeight: (rec.TimeDeduction ?? 0) > 0 ? 700 : 400 }}>
                            {(rec.TimeDeduction ?? 0) > 0 ? `−${formatMinutes(rec.TimeDeduction)}` : "—"}
                          </td>
                          <td><span className="ap-status-badge" style={statusStyle}>{rec.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {records.length > 0 && (
              <div className="ap-total-bar" onClick={() => setShowPayslip(true)} title="Click to generate payslip">
                <div className="ap-total-left">
                  <div className="ap-total-label">Total working hours</div>
                  <div className="ap-total-sub">{dateFrom} → {dateTo} · {totalDays} day{totalDays !== 1 ? "s" : ""}</div>
                </div>
                <div className="ap-total-right">
                  <div className="ap-total-right-text">
                    <div className="ap-total-value">{formatHours(totalHours)}</div>
                    <div className="ap-total-sub">{presentDays} present · {absentDays} absent · {formatMinutes(totalDeduction)} deducted</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setShowPayslip(true); }}>Generate Payslip</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showPayslip && selectedEmployee?.EmployeeID && companyCode && (
        <Payslip
          employeeID={selectedEmployee.EmployeeID}
          companyCode={companyCode}
          dateFrom={dateFrom}
          dateTo={dateTo}
          totalWorkingHours={totalHours}
          totalDeductionMinutes={totalDeduction}
          onClose={() => setShowPayslip(false)}
        />
      )}
    </>
  );
}
