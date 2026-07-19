import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type OTStatus = "pending" | "approved" | "rejected";
type OTType = "PartTimeOT" | "RestDayOT";

interface OTRow {
  id: string;
  EmployeeID: string;
  CompanyCode: string;
  Date: string;
  ScheduleType: OTType;
  Schedules: any;
  OTHours: number;
  ReferenceSchedule: string | null;
  ShiftCoverage: string | null;
  Status: OTStatus | null;
  AdminNote: string | null;
  CreatedAt: string;
  // joined from users
  EmployeeName?: string;
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: "rgba(234,179,8,0.08)",  color: "#92400e", border: "rgba(234,179,8,0.35)",  label: "Pending" },
  approved: { bg: "var(--color-success-light)", color: "var(--color-success)", border: "rgba(22,163,74,0.25)", label: "Approved" },
  rejected: { bg: "var(--color-danger-light)",  color: "var(--color-danger)",  border: "rgba(220,38,38,0.25)",  label: "Rejected" },
};

const OT_TYPE_STYLE: Record<OTType, { label: string; icon: string; bg: string; color: string }> = {
  PartTimeOT: { label: "Part-Time OT", icon: "⏱", bg: "#f5f3ff", color: "#7c3aed" },
  RestDayOT:  { label: "Rest Day OT",  icon: "📅", bg: "#e0f4fd", color: "#0369a1" },
};

