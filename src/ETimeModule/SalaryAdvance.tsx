import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type SAStatus = "pending" | "approved" | "rejected";

interface SARow {
  id: string;
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

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

const STATUS_STYLE: Record<SAStatus, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: "rgba(234,179,8,0.08)", color: "#92400e", border: "rgba(234,179,8,0.35)", label: "Pending" },
  approved: { bg: "var(--color-success-light)", color: "var(--color-success)", border: "rgba(22,163,74,0.25)", label: "Approved" },
  rejected: { bg: "var(--color-danger-light)", color: "var(--color-danger)", border: "rgba(220,38,38,0.25)", label: "Rejected" },
};

export default function SalaryAdvance() {
  const [employeeID, setEmployeeID] = useState<string | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [currency, setCurrency] = useState("$");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<SARow[]>([]);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [requestDate, setRequestDate] = useState(fmt(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data: user, error: userErr } = await supabase
        .from("users").select("EmployeeID, CompanyCode, Currency").eq("Email", email).single();
      if (userErr || !user) { setError("Could not load user."); setLoading(false); return; }
      if (!user.EmployeeID) { setError("Your account has no Employee ID set — contact your admin."); setLoading(false); return; }
      setEmployeeID(user.EmployeeID);
      setCompanyCode(user.CompanyCode);
      setCurrency(user.Currency ?? "$");
      await fetchRequests(user.EmployeeID, user.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchRequests(empID: string, code: string) {
    const { data } = await supabase
      .from("SalaryAdvances")
      .select("id, Amount, Reason, RequestDate, Status, AdminNote, CreatedAt")
      .eq("EmployeeID", empID)
      .eq("CompanyCode", code)
      .order("CreatedAt", { ascending: false });
    setRequests((data ?? []) as SARow[]);
  }

  async function handleSubmit() {
    setMsg(null);
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setMsg({ type: "error", text: "Please enter a valid amount." });
      return;
    }
    if (!requestDate) {
      setMsg({ type: "error", text: "Please select a date." });
      return;
    }
    if (!employeeID || !companyCode) return;

    setSubmitting(true);
    const { error: e } = await supabase.from("SalaryAdvances").insert([{
      EmployeeID: employeeID,
      CompanyCode: companyCode,
      Amount: numAmount,
      Reason: reason.trim() || null,
      RequestDate: requestDate,
      Status: "pending",
    }]);

    if (e) { setMsg({ type: "error", text: e.message }); setSubmitting(false); return; }

    setMsg({ type: "success", text: "Salary advance request submitted." });
    setAmount("");
    setReason("");
    setRequestDate(fmt(new Date()));
    await fetchRequests(employeeID, companyCode);
    setTimeout(() => setMsg(null), 2500);
    setSubmitting(false);
  }

  const pendingCount = requests.filter(r => r.Status === "pending").length;
  const approvedTotal = requests.filter(r => r.Status === "approved").reduce((s, r) => s + r.Amount, 0);

  if (loading) return (
    <div style={s.page}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  );
  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;

  return (
    <>
      <style>{`
        .sav-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .sav-header{margin-bottom:var(--space-6)}
        .sav-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .sav-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}

        .sav-stats{display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap}
        .sav-stat{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);flex:1;min-width:120px;box-shadow:var(--shadow-xs)}
        .sav-stat-num{font-size:var(--font-size-xl);font-weight:700;line-height:1.2;color:var(--color-text)}
        .sav-stat-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}

        .sav-form-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-6);box-shadow:var(--shadow-xs)}
        .sav-form-title{font-size:var(--font-size-base);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}
        .sav-form-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-4)}
        @media(max-width:480px){.sav-form-row{grid-template-columns:1fr}}
        .sav-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .sav-amount-row{display:flex;align-items:center;gap:var(--space-2)}
        .sav-currency-pill{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:var(--color-bg-alt);border:1px solid var(--color-border);font-weight:700;color:var(--color-text-secondary);flex-shrink:0}

        .sav-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .sav-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .sav-alert.success{background:var(--color-success-light);color:var(--color-success)}

        .sav-list-title{font-size:var(--font-size-base);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}
        .sav-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .sav-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3)}
        .sav-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-2)}
        .sav-card-amount{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);font-family:monospace}
        .sav-card-date{font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:2px}
        .sav-status-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid;flex-shrink:0}
        .sav-card-reason{font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-top:var(--space-2)}
        .sav-card-note{font-size:var(--font-size-xs);color:var(--color-text-muted);font-style:italic;padding:var(--space-2) var(--space-3);background:var(--color-bg-alt);border-radius:var(--radius-md);margin-top:var(--space-3)}
      `}</style>

      <div className="sav-page">
        <div className="sav-header">
          <h1 className="sav-title">Salary Advance</h1>
          <p className="sav-sub">Request a salary advance. Approved requests are deducted from your payslip for the covering pay period.</p>
        </div>

        <div className="sav-stats">
          <div className="sav-stat">
            <div className="sav-stat-num">{pendingCount}</div>
            <div className="sav-stat-label">Pending</div>
          </div>
          <div className="sav-stat">
            <div className="sav-stat-num">{currency}{approvedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="sav-stat-label">Approved Total</div>
          </div>
          <div className="sav-stat">
            <div className="sav-stat-num">{requests.length}</div>
            <div className="sav-stat-label">Total Requests</div>
          </div>
        </div>

        <div className="sav-form-card">
          <div className="sav-form-title">New Request</div>

          {msg && <div className={`sav-alert ${msg.type}`}>{msg.text}</div>}

          <div className="sav-form-row">
            <div>
              <label className="sav-label">Amount</label>
              <div className="sav-amount-row">
                <span className="sav-currency-pill">{currency}</span>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 2000"
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="sav-label">Apply to pay period covering</label>
              <input className="form-input" type="date" value={requestDate}
                onChange={e => setRequestDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-4)" }}>
            <label className="sav-label">Reason <span style={{ fontWeight: 400, color: "var(--color-text-faint)" }}>(optional)</span></label>
            <textarea className="form-input" rows={2} placeholder="e.g. Medical expense, emergency, etc."
              value={reason} onChange={e => setReason(e.target.value)} style={{ resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </div>

        <div className="sav-list-title">My Requests</div>
        {requests.length === 0 ? (
          <div className="sav-empty">No salary advance requests yet.</div>
        ) : requests.map(r => {
          const statusDef = STATUS_STYLE[r.Status];
          return (
            <div key={r.id} className="sav-card">
              <div className="sav-card-top">
                <div>
                  <div className="sav-card-amount">{currency}{r.Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="sav-card-date">For pay period covering {fmtDate(r.RequestDate)} · Filed {new Date(r.CreatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</div>
                </div>
                <span className="sav-status-badge" style={{ background: statusDef.bg, color: statusDef.color, borderColor: statusDef.border }}>
                  {statusDef.label}
                </span>
              </div>
              {r.Reason && <div className="sav-card-reason">{r.Reason}</div>}
              {r.AdminNote && <div className="sav-card-note">💬 Admin note: {r.AdminNote}</div>}
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
