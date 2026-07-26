import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import { getTimezone } from "../../utils/getTimezone";
import EmployeeEdit from "./EmployeeEdit";
import type { Employee } from "./EmployeeEdit";

interface NewEmployeeForm {
  FirstName: string; LastName: string; UserName: string;
  Email: string; Password: string; UserType: string;
  EmployeeID: string; ProximityNumber: string;
}

const EMPTY_FORM: NewEmployeeForm = {
  FirstName: "", LastName: "", UserName: "", Email: "",
  Password: "", UserType: "Employee", EmployeeID: "", ProximityNumber: "",
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ManageEmployee() {
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The Special (owner) user's row carries the company's subscription info.
  // Found from the already-loaded `employees` list (same CompanyCode) rather than a
  // separate lookup, since the logged-in user managing employees may not be the Special user themselves.
  const specialUser = employees.find(e => e.UserType === "Special") as
    (Employee & { SubscriptionLevel?: { Type: string; EmployeeLimit: number | string }[]; BrandAmbassador?: boolean }) | undefined;
  const subscriptionEntry = specialUser?.SubscriptionLevel?.[0];
  const subscriptionType: string | null = subscriptionEntry?.Type ?? null;
  const isBrandAmbassador = specialUser?.BrandAmbassador === true;
  const employeeLimit: number | null = isBrandAmbassador
    ? null
    : typeof subscriptionEntry?.EmployeeLimit === "number" ? subscriptionEntry.EmployeeLimit : null;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<NewEmployeeForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<NewEmployeeForm>>({});
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showEmployeeIdWarning, setShowEmployeeIdWarning] = useState(false);

  // ── Timezone detected once on mount ─────────────────────
  const [detectedTimezone, setDetectedTimezone] = useState<string>('');

  const [selected, setSelected] = useState<Employee | null>(null);

  useEffect(() => {
    // Detect timezone on mount
    getTimezone().then(tz => setDetectedTimezone(tz));

    async function bootstrap() {
      try {
        const raw = sessionStorage.getItem("t8_session");
        if (!raw) { setError("No session found."); setLoading(false); return; }
        const decoded = atob(raw);
        const email = decoded.split(":")[1];
        const { data: userData, error: userErr } = await supabase
          .from("users").select("CompanyCode, CompanyName").eq("Email", email).single();
        if (userErr || !userData) { setError("Could not load user."); setLoading(false); return; }
        setCompanyCode(userData.CompanyCode);
        setCompanyName(userData.CompanyName);
        await fetchEmployees(userData.CompanyCode);
      } catch { setError("Something went wrong."); }
      finally { setLoading(false); }
    }
    bootstrap();
  }, []);

  async function fetchEmployees(code: string) {
    const { data, error } = await supabase
      .from("users").select("*").eq("CompanyCode", code).order("FirstName", { ascending: true });
    if (!error && data) setEmployees(data);
  }

  function validateForm(skipEmployeeIdCheck = false): boolean {
    const e: Partial<NewEmployeeForm> = {};
    if (!form.FirstName.trim()) e.FirstName = "Required.";
    if (!form.LastName.trim()) e.LastName = "Required.";
    if (!form.UserName.trim()) e.UserName = "Required.";
    else if (form.UserName.length < 3) e.UserName = "Min 3 characters.";
    if (!form.Email.trim()) e.Email = "Required.";
    else if (!emailRe.test(form.Email)) e.Email = "Invalid email.";
    if (!form.Password.trim()) e.Password = "Required.";
    else if (form.Password.length < 8) e.Password = "Min 8 characters.";
    setFormErrors(e);
    if (Object.keys(e).length > 0) return false;
    if (!skipEmployeeIdCheck && !form.EmployeeID.trim()) { setShowEmployeeIdWarning(true); return false; }
    return true;
  }

  const limitReached = employeeLimit !== null && employees.length >= employeeLimit;

  async function handleAdd() {
    if (!validateForm()) return;
    await submitAdd();
  }

  async function submitAdd() {
    setAddLoading(true); setAddMsg(null); setShowEmployeeIdWarning(false);

    if (limitReached) {
      setAddMsg({ type: "error", text: `You've reached your ${subscriptionType ?? "current"} plan's limit of ${employeeLimit} employees. Upgrade your plan to add more.` });
      setAddLoading(false);
      return;
    }

    const { data: existing } = await supabase.from("users").select("Email").eq("Email", form.Email).maybeSingle();
    if (existing) { setAddMsg({ type: "error", text: "Email already registered." }); setAddLoading(false); return; }

    const { error: insertErr } = await supabase.from("users").insert([{
      FirstName: form.FirstName, LastName: form.LastName, UserName: form.UserName,
      Email: form.Email, Password: form.Password,
      EmployeeID: form.EmployeeID.trim() || null,
      ProximityNumber: form.ProximityNumber.trim() || null,
      CompanyName: companyName, CompanyCode: companyCode, UserType: form.UserType,
      System: [{ EmployeeTime: "YES", GymTracker: "NO", ESLScheduler: "NO" }],
      TimeZone: detectedTimezone || null,
    }]);

    if (insertErr) { setAddMsg({ type: "error", text: insertErr.message }); }
    else {
      setAddMsg({ type: "success", text: "Employee added successfully!" });
      setForm(EMPTY_FORM);
      await fetchEmployees(companyCode!);
      setTimeout(() => { setShowAdd(false); setAddMsg(null); }, 1200);
    }
    setAddLoading(false);
  }

  if (loading) return (
    <div style={s.page}>
      <div style={s.loadingWrap}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />
        ))}
      </div>
    </div>
  );

  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;

  return (
    <>
      <style>{`
        .me-table-wrap { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
        .me-table { width: 100%; border-collapse: collapse; }
        .me-table thead tr { border-bottom: 2px solid var(--color-border); }
        .me-table th { text-align: left; font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.07em; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
        .me-table td { padding: 13px 14px; font-size: var(--font-size-sm); color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
        .me-table tbody tr { cursor: pointer; transition: background var(--transition-fast); }
        .me-table tbody tr:hover { background: var(--brand-orange-light); }
        .me-table tbody tr:hover td { color: var(--color-text); }
        @media (max-width: 640px) { .me-col-username, .me-col-email { display: none; } }
        @media (max-width: 480px) { .me-col-empid { display: none; } .me-table th, .me-table td { padding: 11px 10px; } }
        .me-card-list { display: none; flex-direction: column; }
        @media (max-width: 400px) { .me-table-wrap { display: none; } .me-card-list { display: flex; } }
        .me-emp-card { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; align-items: center; gap: var(--space-3); cursor: pointer; transition: background var(--transition-fast), box-shadow var(--transition-fast); margin-bottom: var(--space-2); }
        .me-emp-card:hover { background: var(--brand-orange-light); box-shadow: var(--shadow-sm); }
        .me-emp-card-info { flex: 1; min-width: 0; }
        .me-emp-card-name { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); }
        .me-emp-card-sub { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px; }
        .me-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 200; animation: fadeIn 0.15s ease; padding: 16px; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .me-modal { background: var(--color-white); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; animation: slideUp 0.2s cubic-bezier(0.22,1,0.36,1); }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .me-modal-band { height: 4px; background: var(--gradient-brand); border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
        .me-modal-body { padding: var(--space-6) var(--space-6) var(--space-8); }
        @media (max-width: 480px) { .me-modal-body { padding: var(--space-5) var(--space-4) var(--space-6); } }
        .me-modal-title { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); margin-bottom: var(--space-1); letter-spacing: -0.01em; }
        .me-modal-sub { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-6); }
        .me-section-divider { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-5) 0 var(--space-4); font-size: var(--font-size-xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }
        .me-section-divider::before, .me-section-divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
        .me-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4); }
        @media (max-width: 420px) { .me-form-row { grid-template-columns: 1fr; } }
        .me-form-field { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
        .me-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); }
        .me-label-hint { font-size: var(--font-size-xs); font-weight: 400; color: var(--color-text-faint); margin-left: 5px; }
        .me-error { font-size: var(--font-size-xs); color: var(--color-danger); font-weight: 600; }
        .me-alert { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--space-4); line-height: 1.5; }
        .me-alert.error { background: var(--color-danger-light); color: var(--color-danger); }
        .me-alert.success { background: var(--color-success-light); color: var(--color-success); }
        .me-alert.warning { background: rgba(234,179,8,0.08); color: #92400e; border: 1px solid rgba(234,179,8,0.35); }
        .me-warning-actions { display: flex; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; }
        .me-warning-btn { padding: 7px 14px; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 700; cursor: pointer; border: none; font-family: var(--font-base); transition: opacity var(--transition-fast), transform var(--transition-fast); }
        .me-warning-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .me-warning-btn.primary { background: var(--gradient-orange); color: white; box-shadow: var(--shadow-brand-orange); }
        .me-warning-btn.ghost { background: transparent; color: #92400e; border: 1.5px solid rgba(234,179,8,0.4); }
        .me-modal-footer { display: flex; gap: var(--space-3); justify-content: flex-end; padding-top: var(--space-4); border-top: 1px solid var(--color-border); margin-top: var(--space-2); }
        .me-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }
        .me-badge.owner { background: var(--brand-orange-muted); color: var(--brand-orange-dark); }
        .me-badge.admin { background: var(--brand-blue-muted); color: var(--brand-blue-dark); }
        .me-badge.employee { background: var(--color-bg-alt); color: var(--color-text-muted); }
        .me-id-missing { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #b45309; font-weight: 600; }
        .me-id-value { font-family: monospace; font-size: var(--font-size-xs); background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; color: var(--color-text-secondary); }
        .me-field-hint { font-size: var(--font-size-xs); color: var(--color-text-faint); line-height: 1.5; margin-top: 2px; }
        .me-prox-row { display: flex; align-items: center; gap: var(--space-3); }
        .me-prox-row input { flex: 1; min-width: 0; }
        .me-prox-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: var(--radius-full); background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); font-size: 11px; font-weight: 700; color: #1d4ed8; white-space: nowrap; flex-shrink: 0; }
        .me-tz-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--color-text-muted); background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 99px; padding: 3px 10px; margin-bottom: var(--space-4); }
        .me-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-6); gap: var(--space-4); flex-wrap: wrap; }
        .me-header-text { min-width: 0; }
        .me-title { font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-bottom: 4px; }
        @media (max-width: 480px) { .me-title { font-size: var(--font-size-xl); } }
        .me-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
        .me-code { background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; font-size: var(--font-size-xs); font-family: monospace; color: var(--brand-orange); }
        .me-stats-row { display: flex; gap: var(--space-3); margin-bottom: var(--space-6); flex-wrap: wrap; }
        .me-stat-card { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-5); min-width: 90px; flex: 1; box-shadow: var(--shadow-xs); }
        .me-stat-num { font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-text); line-height: 1.2; }
        .me-stat-label { font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        @media (max-width: 480px) { .me-stat-card { padding: var(--space-3) var(--space-4); min-width: 70px; } .me-stat-num { font-size: var(--font-size-xl); } }
      `}</style>

      <div style={s.page}>
        <div className="me-header">
          <div className="me-header-text">
            <h1 className="me-title">Manage Employees</h1>
            <p className="me-subtitle">Company: <strong>{companyName}</strong> · Code: <code className="me-code">{companyCode}</code></p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setFormErrors({}); setAddMsg(null); setShowEmployeeIdWarning(false); }}
            disabled={limitReached}
            title={limitReached ? `Employee limit reached for the ${subscriptionType ?? "current"} plan.` : undefined}
          >
            + Add Employee
          </button>
        </div>

        {limitReached && (
          <div className="me-alert warning" style={{ marginBottom: "var(--space-5)" }}>
            ⚠️ You've reached your <strong>{subscriptionType ?? "current"}</strong> plan's limit of <strong>{employeeLimit}</strong> employees. Upgrade your plan to add more.
          </div>
        )}

        <div className="me-stats-row">
          {[
            { num: employeeLimit !== null ? `${employees.length} / ${employeeLimit}` : employees.length, label: subscriptionType ? `${subscriptionType} Plan` : "Total", color: "var(--color-text)" },
            { num: employees.filter(e => e.UserType === "Special").length, label: "Owners", color: "var(--brand-orange)" },
            { num: employees.filter(e => e.UserType === "Privilege").length, label: "Admins", color: "var(--brand-blue)" },
            { num: employees.filter(e => e.UserType === "Employee").length, label: "Employees", color: "var(--color-text-muted)" },
            { num: employees.filter(e => !e.EmployeeID?.trim()).length, label: "No ID", color: "var(--color-warning)" },
          ].map(({ num, label, color }) => (
            <div key={label} className="me-stat-card">
              <div className="me-stat-num" style={{ color }}>{num}</div>
              <div className="me-stat-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="me-table-wrap">
          {employees.length === 0 ? (
            <div style={s.empty}>No employees found under this company code.</div>
          ) : (
            <table className="me-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="me-col-empid">Employee ID</th>
                  <th className="me-col-username">Username</th>
                  <th className="me-col-email">Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={i} onClick={() => setSelected(emp)}>
                    <td><div style={s.nameCell}><div style={s.avatar}>{emp.FirstName?.[0]}{emp.LastName?.[0]}</div><span>{emp.FirstName} {emp.LastName}</span></div></td>
                    <td className="me-col-empid">{emp.EmployeeID?.trim() ? <span className="me-id-value">{emp.EmployeeID}</span> : <span className="me-id-missing">⚠ Not set</span>}</td>
                    <td className="me-col-username" style={{ color: "var(--color-text-muted)" }}>@{emp.UserName}</td>
                    <td className="me-col-email">{emp.Email}</td>
                    <td><span className={`me-badge ${emp.UserType === "Special" ? "owner" : emp.UserType === "Privilege" ? "admin" : "employee"}`}>{emp.UserType === "Special" ? "Owner" : emp.UserType === "Privilege" ? "Admin" : "Employee"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="me-card-list">
          {employees.length === 0 ? (
            <div style={s.empty}>No employees found under this company code.</div>
          ) : employees.map((emp, i) => (
            <div key={i} className="me-emp-card" onClick={() => setSelected(emp)}>
              <div style={s.avatar}>{emp.FirstName?.[0]}{emp.LastName?.[0]}</div>
              <div className="me-emp-card-info">
                <div className="me-emp-card-name">{emp.FirstName} {emp.LastName}</div>
                <div className="me-emp-card-sub">{emp.EmployeeID?.trim() ? emp.EmployeeID : "⚠ No ID"} · <span className={`me-badge ${emp.UserType === "Special" ? "owner" : emp.UserType === "Privilege" ? "admin" : "employee"}`}>{emp.UserType === "Special" ? "Owner" : emp.UserType === "Privilege" ? "Admin" : "Employee"}</span></div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
      </div>

      {/* ── ADD EMPLOYEE MODAL ── */}
      {showAdd && (
        <div className="me-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowAdd(false); setShowEmployeeIdWarning(false); } }}>
          <div className="me-modal">
            <div className="me-modal-band" />
            <div className="me-modal-body">
              <div className="me-modal-title">Add New Employee</div>
              <div className="me-modal-sub">Added under company code <strong>{companyCode}</strong></div>

              {/* Timezone pill */}
              {detectedTimezone && (
                <div className="me-tz-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Timezone: <strong>{detectedTimezone}</strong>
                </div>
              )}

              {addMsg && <div className={`me-alert ${addMsg.type}`}>{addMsg.text}</div>}

              {showEmployeeIdWarning && (
                <div className="me-alert warning" style={{ flexDirection: "column" }}>
                  <div>⚠️ <strong>Employee ID is missing.</strong> Without it, this employee won't be identifiable by the scanning system.</div>
                  <div className="me-warning-actions">
                    <button type="button" className="me-warning-btn ghost" onClick={() => setShowEmployeeIdWarning(false)}>← Add Employee ID</button>
                    <button type="button" className="me-warning-btn primary" onClick={submitAdd} disabled={addLoading}>{addLoading ? "Adding…" : "Continue anyway →"}</button>
                  </div>
                </div>
              )}

              <div className="me-form-row">
                <div className="me-form-field">
                  <label className="me-label">First Name *</label>
                  <input className={`form-input${formErrors.FirstName ? " is-error" : ""}`} placeholder="Juan" value={form.FirstName} onChange={e => { setForm(p => ({ ...p, FirstName: e.target.value })); setFormErrors(p => ({ ...p, FirstName: undefined })); }} />
                  {formErrors.FirstName && <span className="me-error">⚠ {formErrors.FirstName}</span>}
                </div>
                <div className="me-form-field">
                  <label className="me-label">Last Name *</label>
                  <input className={`form-input${formErrors.LastName ? " is-error" : ""}`} placeholder="dela Cruz" value={form.LastName} onChange={e => { setForm(p => ({ ...p, LastName: e.target.value })); setFormErrors(p => ({ ...p, LastName: undefined })); }} />
                  {formErrors.LastName && <span className="me-error">⚠ {formErrors.LastName}</span>}
                </div>
              </div>

              <div className="me-form-row">
                <div className="me-form-field">
                  <label className="me-label">Username *</label>
                  <input className={`form-input${formErrors.UserName ? " is-error" : ""}`} placeholder="juandc" value={form.UserName} onChange={e => { setForm(p => ({ ...p, UserName: e.target.value })); setFormErrors(p => ({ ...p, UserName: undefined })); }} />
                  {formErrors.UserName && <span className="me-error">⚠ {formErrors.UserName}</span>}
                </div>
                <div className="me-form-field">
                  <label className="me-label">Role</label>
                  <select className="form-select" value={form.UserType} onChange={e => setForm(p => ({ ...p, UserType: e.target.value }))}>
                    <option value="Employee">Employee</option>
                    <option value="Privilege">Admin</option>
                  </select>
                </div>
              </div>

              <input type="text" style={{ display: "none" }} aria-hidden="true" readOnly tabIndex={-1} />
              <input type="password" style={{ display: "none" }} aria-hidden="true" readOnly tabIndex={-1} />

              <div className="me-form-field">
                <label className="me-label">Email *</label>
                <input className={`form-input${formErrors.Email ? " is-error" : ""}`} type="text" inputMode="email" placeholder="juan@company.ph" value={form.Email} autoComplete="off" readOnly onFocus={e => e.currentTarget.removeAttribute("readOnly")} onChange={e => { setForm(p => ({ ...p, Email: e.target.value })); setFormErrors(p => ({ ...p, Email: undefined })); }} />
                {formErrors.Email && <span className="me-error">⚠ {formErrors.Email}</span>}
              </div>

              <div className="me-form-field">
                <label className="me-label">Password *</label>
                <input className={`form-input${formErrors.Password ? " is-error" : ""}`} type="password" placeholder="Min. 8 characters" value={form.Password} autoComplete="off" readOnly onFocus={e => e.currentTarget.removeAttribute("readOnly")} onChange={e => { setForm(p => ({ ...p, Password: e.target.value })); setFormErrors(p => ({ ...p, Password: undefined })); }} />
                {formErrors.Password && <span className="me-error">⚠ {formErrors.Password}</span>}
              </div>

              <div className="me-section-divider">Identification</div>

              <div className="me-form-field">
                <label className="me-label">Employee ID <span className="me-label-hint">(recommended)</span></label>
                <input className={`form-input${showEmployeeIdWarning && !form.EmployeeID.trim() ? " is-error" : ""}`} placeholder="e.g. EMP-001" value={form.EmployeeID} spellCheck={false} onChange={e => { setForm(p => ({ ...p, EmployeeID: e.target.value })); if (e.target.value.trim()) setShowEmployeeIdWarning(false); }} />
                <span className="me-field-hint">Used by the scanning system to identify this employee during clock-in/out.</span>
              </div>

              <div className="me-form-field">
                <label className="me-label">Proximity Card Number <span className="me-label-hint">(RFID / access card)</span></label>
                <div className="me-prox-row">
                  <input className="form-input" placeholder="e.g. 0004872631" value={form.ProximityNumber} spellCheck={false} onChange={e => setForm(p => ({ ...p, ProximityNumber: e.target.value }))} />
                  {form.ProximityNumber.trim() && (
                    <span className="me-prox-chip">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Card set
                    </span>
                  )}
                </div>
                <span className="me-field-hint">Optional. Time8out does not issue cards — assign externally if available.</span>
              </div>

              <div className="me-modal-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setShowEmployeeIdWarning(false); }}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={addLoading || showEmployeeIdWarning}>{addLoading ? "Adding…" : "Add Employee"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <EmployeeEdit employee={selected} onClose={() => setSelected(null)} onUpdated={() => fetchEmployees(companyCode!)} onDeleted={() => fetchEmployees(companyCode!)} />
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "clamp(var(--space-4), 4vw, var(--space-6))", fontFamily: "var(--font-base)", width: "100%", maxWidth: "100%", boxSizing: "border-box" },
  empty: { padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" },
  nameCell: { display: "flex", alignItems: "center", gap: "var(--space-3)" },
  avatar: { width: 32, height: 32, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  loadingWrap: { padding: "var(--space-8)" },
};