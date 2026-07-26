import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import Deduction from "./SalaryAdjustments/Deduction";
import BonusesAndIncentives from "./SalaryAdjustments/BonusesAndIncentives";
import type { Employee } from "./EmployeeEdit";

type ActionModal = "deduction" | "bonuses" | null;

export default function SalaryAdjustments() {
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [showActionPicker, setShowActionPicker] = useState(false);

  useEffect(() => {
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

  function handleRowClick(emp: Employee) {
    setSelectedEmployee(emp);
    setShowActionPicker(true);
    setActionModal(null);
  }

  function handleActionSelect(action: "deduction" | "bonuses") {
    setShowActionPicker(false);
    setActionModal(action);
  }

  function handleClose() {
    setSelectedEmployee(null);
    setActionModal(null);
    setShowActionPicker(false);
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
        .sa-table-wrap { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
        .sa-table { width: 100%; border-collapse: collapse; }
        .sa-table thead tr { border-bottom: 2px solid var(--color-border); }
        .sa-table th { text-align: left; font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.07em; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
        .sa-table td { padding: 13px 14px; font-size: var(--font-size-sm); color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
        .sa-table tbody tr { cursor: pointer; transition: background var(--transition-fast); }
        .sa-table tbody tr:hover { background: var(--brand-orange-light); }
        .sa-table tbody tr:hover td { color: var(--color-text); }
        @media (max-width: 640px) { .sa-col-email { display: none; } }
        @media (max-width: 480px) { .sa-col-empid { display: none; } .sa-table th, .sa-table td { padding: 11px 10px; } }

        .sa-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-6); gap: var(--space-4); flex-wrap: wrap; }
        .sa-header-text { min-width: 0; }
        .sa-title { font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-bottom: 4px; }
        @media (max-width: 480px) { .sa-title { font-size: var(--font-size-xl); } }
        .sa-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
        .sa-code { background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; font-size: var(--font-size-xs); font-family: monospace; color: var(--brand-orange); }

        .sa-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }
        .sa-badge.owner { background: var(--brand-orange-muted); color: var(--brand-orange-dark); }
        .sa-badge.admin { background: var(--brand-blue-muted); color: var(--brand-blue-dark); }
        .sa-badge.employee { background: var(--color-bg-alt); color: var(--color-text-muted); }
        .sa-id-value { font-family: monospace; font-size: var(--font-size-xs); background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; color: var(--color-text-secondary); }
        .sa-id-missing { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #b45309; font-weight: 600; }

        /* Action Picker Overlay */
        .sa-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 200; animation: saFadeIn 0.15s ease; padding: 16px; }
        @keyframes saFadeIn { from{opacity:0} to{opacity:1} }
        .sa-picker { background: var(--color-white); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); width: 100%; max-width: 380px; animation: saSlideUp 0.2s cubic-bezier(0.22,1,0.36,1); overflow: hidden; }
        @keyframes saSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .sa-picker-band { height: 4px; background: var(--gradient-brand); }
        .sa-picker-body { padding: var(--space-6); }
        .sa-picker-emp { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-5); padding-bottom: var(--space-5); border-bottom: 1px solid var(--color-border); }
        .sa-picker-emp-name { font-size: var(--font-size-base); font-weight: 700; color: var(--color-text); line-height: 1.3; }
        .sa-picker-emp-sub { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px; }
        .sa-picker-label { font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: var(--space-3); }
        .sa-action-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .sa-action-btn { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-lg); border: 1.5px solid var(--color-border); background: var(--color-white); cursor: pointer; transition: all var(--transition-fast); text-align: left; font-family: var(--font-base); width: 100%; }
        .sa-action-btn:hover { border-color: transparent; transform: translateY(-1px); box-shadow: var(--shadow-md); }
        .sa-action-btn.deduction:hover { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.3); }
        .sa-action-btn.bonuses:hover { background: rgba(34,197,94,0.06); border-color: rgba(34,197,94,0.3); }
        .sa-action-icon { width: 36px; height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sa-action-icon.deduction { background: rgba(239,68,68,0.1); }
        .sa-action-icon.bonuses { background: rgba(34,197,94,0.1); }
        .sa-action-title { font-size: var(--font-size-sm); font-weight: 700; color: var(--color-text); line-height: 1.3; }
        .sa-action-desc { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 1px; }
        .sa-picker-footer { padding: var(--space-4) var(--space-6); border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; }
      `}</style>

      <div style={s.page}>
        <div className="sa-header">
          <div className="sa-header-text">
            <h1 className="sa-title">Salary Adjustments</h1>
            <p className="sa-subtitle">
              Company: <strong>{companyName}</strong> · Code: <code className="sa-code">{companyCode}</code>
            </p>
          </div>
        </div>

        <div className="sa-table-wrap">
          {employees.length === 0 ? (
            <div style={s.empty}>No employees found under this company code.</div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="sa-col-empid">Employee ID</th>
                  <th className="sa-col-email">Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={i} onClick={() => handleRowClick(emp)}>
                    <td>
                      <div style={s.nameCell}>
                        <div style={s.avatar}>{emp.FirstName?.[0]}{emp.LastName?.[0]}</div>
                        <span>{emp.FirstName} {emp.LastName}</span>
                      </div>
                    </td>
                    <td className="sa-col-empid">
                      {emp.EmployeeID?.trim()
                        ? <span className="sa-id-value">{emp.EmployeeID}</span>
                        : <span className="sa-id-missing">⚠ Not set</span>}
                    </td>
                    <td className="sa-col-email">{emp.Email}</td>
                    <td>
                      <span className={`sa-badge ${emp.UserType === "Special" ? "owner" : emp.UserType === "Privilege" ? "admin" : "employee"}`}>
                        {emp.UserType === "Special" ? "Owner" : emp.UserType === "Privilege" ? "Admin" : "Employee"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── ACTION PICKER MODAL ── */}
      {showActionPicker && selectedEmployee && (
        <div className="sa-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
          <div className="sa-picker">
            <div className="sa-picker-band" />
            <div className="sa-picker-body">
              <div className="sa-picker-emp">
                <div style={s.avatar}>{selectedEmployee.FirstName?.[0]}{selectedEmployee.LastName?.[0]}</div>
                <div>
                  <div className="sa-picker-emp-name">{selectedEmployee.FirstName} {selectedEmployee.LastName}</div>
                  <div className="sa-picker-emp-sub">
                    {selectedEmployee.EmployeeID?.trim() ? selectedEmployee.EmployeeID : "No Employee ID"} · {selectedEmployee.Email}
                  </div>
                </div>
              </div>

              <div className="sa-picker-label">Select Adjustment Type</div>
              <div className="sa-action-list">
                <button className="sa-action-btn deduction" onClick={() => handleActionSelect("deduction")}>
                  <div className="sa-action-icon deduction">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  <div>
                    <div className="sa-action-title">Add Deduction</div>
                    <div className="sa-action-desc">Late, absent, loans, or other salary deductions</div>
                  </div>
                </button>

                <button className="sa-action-btn bonuses" onClick={() => handleActionSelect("bonuses")}>
                  <div className="sa-action-icon bonuses">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  <div>
                    <div className="sa-action-title">Add Bonuses & Incentives</div>
                    <div className="sa-action-desc">Performance bonuses, allowances, or extra pay</div>
                  </div>
                </button>
              </div>
            </div>
            <div className="sa-picker-footer">
              <button className="btn btn-ghost btn-sm" onClick={handleClose}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEDUCTION MODAL ── */}
      {actionModal === "deduction" && selectedEmployee && (
        <Deduction
          employee={selectedEmployee}
          onClose={handleClose}
        />
      )}

      {/* ── BONUSES & INCENTIVES MODAL ── */}
      {actionModal === "bonuses" && selectedEmployee && (
        <BonusesAndIncentives
          employee={selectedEmployee}
          onClose={handleClose}
        />
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