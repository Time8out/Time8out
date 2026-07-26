import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase";

interface AttendanceRow {
  id: number;
  EmployeeID: string;
  AttendanceDate: string;
  ScheduleTimeAndAttendance: any;
  StampsFeedback: any;
  TimeDeduction: number | null;
  TotalWorkingHours: number | null;
  NightShiftDifferential: number | null;
  Regular: number | null;
  Holiday: number | null;
  Overtime: number | null;
  ScheduleType: string | null;
  status: string | null;
}

interface AttendanceLog {
  id: string;
  AttendanceID: number;
  EmployeeID: string;
  AttendanceDate: string;
  EditedBy: string;
  EditedByName: string;
  Action: string;
  CreatedAt: string;
}

interface Employee {
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  Email: string;
}

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTs(ts: string) {
  return new Date(ts).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Finished: { bg: "rgba(22,163,74,0.08)", color: "#15803d", border: "rgba(22,163,74,0.25)" },
  Ongoing:  { bg: "rgba(14,165,233,0.08)", color: "#0369a1", border: "rgba(14,165,233,0.25)" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}


export default function AttendanceControl() {
  const [adminID, setAdminID] = useState("");
  const [adminName, setAdminName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchEmployee, setSearchEmployee] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searching, setSearching] = useState(false);

  // Edit modal
  const [editRow, setEditRow] = useState<AttendanceRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Snapshots of the ORIGINAL clock stamps / feedback, taken when the modal
  // opens, so we can tell whether the admin actually touched them (vs. only
  // editing Regular/Holiday/Overtime directly, which is already a manual override).
  const [origScheduleJSON, setOrigScheduleJSON] = useState("");
  const [origFeedbackJSON, setOrigFeedbackJSON] = useState("");

  // Shown as a SEPARATE popup on top of the edit modal, triggered when
  // Save Changes is clicked and clock stamps/feedback were touched.
  // Nothing is written to the database until the admin picks an option here.
  const [showPreSaveConfirm, setShowPreSaveConfirm] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  // Results
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [searched, setSearched] = useState(false);

  // Logs
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const LOG_PAGE_SIZE = 10;

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users")
        .select("EmployeeID, FirstName, LastName, CompanyCode")
        .eq("Email", email).single();
      if (!user) { setError("Could not load user."); setLoading(false); return; }
      setAdminID(user.EmployeeID ?? email);
      setAdminName(`${user.FirstName} ${user.LastName}`);
      setCompanyCode(user.CompanyCode);

      const { data: empList } = await supabase.from("users")
        .select("EmployeeID, FirstName, LastName, Email")
        .eq("CompanyCode", user.CompanyCode)
        .order("FirstName");
      setEmployees(empList ?? []);

      await fetchLogs(user.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchLogs(code: string) {
    setLogsLoading(true);
    const { data } = await supabase.from("AttendanceLogs")
      .select("*").eq("CompanyCode", code)
      .order("CreatedAt", { ascending: false }).limit(100);
    setLogs((data ?? []) as AttendanceLog[]);
    setLogsLoading(false);
  }

  async function handleSearch() {
    if (!companyCode) { return; }
    setSearching(true); setRecords([]); setSearched(false);

    let query = supabase.from("Attendance")
      .select("id, EmployeeID, AttendanceDate, ScheduleTimeAndAttendance, StampsFeedback, TimeDeduction, TotalWorkingHours, NightShiftDifferential, Regular, Holiday, Overtime, ScheduleType, status")
      .eq("CompanyCode", companyCode)
      .order("AttendanceDate", { ascending: false });

    if (searchEmployee) query = query.eq("EmployeeID", searchEmployee);
    if (searchDate) query = query.eq("AttendanceDate", searchDate);

    const { data } = await query.limit(50);
    setRecords((data ?? []) as AttendanceRow[]);
    setSearched(true);
    setSearching(false);
  }

  function openEdit(row: AttendanceRow) {
    setEditRow(row);
    setEditMsg(null);
    setShowPreSaveConfirm(false);
    setRecomputing(false);
    const schedule = Array.isArray(row.ScheduleTimeAndAttendance)
      ? row.ScheduleTimeAndAttendance
      : (typeof row.ScheduleTimeAndAttendance === "string" ? JSON.parse(row.ScheduleTimeAndAttendance) : []);
    const feedback = Array.isArray(row.StampsFeedback)
      ? row.StampsFeedback
      : (typeof row.StampsFeedback === "string" ? JSON.parse(row.StampsFeedback) : []);
    setEditValues({
      AttendanceDate: row.AttendanceDate,
      TimeDeduction: row.TimeDeduction ?? "",
      TotalWorkingHours: row.TotalWorkingHours ?? "",
      NightShiftDifferential: row.NightShiftDifferential ?? "",
      Regular: row.Regular ?? "",
      Holiday: row.Holiday ?? "",
      Overtime: row.Overtime ?? "",
      ScheduleType: row.ScheduleType ?? "",
      status: row.status ?? "",
      ScheduleTimeAndAttendance: schedule,
      StampsFeedback: feedback,
    });
    setOrigScheduleJSON(JSON.stringify(schedule));
    setOrigFeedbackJSON(JSON.stringify(feedback));
  }

  function handleSaveClick() {
    const scheduleChanged = JSON.stringify(editValues.ScheduleTimeAndAttendance) !== origScheduleJSON;
    const feedbackChanged = JSON.stringify(editValues.StampsFeedback) !== origFeedbackJSON;

    if (scheduleChanged || feedbackChanged) {
      // Clock stamps or feedback changed — don't save yet, ask first.
      setShowPreSaveConfirm(true);
      return;
    }

    performSave(false);
  }

  async function performSave(recomputeAfter: boolean) {
    if (!editRow) return;
    setSaving(true); setEditMsg(null);

    const payload: Record<string, any> = {
      AttendanceDate: editValues.AttendanceDate,
      TimeDeduction: editValues.TimeDeduction === "" ? null : Number(editValues.TimeDeduction),
      TotalWorkingHours: editValues.TotalWorkingHours === "" ? null : Number(editValues.TotalWorkingHours),
      NightShiftDifferential: editValues.NightShiftDifferential === "" ? null : Number(editValues.NightShiftDifferential),
      Regular: editValues.Regular === "" ? null : Number(editValues.Regular),
      Holiday: editValues.Holiday === "" ? null : Number(editValues.Holiday),
      Overtime: editValues.Overtime === "" ? null : Number(editValues.Overtime),
      ScheduleType: editValues.ScheduleType || null,
      status: editValues.status || null,
      ScheduleTimeAndAttendance: editValues.ScheduleTimeAndAttendance,
      StampsFeedback: editValues.StampsFeedback,
    };

    const { error: e } = await supabase.from("Attendance").update(payload).eq("id", editRow.id);

    if (e) {
      setEditMsg({ type: "error", text: e.message });
      setSaving(false);
      return;
    }

    await supabase.from("AttendanceLogs").insert([{
      AttendanceID: editRow.id,
      EmployeeID: editRow.EmployeeID,
      CompanyCode: companyCode,
      AttendanceDate: editValues.AttendanceDate,
      EditedBy: adminID,
      EditedByName: adminName,
      Action: "Edited attendance record",
    }]);

    if (recomputeAfter) {
      setRecomputing(true);
      // Runs the same SQL function the cron job uses, so recomputed pay
      // (Regular/Holiday, Overtime, NightShiftDifferential, Expected*,
      // StampsFeedback deductionAmount enrichment) matches production exactly.
      const { error: rpcError } = await supabase.rpc("compute_attendance_pay", {
        p_employee_id: editRow.EmployeeID,
        p_company_code: companyCode,
        p_attendance_date: editValues.AttendanceDate,
      });
      setRecomputing(false);

      if (rpcError) {
        setSaving(false);
        setEditMsg({ type: "error", text: `Attendance saved, but recompute failed: ${rpcError.message}` });
        return;
      }

      await supabase.from("AttendanceLogs").insert([{
        AttendanceID: editRow.id,
        EmployeeID: editRow.EmployeeID,
        CompanyCode: companyCode,
        AttendanceDate: editValues.AttendanceDate,
        EditedBy: adminID,
        EditedByName: adminName,
        Action: "Recomputed pay after stamp/feedback edit",
      }]);

      setEditMsg({ type: "success", text: "Attendance updated and pay recomputed." });
    } else {
      setEditMsg({ type: "success", text: "Attendance updated successfully." });
    }

    setSaving(false);
    setShowPreSaveConfirm(false);
    await handleSearch();
    await fetchLogs(companyCode);
    setTimeout(() => { setEditRow(null); setEditMsg(null); }, 1200);
  }

  const empMap = Object.fromEntries(employees.map(e => [e.EmployeeID, `${e.FirstName} ${e.LastName}`]));
  const pagedLogs = logs.slice(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE);
  const totalLogPages = Math.ceil(logs.length / LOG_PAGE_SIZE);

  if (loading) return (
    <div style={s.page}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  );
  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;

  return (
    <>
      <style>{`
        .ac-page{padding:clamp(var(--space-4),3vw,var(--space-8));font-family:var(--font-base);width:100%;;margin:0 auto;box-sizing:border-box}

        /* ── Header ── */
        .ac-header{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-6)}
        .ac-kicker{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .ac-kicker-dot{width:8px;height:8px;border-radius:50%;background:var(--gradient-brand);flex-shrink:0}
        .ac-kicker-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted)}
        .ac-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px;line-height:1.2}
        @media(max-width:480px){.ac-title{font-size:var(--font-size-xl)}}
        .ac-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}
        .ac-header-stats{display:flex;gap:var(--space-3);flex-wrap:wrap}
        .ac-mini-stat{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:10px 16px;box-shadow:var(--shadow-xs);text-align:center;min-width:84px}
        .ac-mini-stat-num{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);line-height:1.1}
        .ac-mini-stat-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}

        /* ── Search card ── */
        .ac-search-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-6);box-shadow:var(--shadow-xs)}
        .ac-search-title{display:flex;align-items:center;gap:8px;font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}
        .ac-search-row{display:grid;grid-template-columns:1fr 1fr auto;gap:var(--space-3);align-items:end}
        @media(max-width:640px){.ac-search-row{grid-template-columns:1fr}.ac-search-row .btn{justify-self:start}}
        .ac-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}

        /* ── Results table (desktop) ── */
        .ac-table-wrap{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:auto;margin-bottom:var(--space-6);box-shadow:var(--shadow-xs)}
        @media(max-width:760px){.ac-table-wrap{display:none}}
        .ac-table{width:100%;border-collapse:collapse;min-width:960px}
        .ac-table thead tr{border-bottom:2px solid var(--color-border);background:var(--color-bg-alt)}
        .ac-table th{text-align:left;font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.07em;text-transform:uppercase;padding:10px 14px;white-space:nowrap}
        .ac-table td{padding:11px 14px;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border);vertical-align:middle;white-space:nowrap}
        .ac-table tbody tr:last-child td{border-bottom:none}
        .ac-table tbody tr{transition:background .12s;cursor:pointer}
        .ac-table tbody tr:hover{background:var(--brand-orange-light)}
        .ac-emp-cell{display:flex;align-items:center;gap:10px}
        .ac-avatar{width:28px;height:28px;border-radius:50%;background:var(--gradient-brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
        .ac-status-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
        .ac-edit-btn{padding:4px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap}
        .ac-edit-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange);background:var(--brand-orange-light)}
        .ac-empty{padding:var(--space-8);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}

        /* ── Results cards (mobile fallback) ── */
        .ac-card-list{display:none;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-6)}
        @media(max-width:760px){.ac-card-list{display:flex}}
        .ac-record-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);box-shadow:var(--shadow-xs);cursor:pointer;transition:box-shadow .12s,border-color .12s}
        .ac-record-card:active{box-shadow:none}
        .ac-record-card-top{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3)}
        .ac-record-card-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .ac-record-card-date{font-size:11px;color:var(--color-text-muted)}
        .ac-record-card-pay{display:flex;gap:var(--space-4);flex-wrap:wrap;font-size:12px}
        .ac-record-card-pay div{display:flex;flex-direction:column;gap:2px}
        .ac-record-card-pay span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-faint)}
        .ac-record-card-pay strong{font-family:monospace;font-size:13px}

        /* ── Edit modal overlay ── */
        .ac-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:400;padding:24px;animation:acFade .15s ease}
        @media(max-width:640px){.ac-overlay{padding:0}}
        @keyframes acFade{from{opacity:0}to{opacity:1}}

        /* ── Edit modal — wider, sticky footer, full-screen sheet on mobile ── */
        .ac-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:960px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;animation:acUp .2s cubic-bezier(.22,1,.36,1)}
        @media(max-width:640px){
          .ac-modal{max-width:100%;width:100%;height:100dvh;max-height:100dvh;border-radius:0}
        }
        @keyframes acUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .ac-modal-band{height:4px;background:var(--gradient-brand);flex-shrink:0}
        .ac-modal-scroll{overflow-y:auto;flex:1;min-height:0}
        .ac-modal-body{padding:var(--space-6)}
        @media(max-width:480px){.ac-modal-body{padding:var(--space-4)}}
        .ac-modal-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:2px;letter-spacing:-.01em}
        .ac-modal-sub{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-5)}
        .ac-field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-4);margin-bottom:var(--space-4)}
        .ac-field{display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-4)}
        .ac-section-label{display:flex;align-items:center;gap:var(--space-3);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-muted);margin:var(--space-2) 0 var(--space-3)}
        .ac-section-label::after{content:'';flex:1;height:1px;background:var(--color-border)}
        .ac-divider{height:1px;background:var(--color-border);margin:var(--space-5) 0}

        /* ── Sticky modal footer ── */
        .ac-modal-footer-wrap{flex-shrink:0;border-top:1px solid var(--color-border);background:var(--color-white);padding:var(--space-4) var(--space-6)}
        @media(max-width:480px){.ac-modal-footer-wrap{padding:var(--space-3) var(--space-4)}}
        .ac-modal-footer{display:flex;justify-content:flex-end;gap:var(--space-3);flex-wrap:wrap}
        .ac-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .ac-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .ac-alert.success{background:var(--color-success-light);color:var(--color-success)}

        /* ── Pre-save confirm popup ── */
        .ac-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:500;padding:16px;animation:acFade .15s ease}
        .ac-confirm-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:440px;max-height:90vh;overflow-y:auto;padding:var(--space-6);animation:acUp .18s cubic-bezier(.22,1,.36,1);border-top:4px solid #2563eb}
        .ac-confirm-icon{font-size:26px;margin-bottom:var(--space-3)}
        .ac-confirm-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:var(--space-2);letter-spacing:-.01em}
        .ac-confirm-text{font-size:var(--font-size-sm);color:var(--color-text-secondary);line-height:1.6;margin-bottom:var(--space-4)}
        .ac-confirm-option{font-size:var(--font-size-xs);color:var(--color-text-muted);line-height:1.6;padding:var(--space-3);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:var(--space-2)}
        .ac-confirm-option strong{color:var(--color-text)}
        .ac-confirm-btns{display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-4)}
        .ac-confirm-btns .btn{width:100%;justify-content:center}

        /* ── Edit logs ── */
        .ac-log-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .ac-log-title{font-size:var(--font-size-base);font-weight:700;color:var(--color-text)}
        .ac-log-count{font-size:11px;font-weight:700;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:1px 8px;color:var(--color-text-muted)}
        .ac-log-table-wrap{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-xs)}
        .ac-log-table-wrap{overflow-x:auto}
        .ac-log-table{width:100%;border-collapse:collapse;min-width:560px}
        .ac-log-table thead tr{border-bottom:2px solid var(--color-border);background:var(--color-bg-alt)}
        .ac-log-table th{text-align:left;font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.07em;text-transform:uppercase;padding:9px 14px;white-space:nowrap}
        .ac-log-table td{padding:10px 14px;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border);vertical-align:middle}
        .ac-log-table tbody tr:last-child td{border-bottom:none}
        .ac-log-table tbody tr:hover{background:var(--color-bg)}
        .ac-log-empty{padding:var(--space-6);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .ac-log-pagination{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);border-top:1px solid var(--color-border);font-size:var(--font-size-xs);color:var(--color-text-muted);flex-wrap:wrap;gap:8px}
        .ac-log-page-btns{display:flex;gap:var(--space-2)}
        .ac-log-page-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-base);color:var(--color-text-muted);transition:all .15s}
        .ac-log-page-btn:hover:not(:disabled){border-color:var(--brand-orange);color:var(--brand-orange)}
        .ac-log-page-btn:disabled{opacity:.4;cursor:not-allowed}
      `}</style>

      <div className="ac-page">
        <div className="ac-header">
          <div>
            <div className="ac-kicker">
              <span className="ac-kicker-dot" />
              <span className="ac-kicker-label">Admin Tools</span>
            </div>
            <h1 className="ac-title">Attendance Control</h1>
            <p className="ac-sub">Search, view and override any employee attendance record.</p>
          </div>
          <div className="ac-header-stats">
            <div className="ac-mini-stat">
              <div className="ac-mini-stat-num">{employees.length}</div>
              <div className="ac-mini-stat-label">Employees</div>
            </div>
            <div className="ac-mini-stat">
              <div className="ac-mini-stat-num">{logs.length}</div>
              <div className="ac-mini-stat-label">Edit Logs</div>
            </div>
          </div>
        </div>

        <div className="ac-search-card">
          <div className="ac-search-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search Attendance
          </div>
          <div className="ac-search-row">
            <div>
              <label className="ac-label">Employee</label>
              <select className="form-select" value={searchEmployee}
                onChange={e => setSearchEmployee(e.target.value)}>
                <option value="">All employees</option>
                {employees.map(e => (
                  <option key={e.EmployeeID} value={e.EmployeeID}>
                    {e.FirstName} {e.LastName} — {e.EmployeeID}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ac-label">Date</label>
              <input className="form-input" type="date" value={searchDate}
                onChange={e => setSearchDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleSearch}
              disabled={searching || !companyCode}>
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {searched && (
          <div className="ac-table-wrap" style={{ marginBottom: "var(--space-6)" }}>
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Schedule Type</th>
                  <th>Deduction (mins)</th>
                  <th>Working Hours</th>
                  <th>Night Diff</th>
                  <th style={{ color: "#7c3aed" }}>Regular Pay ⚙</th>
                  <th style={{ color: "#dc2626" }}>Holiday Pay ⚙</th>
                  <th style={{ color: "#0891b2" }}>Overtime ⚙</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={11} className="ac-empty">No records found.</td></tr>
                ) : records.map(row => {
                  const st = STATUS_STYLE[row.status ?? ""] ?? { bg: "var(--color-bg-alt)", color: "var(--color-text-faint)", border: "var(--color-border)" };
                  return (
                    <tr key={row.id} onClick={() => openEdit(row)}>
                      <td style={{ fontWeight: 600, color: "var(--color-text)" }}>
                        <div className="ac-emp-cell">
                          <div className="ac-avatar">{initials(empMap[row.EmployeeID] ?? row.EmployeeID)}</div>
                          <div>
                            {empMap[row.EmployeeID] ?? row.EmployeeID}
                            <div style={{ fontSize: 10, color: "var(--color-text-faint)", fontWeight: 400 }}>{row.EmployeeID}</div>
                          </div>
                        </div>
                      </td>
                      <td>{fmt(row.AttendanceDate)}</td>
                      <td>{row.ScheduleType ?? <span style={{ color: "var(--color-text-faint)" }}>—</span>}</td>
                      <td>{row.TimeDeduction ?? <span style={{ color: "var(--color-text-faint)" }}>—</span>}</td>
                      <td>{row.TotalWorkingHours != null ? `${row.TotalWorkingHours}h` : <span style={{ color: "var(--color-text-faint)" }}>—</span>}</td>
                      <td>{row.NightShiftDifferential ?? <span style={{ color: "var(--color-text-faint)" }}>—</span>}</td>
                      <td>
                        {row.Regular != null
                          ? <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#7c3aed" }}>{row.Regular.toLocaleString()}</span>
                          : <span style={{ color: "var(--color-text-faint)" }}>—</span>}
                      </td>
                      <td>
                        {row.Holiday != null
                          ? <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{row.Holiday.toLocaleString()}</span>
                          : <span style={{ color: "var(--color-text-faint)" }}>—</span>}
                      </td>
                      <td>
                        {row.Overtime != null
                          ? <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0891b2" }}>{row.Overtime.toLocaleString()}</span>
                          : <span style={{ color: "var(--color-text-faint)" }}>—</span>}
                      </td>
                      <td>
                        <span className="ac-status-badge"
                          style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                          {row.status ?? "—"}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="ac-edit-btn" onClick={() => openEdit(row)}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {searched && (
          <div className="ac-card-list">
            {records.length === 0 ? (
              <div className="ac-empty">No records found.</div>
            ) : records.map(row => {
              const st = STATUS_STYLE[row.status ?? ""] ?? { bg: "var(--color-bg-alt)", color: "var(--color-text-faint)", border: "var(--color-border)" };
              const name = empMap[row.EmployeeID] ?? row.EmployeeID;
              return (
                <div key={row.id} className="ac-record-card" onClick={() => openEdit(row)}>
                  <div className="ac-record-card-top">
                    <div className="ac-emp-cell">
                      <div className="ac-avatar">{initials(name)}</div>
                      <div>
                        <div className="ac-record-card-name">{name}</div>
                        <div className="ac-record-card-date">{fmt(row.AttendanceDate)} · {row.EmployeeID}</div>
                      </div>
                    </div>
                    <span className="ac-status-badge" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                      {row.status ?? "—"}
                    </span>
                  </div>
                  <div className="ac-record-card-pay">
                    <div><span>Regular</span><strong style={{ color: "#7c3aed" }}>{row.Regular != null ? row.Regular.toLocaleString() : "—"}</strong></div>
                    <div><span>Holiday</span><strong style={{ color: "#dc2626" }}>{row.Holiday != null ? row.Holiday.toLocaleString() : "—"}</strong></div>
                    <div><span>Overtime</span><strong style={{ color: "#0891b2" }}>{row.Overtime != null ? row.Overtime.toLocaleString() : "—"}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="ac-log-header">
          <span className="ac-log-title">Edit Logs</span>
          <span className="ac-log-count">{logs.length}</span>
        </div>
        <div className="ac-log-table-wrap">
          {logsLoading ? (
            <div className="ac-log-empty">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="ac-log-empty">No edits logged yet.</div>
          ) : (
            <>
              <table className="ac-log-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Attendance Date</th>
                    <th>Action</th>
                    <th>Edited By</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600, color: "var(--color-text)" }}>
                        {empMap[log.EmployeeID] ?? log.EmployeeID}
                        <div style={{ fontSize: 10, color: "var(--color-text-faint)", fontWeight: 400 }}>{log.EmployeeID}</div>
                      </td>
                      <td>{fmt(log.AttendanceDate)}</td>
                      <td>{log.Action}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{log.EditedByName}</span>
                        <div style={{ fontSize: 10, color: "var(--color-text-faint)" }}>{log.EditedBy}</div>
                      </td>
                      <td style={{ color: "var(--color-text-faint)", fontSize: 12 }}>{fmtTs(log.CreatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalLogPages > 1 && (
                <div className="ac-log-pagination">
                  <span>Showing {logPage * LOG_PAGE_SIZE + 1}–{Math.min((logPage + 1) * LOG_PAGE_SIZE, logs.length)} of {logs.length}</span>
                  <div className="ac-log-page-btns">
                    <button className="ac-log-page-btn" disabled={logPage === 0}
                      onClick={() => setLogPage(p => p - 1)}>← Prev</button>
                    <button className="ac-log-page-btn" disabled={logPage >= totalLogPages - 1}
                      onClick={() => setLogPage(p => p + 1)}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editRow && (
        <div className="ac-overlay" onClick={e => { if (e.target === e.currentTarget && !showPreSaveConfirm) setEditRow(null); }}>
          <div className="ac-modal">
            <div className="ac-modal-band" />
            <div className="ac-modal-scroll">
            <div className="ac-modal-body">
              <div className="ac-modal-title">Edit Attendance Record</div>
              <div className="ac-modal-sub">
                {empMap[editRow.EmployeeID] ?? editRow.EmployeeID} · {fmt(editRow.AttendanceDate)}
              </div>

              <div style={{ background: "rgba(220,38,38,0.06)", border: "1.5px solid rgba(220,38,38,0.3)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", marginBottom: "var(--space-5)", display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                    Admin Override — Proceed with Caution
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "#991b1b", lineHeight: 1.6 }}>
                    You are directly editing an attendance record. Changes made here will <strong>override the system-computed values</strong> and will be logged under your account. Editing salary computation fields (Regular Pay, Holiday Pay, Overtime, Night Shift Differential) may affect payroll. Make sure all changes are intentional and verified.
                  </div>
                </div>
              </div>
              <div className="ac-field-grid">
                <div className="ac-field">
                  <label className="ac-label">Attendance Date</label>
                  <input className="form-input" type="date" value={editValues.AttendanceDate}
                    onChange={e => setEditValues(p => ({ ...p, AttendanceDate: e.target.value }))} />
                </div>
                <div className="ac-field">
                  <label className="ac-label">Status</label>
                  <select className="form-select" value={editValues.status}
                    onChange={e => setEditValues(p => ({ ...p, status: e.target.value }))}>
                    <option value="">— Not set —</option>
                    <option value="Finished">Finished</option>
                    <option value="Ongoing">Ongoing</option>
                  </select>
                </div>
                <div className="ac-field">
                  <label className="ac-label">Time Deduction (mins)</label>
                  <input className="form-input" type="number" value={editValues.TimeDeduction}
                    onChange={e => setEditValues(p => ({ ...p, TimeDeduction: e.target.value }))} />
                </div>
                <div className="ac-field">
                  <label className="ac-label">Total Working Hours</label>
                  <input className="form-input" type="number" step="0.01" value={editValues.TotalWorkingHours}
                    onChange={e => setEditValues(p => ({ ...p, TotalWorkingHours: e.target.value }))} />
                </div>
                <div className="ac-field">
                  <label className="ac-label">Night Shift Differential</label>
                  <input className="form-input" type="number" step="0.01" value={editValues.NightShiftDifferential}
                    onChange={e => setEditValues(p => ({ ...p, NightShiftDifferential: e.target.value }))} />
                </div>
                <div className="ac-field"></div>
                <div className="ac-field">
                  <label className="ac-label">Schedule Type</label>
                  <input className="form-input" value={editValues.ScheduleType}
                    onChange={e => setEditValues(p => ({ ...p, ScheduleType: e.target.value }))}
                    placeholder="e.g. Regular,RegularHoliday" />
                </div>
              </div>

              <div className="ac-field-grid">
                <div className="ac-field">
                  <label className="ac-label">Regular</label>
                  <input className="form-input" type="number" step="0.01" value={editValues.Regular}
                    onChange={e => setEditValues(p => ({ ...p, Regular: e.target.value }))} />
                </div>
                <div className="ac-field">
                  <label className="ac-label">Holiday</label>
                  <input className="form-input" type="number" step="0.01" value={editValues.Holiday}
                    onChange={e => setEditValues(p => ({ ...p, Holiday: e.target.value }))} />
                </div>
                <div className="ac-field">
                  <label className="ac-label">Overtime</label>
                  <input className="form-input" type="number" step="0.01" value={editValues.Overtime}
                    onChange={e => setEditValues(p => ({ ...p, Overtime: e.target.value }))} />
                </div>
              </div>

              <div className="ac-divider" />

              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                  <label className="ac-label" style={{ marginBottom: 0 }}>Schedule Time & Attendance</label>
                </div>
                {(editValues.ScheduleTimeAndAttendance as any[]).map((shift: any, si: number) => (
                  <div key={si} style={{ background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", marginBottom: "var(--space-3)" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--brand-orange)", marginBottom: "var(--space-3)" }}>
                      Shift {si + 1}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                      <div>
                        <label className="ac-label">Scheduled Time In</label>
                        <input className="form-input" type="time" value={shift.timeIn ?? ""}
                          onChange={e => {
                            const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                            s[si] = { ...s[si], timeIn: e.target.value };
                            setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                          }} />
                      </div>
                      <div>
                        <label className="ac-label">Scheduled Time Out</label>
                        <input className="form-input" type="time" value={shift.TimeOut ?? ""}
                          onChange={e => {
                            const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                            s[si] = { ...s[si], TimeOut: e.target.value };
                            setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                          }} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                      <div>
                        <label className="ac-label" style={{ color: "var(--color-success)" }}>Actual Time In</label>
                        <input className="form-input" type="time" value={shift.ActualTimeIn ?? ""}
                          onChange={e => {
                            const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                            s[si] = { ...s[si], ActualTimeIn: e.target.value };
                            setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                          }} />
                      </div>
                      <div>
                        <label className="ac-label" style={{ color: "var(--color-success)" }}>Actual Time Out</label>
                        <input className="form-input" type="time" value={shift.ActualTimeOut ?? ""}
                          onChange={e => {
                            const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                            s[si] = { ...s[si], ActualTimeOut: e.target.value };
                            setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                          }} />
                      </div>
                    </div>
                    {(shift.breaks ?? []).length > 0 && (
                      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)", marginTop: "var(--space-2)" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>Breaks</div>
                        {(shift.breaks as any[]).map((brk: any, bi: number) => (
                          <div key={bi} style={{ background: "var(--color-white)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-2)" }}>
                            <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginBottom: "var(--space-2)" }}>Break {bi + 1}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                              <div>
                                <label className="ac-label" style={{ fontSize: 10 }}>Break In</label>
                                <input className="form-input" type="time" value={brk.breakIn ?? ""}
                                  onChange={e => {
                                    const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                                    s[si].breaks[bi] = { ...s[si].breaks[bi], breakIn: e.target.value };
                                    setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                                  }} />
                              </div>
                              <div>
                                <label className="ac-label" style={{ fontSize: 10 }}>Break Out</label>
                                <input className="form-input" type="time" value={brk.breakOut ?? ""}
                                  onChange={e => {
                                    const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                                    s[si].breaks[bi] = { ...s[si].breaks[bi], breakOut: e.target.value };
                                    setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                                  }} />
                              </div>
                              <div>
                                <label className="ac-label" style={{ fontSize: 10, color: "var(--color-success)" }}>Actual Break In</label>
                                <input className="form-input" type="time" value={brk.ActualBreakIn ?? ""}
                                  onChange={e => {
                                    const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                                    s[si].breaks[bi] = { ...s[si].breaks[bi], ActualBreakIn: e.target.value };
                                    setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                                  }} />
                              </div>
                              <div>
                                <label className="ac-label" style={{ fontSize: 10, color: "var(--color-success)" }}>Actual Break Out</label>
                                <input className="form-input" type="time" value={brk.ActualBreakOut ?? ""}
                                  onChange={e => {
                                    const s = [...editValues.ScheduleTimeAndAttendance as any[]];
                                    s[si].breaks[bi] = { ...s[si].breaks[bi], ActualBreakOut: e.target.value };
                                    setEditValues(p => ({ ...p, ScheduleTimeAndAttendance: s }));
                                  }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                  <label className="ac-label" style={{ marginBottom: 0 }}>Stamps Feedback</label>
                  <button className="ac-edit-btn" onClick={() => {
                    const fb = [...(editValues.StampsFeedback as any[])];
                    fb.push({ type: "late", scheduledTime: "", actualTime: "", deductionMinutes: 0 });
                    setEditValues(p => ({ ...p, StampsFeedback: fb }));
                  }}>+ Add Entry</button>
                </div>
                {(editValues.StampsFeedback as any[]).length === 0 && (
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-faint)", fontStyle: "italic", padding: "var(--space-3)", background: "var(--color-bg-alt)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    No feedback entries.
                  </div>
                )}
                {(editValues.StampsFeedback as any[]).map((fb: any, fi: number) => (
                  <div key={fi} style={{ background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", marginBottom: "var(--space-3)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--color-danger)" }}>Entry {fi + 1}</span>
                      <button style={{ padding: "2px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", fontSize: 11, fontWeight: 700, color: "#dc2626", cursor: "pointer", fontFamily: "var(--font-base)" }}
                        onClick={() => {
                          const updated = (editValues.StampsFeedback as any[]).filter((_, i) => i !== fi);
                          setEditValues(p => ({ ...p, StampsFeedback: updated }));
                        }}>Remove</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="ac-label">Type</label>
                        <select className="form-select" value={fb.type ?? ""}
                          onChange={e => {
                            const updated = [...(editValues.StampsFeedback as any[])];
                            updated[fi] = { ...updated[fi], type: e.target.value };
                            setEditValues(p => ({ ...p, StampsFeedback: updated }));
                          }}>
                          <option value="late">Late</option>
                          <option value="overbreak">Overbreak</option>
                          <option value="earlyout">Early Out</option>
                          <option value="system_auto_logout">System Auto Logout</option>
                        </select>
                      </div>
                      <div>
                        <label className="ac-label">Scheduled Time</label>
                        <input className="form-input" type="time" value={fb.scheduledTime ?? ""}
                          onChange={e => {
                            const updated = [...(editValues.StampsFeedback as any[])];
                            updated[fi] = { ...updated[fi], scheduledTime: e.target.value };
                            setEditValues(p => ({ ...p, StampsFeedback: updated }));
                          }} />
                      </div>
                      <div>
                        <label className="ac-label">Actual Time</label>
                        <input className="form-input" type="time" value={fb.actualTime ?? ""}
                          onChange={e => {
                            const updated = [...(editValues.StampsFeedback as any[])];
                            updated[fi] = { ...updated[fi], actualTime: e.target.value };
                            setEditValues(p => ({ ...p, StampsFeedback: updated }));
                          }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="ac-label">Deduction Minutes</label>
                        <input className="form-input" type="number" value={fb.deductionMinutes ?? 0}
                          onChange={e => {
                            const updated = [...(editValues.StampsFeedback as any[])];
                            updated[fi] = { ...updated[fi], deductionMinutes: Number(e.target.value) };
                            setEditValues(p => ({ ...p, StampsFeedback: updated }));
                          }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className="ac-modal-footer-wrap">
              {editMsg && <div className={`ac-alert ${editMsg.type}`}>{editMsg.text}</div>}
              <div className="ac-modal-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditRow(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveClick} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>

          {showPreSaveConfirm && (
            <div className="ac-confirm-overlay" onClick={e => { if (e.target === e.currentTarget && !saving && !recomputing) setShowPreSaveConfirm(false); }}>
              <div className="ac-confirm-modal">
                <div className="ac-confirm-icon">⏱</div>
                <div className="ac-confirm-title">Recompute salary?</div>
                <div className="ac-confirm-text">
                  You changed clock stamps or feedback entries for this record. Before saving, choose how pay should be handled:
                </div>
                <div className="ac-confirm-option">
                  <strong>Recompute pay</strong> — Regular/Holiday, Overtime, and Night Shift Differential will be recalculated automatically based on the changes you made.
                </div>
                <div className="ac-confirm-option">
                  <strong>Keep manual values</strong> — the Regular/Holiday/Overtime figures you typed above will be saved exactly as entered, with no recalculation.
                </div>
                <div className="ac-confirm-btns">
                  <button className="btn btn-primary btn-sm" onClick={() => performSave(true)} disabled={saving || recomputing}>
                    {saving || recomputing ? "Working..." : "Save & Recompute Pay"}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    onClick={() => performSave(false)}
                    disabled={saving || recomputing}
                  >
                    Save & Keep Manual Values
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowPreSaveConfirm(false)} disabled={saving || recomputing}>
                    Cancel, go back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "var(--space-6)", fontFamily: "var(--font-base)", width: "100%", maxWidth: "100%", boxSizing: "border-box" },
};