export default function OverTimeApproval() {
  const [companyCode, setCompanyCode] = useState("");
  const [requests, setRequests] = useState<OTRow[]>([]);
  const [employees, setEmployees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  // Action state
  const [actionId, setActionId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actioning, setActioning] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users").select("CompanyCode").eq("Email", email).single();
      if (!user) { setError("Could not load user."); setLoading(false); return; }
      setCompanyCode(user.CompanyCode);

      // Fetch employee names map
      const { data: empList } = await supabase
        .from("users").select("EmployeeID, FirstName, LastName")
        .eq("CompanyCode", user.CompanyCode);
      const empMap: Record<string, string> = {};
      (empList ?? []).forEach(e => { empMap[e.EmployeeID] = `${e.FirstName} ${e.LastName}`; });
      setEmployees(empMap);

      await fetchRequests(user.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchRequests(code: string) {
    const { data } = await supabase
      .from("Overtime").select("*")
      .eq("CompanyCode", code)
      .order("CreatedAt", { ascending: false });
    setRequests((data ?? []) as OTRow[]);
  }

  async function handleAction(req: OTRow, action: "approved" | "rejected") {
    setActioning(true); setMsg(null);

    const { error: e } = await supabase.from("Overtime").update({
      Status: action,
      AdminNote: adminNote.trim() || null,
    }).eq("id", req.id);

    if (e) { setMsg({ type: "error", text: e.message }); setActioning(false); return; }

    setMsg({ type: "success", text: `Request ${action} successfully.` });
    setActionId(null); setAdminNote("");
    await fetchRequests(companyCode);
    setTimeout(() => setMsg(null), 2500);
    setActioning(false);
  }

  const filtered = requests.filter(r => {
    if (filter === "pending") return !r.Status || r.Status === "pending";
    if (filter === "approved") return r.Status === "approved";
    if (filter === "rejected") return r.Status === "rejected";
    return true;
  });

  const pendingCount = requests.filter(r => !r.Status || r.Status === "pending").length;
  const approvedCount = requests.filter(r => r.Status === "approved").length;
  const rejectedCount = requests.filter(r => r.Status === "rejected").length;

  if (loading) return (
    <div style={s.page}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  );
  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;

  return (
    <>
      <style>{`
        .ota-page{padding:var(--space-6);font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .ota-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-6);gap:var(--space-4);flex-wrap:wrap}
        .ota-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .ota-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}

        .ota-stats{display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap}
        .ota-stat{display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:99px;border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:600;color:var(--color-text-muted)}
        .ota-stat-val{font-weight:800;color:var(--color-text);margin-left:3px}
        .ota-pending-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.35);color:#92400e;border-radius:99px;padding:5px 14px;font-size:var(--font-size-xs);font-weight:700}

        .ota-filter{display:flex;gap:var(--space-2);margin-bottom:var(--space-5);flex-wrap:wrap}
        .ota-filter-btn{padding:6px 14px;border-radius:99px;border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);color:var(--color-text-muted);transition:all .15s}
        .ota-filter-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange)}
        .ota-filter-btn.active{background:var(--color-text);color:white;border-color:var(--color-text)}

        .ota-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}

        .ota-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);transition:box-shadow .15s}
        .ota-card:hover{box-shadow:var(--shadow-sm)}
        .ota-card-top{display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-3)}
        .ota-card-icon{width:40px;height:40px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .ota-card-info{flex:1;min-width:0}
        .ota-card-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .ota-card-date{font-size:var(--font-size-xs);color:var(--color-text-muted)}
        .ota-card-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
        .ota-status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
        .ota-card-hours{font-size:12px;font-weight:700;color:var(--color-text-muted);font-family:monospace}

        .ota-card-details{display:flex;flex-wrap:wrap;gap:var(--space-4);padding:var(--space-3) var(--space-4);background:var(--color-bg-alt);border-radius:var(--radius-md);margin-bottom:var(--space-3)}
        .ota-detail{display:flex;flex-direction:column;gap:2px;min-width:120px}
        .ota-detail-label{font-size:10px;font-weight:700;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.06em}
        .ota-detail-val{font-size:var(--font-size-xs);font-weight:600;color:var(--color-text);font-family:monospace}

        .ota-slots{display:flex;flex-direction:column;gap:4px;margin-bottom:var(--space-3)}
        .ota-slot{display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-xs);font-family:monospace;color:var(--color-text-secondary)}
        .ota-slot-pill{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:2px 10px;font-weight:600}
        .ota-slot-hours{color:var(--color-text-faint);font-size:10px}

        .ota-admin-note{font-size:var(--font-size-xs);color:var(--color-text-muted);font-style:italic;padding:var(--space-2) var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md);margin-bottom:var(--space-3)}

        .ota-actions{display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap}
        .ota-review-btn{padding:7px 16px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);color:var(--color-text-secondary);transition:all .15s}
        .ota-review-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange)}
        .ota-approve-btn{padding:7px 16px;border-radius:var(--radius-md);border:none;background:var(--color-success);color:white;font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);transition:opacity .15s}
        .ota-approve-btn:hover{opacity:.85}
        .ota-reject-btn{padding:7px 16px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;color:var(--color-danger);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);transition:all .15s}
        .ota-reject-btn:hover{background:var(--color-danger-light);border-color:var(--color-danger)}
        .ota-approve-btn:disabled,.ota-reject-btn:disabled,.ota-review-btn:disabled{opacity:.5;cursor:not-allowed}
        .ota-note-input{flex:1;min-width:180px}

        .ota-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-5)}
        .ota-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .ota-alert.success{background:var(--color-success-light);color:var(--color-success)}
      `}</style>

      <div className="ota-page">
        <div className="ota-header">
          <div>
            <h1 className="ota-title">Overtime Approvals</h1>
            <p className="ota-sub">Review and approve employee overtime requests.</p>
          </div>
          {pendingCount > 0 && (
            <span className="ota-pending-badge">⏳ {pendingCount} pending</span>
          )}
        </div>

        {/* Stats */}
        <div className="ota-stats">
          <div className="ota-stat">⏳ Pending <span className="ota-stat-val">{pendingCount}</span></div>
          <div className="ota-stat">✓ Approved <span className="ota-stat-val">{approvedCount}</span></div>
          <div className="ota-stat">✕ Rejected <span className="ota-stat-val">{rejectedCount}</span></div>
          <div className="ota-stat">Total <span className="ota-stat-val">{requests.length}</span></div>
        </div>

        {msg && <div className={`ota-alert ${msg.type}`}>{msg.text}</div>}

        {/* Filter */}
        <div className="ota-filter">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <button key={f} className={`ota-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="ota-empty">No {filter === "all" ? "" : filter} overtime requests.</div>
        ) : filtered.map(req => {
          const typeDef = OT_TYPE_STYLE[req.ScheduleType] ?? OT_TYPE_STYLE.PartTimeOT;
          const statusKey = req.Status ?? "pending";
          const statusDef = STATUS_STYLE[statusKey];
          const slots = typeof req.Schedules === "string" ? JSON.parse(req.Schedules) : (req.Schedules ?? []);
          const isActioning = actionId === req.id;
          const empName = employees[req.EmployeeID] ?? req.EmployeeID;

          return (
            <div key={req.id} className="ota-card">

              {/* Top row */}
              <div className="ota-card-top">
                <div className="ota-card-icon" style={{ background: typeDef.bg }}>
                  {typeDef.icon}
                </div>
                <div className="ota-card-info">
                  <div className="ota-card-name">
                    {empName}
                    <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: 11, marginLeft: 6 }}>
                      #{req.EmployeeID}
                    </span>
                  </div>
                  <div className="ota-card-date">
                    {fmtDate(req.Date)} · <span style={{ color: typeDef.color, fontWeight: 600 }}>{typeDef.label}</span>
                  </div>
                </div>
                <div className="ota-card-right">
                  <span className="ota-status-badge"
                    style={{ background: statusDef.bg, color: statusDef.color, borderColor: statusDef.border }}>
                    {statusDef.label}
                  </span>
                  <span className="ota-card-hours">{req.OTHours}h OT</span>
                </div>
              </div>

              {/* OT Slots */}
              <div className="ota-slots">
                {slots.map((slot: any, i: number) => {
                  const slotH = (() => {
                    let s = slot.timeIn.split(":").map(Number); let e = slot.timeOut.split(":").map(Number);
                    let sm = s[0]*60+s[1]; let em = e[0]*60+e[1];
                    if (em <= sm) em += 1440;
                    return Math.round((em-sm)/60*100)/100;
                  })();
                  return (
                    <div key={i} className="ota-slot">
                      <span className="ota-slot-pill">{fmt12(slot.timeIn)} → {fmt12(slot.timeOut)}</span>
                      <span className="ota-slot-hours">{slotH}h</span>
                    </div>
                  );
                })}
              </div>

              {/* Details */}
              <div className="ota-card-details">
                {req.ReferenceSchedule && (
                  <div className="ota-detail">
                    <span className="ota-detail-label">Reference Schedule</span>
                    <span className="ota-detail-val">{req.ReferenceSchedule}</span>
                  </div>
                )}
                <div className="ota-detail">
                  <span className="ota-detail-label">Total OT Hours</span>
                  <span className="ota-detail-val">{req.OTHours}h</span>
                </div>
                <div className="ota-detail">
                  <span className="ota-detail-label">Filed On</span>
                  <span className="ota-detail-val">{new Date(req.CreatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>

              {/* Admin note if reviewed */}
              {req.AdminNote && (
                <div className="ota-admin-note">💬 Admin note: {req.AdminNote}</div>
              )}

              {/* Actions — only for pending */}
              {statusKey === "pending" && (
                <>
                  {isActioning && (
                    <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                      <input className="form-input ota-note-input" placeholder="Admin note (optional)"
                        value={adminNote} onChange={e => setAdminNote(e.target.value)} />
                    </div>
                  )}
                  <div className="ota-actions">
                    {!isActioning ? (
                      <button className="ota-review-btn" onClick={() => { setActionId(req.id); setAdminNote(""); }}>
                        Review
                      </button>
                    ) : (
                      <>
                        <button className="ota-approve-btn" disabled={actioning}
                          onClick={() => handleAction(req, "approved")}>
                          {actioning ? "Approving…" : "✓ Approve"}
                        </button>
                        <button className="ota-reject-btn" disabled={actioning}
                          onClick={() => handleAction(req, "rejected")}>
                          {actioning ? "Rejecting…" : "✕ Reject"}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setActionId(null)}>Cancel</button>
                      </>
                    )}
                  </div>
                </>
              )}

            </div>
          );
        })}
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "var(--space-6)", fontFamily: "var(--font-base)", width: "100%", maxWidth: "100%", boxSizing: "border-box" },
};