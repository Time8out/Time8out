import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type SAStatus = "pending" | "approved" | "rejected";

interface SARow {
  id: string;
  EmployeeID: string;
  CompanyCode: string;
  Amount: number;
  Reason: string | null;
  RequestDate: string;
  Status: SAStatus;
  AdminNote: string | null;
  CreatedAt: string;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const STATUS_STYLE: Record<SAStatus, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: "rgba(234,179,8,0.08)", color: "#92400e", border: "rgba(234,179,8,0.35)", label: "Pending" },
  approved: { bg: "var(--color-success-light)", color: "var(--color-success)", border: "rgba(22,163,74,0.25)", label: "Approved" },
  rejected: { bg: "var(--color-danger-light)", color: "var(--color-danger)", border: "rgba(220,38,38,0.25)", label: "Rejected" },
};

export default function SalaryAdvanceApproval() {
  const [companyCode, setCompanyCode] = useState("");
  const [adminID, setAdminID] = useState("");
  const [requests, setRequests] = useState<SARow[]>([]);
  const [employees, setEmployees] = useState<Record<string, { name: string; currency: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const [actionId, setActionId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actioning, setActioning] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users").select("EmployeeID, CompanyCode").eq("Email", email).single();
      if (!user) { setError("Could not load user."); setLoading(false); return; }
      setAdminID(user.EmployeeID ?? email);
      setCompanyCode(user.CompanyCode);

      const { data: empList } = await supabase
        .from("users").select("EmployeeID, FirstName, LastName, Currency")
        .eq("CompanyCode", user.CompanyCode);
      const empMap: Record<string, { name: string; currency: string }> = {};
      (empList ?? []).forEach(e => { empMap[e.EmployeeID] = { name: `${e.FirstName} ${e.LastName}`, currency: e.Currency ?? "$" }; });
      setEmployees(empMap);

      await fetchRequests(user.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchRequests(code: string) {
    const { data } = await supabase
      .from("SalaryAdvances").select("*")
      .eq("CompanyCode", code)
      .order("CreatedAt", { ascending: false });
    setRequests((data ?? []) as SARow[]);
  }

  async function handleAction(req: SARow, action: "approved" | "rejected") {
    setActioning(true); setMsg(null);

    const { error: e } = await supabase.from("SalaryAdvances").update({
      Status: action,
      AdminNote: adminNote.trim() || null,
      ReviewedBy: adminID,
      ReviewedAt: new Date().toISOString(),
    }).eq("id", req.id);

    if (e) { setMsg({ type: "error", text: e.message }); setActioning(false); return; }

    setMsg({ type: "success", text: `Request ${action} successfully.` });
    setActionId(null); setAdminNote("");
    await fetchRequests(companyCode);
    setTimeout(() => setMsg(null), 2500);
    setActioning(false);
  }

  const filtered = requests.filter(r => {
    if (filter === "pending") return r.Status === "pending";
    if (filter === "approved") return r.Status === "approved";
    if (filter === "rejected") return r.Status === "rejected";
    return true;
  });

  const pendingCount = requests.filter(r => r.Status === "pending").length;
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
        .saa-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .saa-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-6);gap:var(--space-4);flex-wrap:wrap}
        .saa-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        @media(max-width:480px){.saa-title{font-size:var(--font-size-xl)}}
        .saa-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}

        .saa-stats{display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap}
        .saa-stat{display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:99px;border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:600;color:var(--color-text-muted)}
        .saa-stat-val{font-weight:800;color:var(--color-text);margin-left:3px}
        .saa-pending-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.35);color:#92400e;border-radius:99px;padding:5px 14px;font-size:var(--font-size-xs);font-weight:700}

        .saa-filter{display:flex;gap:var(--space-2);margin-bottom:var(--space-5);flex-wrap:wrap}
        .saa-filter-btn{padding:6px 14px;border-radius:99px;border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);color:var(--color-text-muted);transition:all .15s}
        .saa-filter-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange)}
        .saa-filter-btn.active{background:var(--color-text);color:white;border-color:var(--color-text)}

        .saa-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}

        .saa-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);transition:box-shadow .15s,transform .15s}
        .saa-card:hover{box-shadow:var(--shadow-sm);transform:translateY(-1px)}
        @media(max-width:480px){.saa-card{padding:var(--space-3)}}
        .saa-card-top{display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-3);flex-wrap:wrap}
        .saa-card-icon{width:40px;height:40px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:#f5f3ff}
        .saa-card-info{flex:1;min-width:160px}
        .saa-card-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .saa-card-date{font-size:var(--font-size-xs);color:var(--color-text-muted)}
        .saa-card-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;margin-left:auto}
        .saa-status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
        .saa-card-amount{font-size:14px;font-weight:800;color:var(--color-text);font-family:monospace}

        .saa-card-details{display:flex;flex-wrap:wrap;gap:var(--space-4);padding:var(--space-3) var(--space-4);background:var(--color-bg-alt);border-radius:var(--radius-md);margin-bottom:var(--space-3)}
        .saa-detail{display:flex;flex-direction:column;gap:2px;min-width:140px}
        .saa-detail-label{font-size:10px;font-weight:700;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:.06em}
        .saa-detail-val{font-size:var(--font-size-xs);font-weight:600;color:var(--color-text)}

        .saa-admin-note{font-size:var(--font-size-xs);color:var(--color-text-muted);font-style:italic;padding:var(--space-2) var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md);margin-bottom:var(--space-3)}

        .saa-actions{display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap}
        @media(max-width:480px){.saa-actions{flex-direction:column;align-items:stretch}.saa-actions button{width:100%}}
        .saa-review-btn{padding:7px 16px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);color:var(--color-text-secondary);transition:all .15s}
        .saa-review-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange)}
        .saa-approve-btn{padding:7px 16px;border-radius:var(--radius-md);border:none;background:var(--color-success);color:white;font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);transition:opacity .15s}
        .saa-approve-btn:hover{opacity:.85}
        .saa-reject-btn{padding:7px 16px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;color:var(--color-danger);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);transition:all .15s}
        .saa-reject-btn:hover{background:var(--color-danger-light);border-color:var(--color-danger)}
        .saa-approve-btn:disabled,.saa-reject-btn:disabled,.saa-review-btn:disabled{opacity:.5;cursor:not-allowed}
        .saa-note-input{flex:1;min-width:180px}

        .saa-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-5)}
        .saa-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .saa-alert.success{background:var(--color-success-light);color:var(--color-success)}
      `}</style>

      <div className="saa-page">
        <div className="saa-header">
          <div>
            <h1 className="saa-title">Salary Advance Approvals</h1>
            <p className="saa-sub">Review and approve employee salary advance requests.</p>
          </div>
          {pendingCount > 0 && (
            <span className="saa-pending-badge">⏳ {pendingCount} pending</span>
          )}
        </div>

        <div className="saa-stats">
          <div className="saa-stat">⏳ Pending <span className="saa-stat-val">{pendingCount}</span></div>
          <div className="saa-stat">✓ Approved <span className="saa-stat-val">{approvedCount}</span></div>
          <div className="saa-stat">✕ Rejected <span className="saa-stat-val">{rejectedCount}</span></div>
          <div className="saa-stat">Total <span className="saa-stat-val">{requests.length}</span></div>
        </div>

        {msg && <div className={`saa-alert ${msg.type}`}>{msg.text}</div>}

        <div className="saa-filter">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <button key={f} className={`saa-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="saa-empty">No {filter === "all" ? "" : filter} salary advance requests.</div>
        ) : filtered.map(req => {
          const statusDef = STATUS_STYLE[req.Status];
          const isActioning = actionId === req.id;
          const emp = employees[req.EmployeeID];
          const empName = emp?.name ?? req.EmployeeID;
          const currency = emp?.currency ?? "$";

          return (
            <div key={req.id} className="saa-card">
              <div className="saa-card-top">
                <div className="saa-card-icon">💵</div>
                <div className="saa-card-info">
                  <div className="saa-card-name">
                    {empName}
                    <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: 11, marginLeft: 6 }}>
                      #{req.EmployeeID}
                    </span>
                  </div>
                  <div className="saa-card-date">For pay period covering {fmtDate(req.RequestDate)}</div>
                </div>
                <div className="saa-card-right">
                  <span className="saa-status-badge" style={{ background: statusDef.bg, color: statusDef.color, borderColor: statusDef.border }}>
                    {statusDef.label}
                  </span>
                  <span className="saa-card-amount">{currency}{req.Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="saa-card-details">
                {req.Reason && (
                  <div className="saa-detail">
                    <span className="saa-detail-label">Reason</span>
                    <span className="saa-detail-val">{req.Reason}</span>
                  </div>
                )}
                <div className="saa-detail">
                  <span className="saa-detail-label">Filed On</span>
                  <span className="saa-detail-val">{new Date(req.CreatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>

              {req.AdminNote && (
                <div className="saa-admin-note">💬 Admin note: {req.AdminNote}</div>
              )}

              {req.Status === "pending" && (
                <>
                  {isActioning && (
                    <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                      <input className="form-input saa-note-input" placeholder="Admin note (optional)"
                        value={adminNote} onChange={e => setAdminNote(e.target.value)} />
                    </div>
                  )}
                  <div className="saa-actions">
                    {!isActioning ? (
                      <button className="saa-review-btn" onClick={() => { setActionId(req.id); setAdminNote(""); }}>
                        Review
                      </button>
                    ) : (
                      <>
                        <button className="saa-approve-btn" disabled={actioning}
                          onClick={() => handleAction(req, "approved")}>
                          {actioning ? "Approving…" : "✓ Approve"}
                        </button>
                        <button className="saa-reject-btn" disabled={actioning}
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
