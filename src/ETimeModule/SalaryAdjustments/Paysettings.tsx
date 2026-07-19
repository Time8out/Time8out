import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase";
import type { Employee } from "../../ETimeModule/EmployeeEdit";

const CURRENCIES = [
  { value: "$", label: "$ — US Dollar" },
  { value: "₱", label: "₱ — Philippine Peso" },
];

const STRUCTURES = [
  { value: "Monthly", label: "Monthly", desc: "Fixed monthly salary" },
  { value: "Hourly",  label: "Hourly",  desc: "Rate per hour worked" },
  { value: "Daily",   label: "Daily",   desc: "Rate per day worked"  },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hh = String(i).padStart(2, "0");
  return { value: `${hh}:00`, label: `${hh}:00` };
});

type OTKey = "PartTimeOT" | "RestDayOT" | "RegularHolidayOT" | "SpecialHolidayOT";

type OTSetting = {
  enabled: boolean;
  rate: string;
};

const OT_TYPES: { key: OTKey; label: string; sub: string }[] = [
  { key: "PartTimeOT",         label: "Part-time OT",       sub: "Extra hours beyond part-time contract"   },
  { key: "RestDayOT",          label: "Rest Day OT",         sub: "Work rendered on scheduled rest days"    },
  { key: "RegularHolidayOT",   label: "Regular Holiday OT",  sub: "Work rendered on regular public holidays" },
  { key: "SpecialHolidayOT",   label: "Special Holiday OT",  sub: "Work rendered on special non-working days" },
];

const DEFAULT_OT: Record<OTKey, OTSetting> = {
  PartTimeOT:       { enabled: false, rate: "25" },
  RestDayOT:        { enabled: false, rate: "30" },
  RegularHolidayOT: { enabled: false, rate: "100" },
  SpecialHolidayOT: { enabled: false, rate: "30" },
};

export default function PaySettings() {
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selected, setSelected]       = useState<Employee | null>(null);

  const [structure, setStructure]   = useState("Monthly");
  const [rate, setRate]             = useState("");
  const [currency, setCurrency]     = useState("₱");
  const [ndEnabled, setNdEnabled]   = useState(false);
  const [ndRate, setNdRate]         = useState("10");
  const [ndStart, setNdStart]       = useState("22:00");
  const [ndEnd, setNdEnd]           = useState("06:00");
  const [otSettings, setOtSettings] = useState<Record<OTKey, OTSetting>>(DEFAULT_OT);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users").select("CompanyCode").eq("Email", email).single();
      if (!user) { setError("Could not load user."); setLoading(false); return; }
      setCompanyCode(user.CompanyCode);
      const { data } = await supabase.from("users").select("*").eq("CompanyCode", user.CompanyCode).order("FirstName", { ascending: true });
      setEmployees(data ?? []);
      setLoading(false);
    }
    bootstrap();
  }, []);

  function openEmployee(emp: Employee) {
    setSelected(emp);
    setMsg(null);
    const ps = (emp as any).PayStructure?.[0];
    setStructure(ps?.Structure ?? "Monthly");
    setRate(ps?.Formula ?? "");
    setCurrency((emp as any).Currency ?? "₱");

    // Night differential
    if (ps?.NightDiffRate) {
      setNdEnabled(true);
      setNdRate(String(ps.NightDiffRate).replace("%", ""));
      const [start, end] = (ps.NightDiffTimeSpan ?? "22:00-06:00").split("-");
      setNdStart(start?.trim() ?? "22:00");
      setNdEnd(end?.trim() ?? "06:00");
    } else {
      setNdEnabled(false);
      setNdRate("10");
      setNdStart("22:00");
      setNdEnd("06:00");
    }

    // OT settings
    const loaded: Record<OTKey, OTSetting> = { ...DEFAULT_OT };
    for (const { key } of OT_TYPES) {
      if (ps?.[key]) {
        loaded[key] = {
          enabled: true,
          rate: String(ps[key]).replace("%", ""),
        };
      }
    }
    setOtSettings(loaded);
  }

  function setOtField(key: OTKey, field: keyof OTSetting, value: boolean | string) {
    setOtSettings(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave() {
    if (!rate.trim() || isNaN(Number(rate))) {
      setMsg({ type: "error", text: "Please enter a valid rate." }); return;
    }
    if (ndEnabled && (isNaN(Number(ndRate)) || Number(ndRate) <= 0)) {
      setMsg({ type: "error", text: "Please enter a valid night differential rate." }); return;
    }
    for (const { key, label } of OT_TYPES) {
      const ot = otSettings[key];
      if (ot.enabled && (isNaN(Number(ot.rate)) || Number(ot.rate) <= 0)) {
        setMsg({ type: "error", text: `Please enter a valid rate for ${label}.` }); return;
      }
    }

    setSaving(true); setMsg(null);

    const payStructure: Record<string, string> = { Structure: structure, Formula: rate.trim() };

    if (ndEnabled) {
      payStructure.NightDiffRate     = `${ndRate}%`;
      payStructure.NightDiffTimeSpan = `${ndStart}-${ndEnd}`;
    }

    for (const { key } of OT_TYPES) {
      const ot = otSettings[key];
      if (ot.enabled) {
        payStructure[key] = `${ot.rate}%`;
      }
    }

    const { error: e } = await supabase.from("users").update({
      PayStructure: [payStructure],
      Currency: currency,
    }).eq("Email", (selected as any).Email);

    if (e) { setMsg({ type: "error", text: e.message }); }
    else {
      setMsg({ type: "success", text: "Pay settings saved!" });
      const { data } = await supabase.from("users").select("*").eq("CompanyCode", companyCode!).order("FirstName", { ascending: true });
      setEmployees(data ?? []);
      setTimeout(() => { setSelected(null); setMsg(null); }, 1200);
    }
    setSaving(false);
  }

  function getPaySummary(emp: any): string {
    const ps = emp.PayStructure?.[0];
    const cur = emp.Currency ?? "$";
    if (!ps) return "Not set";
    let base = `${ps.Structure} · ${cur}${ps.Formula}`;
    if (ps.NightDiffRate) base += ` · ND ${ps.NightDiffRate}`;
    const otOn = OT_TYPES.filter(({ key }) => ps[key]).map(({ label }) => label.split(" ")[0]);
    if (otOn.length) base += ` · OT: ${otOn.join(", ")}`;
    return base;
  }

  return (
    <>
      <style>{`
        .ps-page{padding:var(--space-6);font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .ps-header{margin-bottom:var(--space-6)}
        .ps-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .ps-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}
        .ps-table-wrap{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-sm)}
        .ps-table{width:100%;border-collapse:collapse}
        .ps-table thead tr{border-bottom:2px solid var(--color-border)}
        .ps-table th{text-align:left;font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-muted);letter-spacing:.07em;text-transform:uppercase;padding:10px 14px;white-space:nowrap}
        .ps-table td{padding:12px 14px;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border);vertical-align:middle}
        .ps-table tbody tr{cursor:pointer;transition:background var(--transition-fast)}
        .ps-table tbody tr:hover{background:var(--brand-orange-light)}
        .ps-table tbody tr:hover td{color:var(--color-text)}
        .ps-table tbody tr:last-child td{border-bottom:none}
        .ps-pay-set{font-family:monospace;font-size:12px;color:var(--color-text)}
        .ps-pay-unset{font-size:12px;color:#b45309;font-weight:600}
        .ps-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid}
        .ps-badge.owner{background:var(--brand-orange-muted);color:var(--brand-orange-dark);border-color:var(--brand-orange)}
        .ps-badge.admin{background:var(--brand-blue-muted);color:var(--brand-blue-dark);border-color:var(--brand-blue)}
        .ps-badge.employee{background:var(--color-bg-alt);color:var(--color-text-muted);border-color:var(--color-border)}
        .pse-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:300;animation:pseFade .15s ease;padding:16px}
        @keyframes pseFade{from{opacity:0}to{opacity:1}}
        .pse-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:460px;animation:pseUp .2s cubic-bezier(.22,1,.36,1);overflow:hidden;max-height:90vh;display:flex;flex-direction:column}
        @keyframes pseUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .pse-band{height:4px;background:var(--gradient-brand);flex-shrink:0}
        .pse-body{padding:var(--space-6);overflow-y:auto;display:flex;flex-direction:column;gap:0}
        .pse-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:var(--space-5);letter-spacing:-.01em}
        .pse-emp-row{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);margin-bottom:var(--space-5)}
        .pse-emp-avatar{width:34px;height:34px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;flex-shrink:0}
        .pse-emp-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .pse-emp-id{font-size:var(--font-size-xs);color:var(--color-text-muted)}
        .pse-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .pse-structure-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-bottom:var(--space-4)}
        .pse-structure-card{padding:var(--space-3);border-radius:var(--radius-lg);border:1.5px solid var(--color-border);cursor:pointer;transition:all .15s;text-align:center;background:var(--color-white)}
        .pse-structure-card:hover{border-color:var(--brand-orange);background:var(--brand-orange-light)}
        .pse-structure-card.active{border-color:var(--brand-orange);background:var(--brand-orange-light)}
        .pse-structure-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .pse-structure-desc{font-size:10px;color:var(--color-text-muted)}
        .pse-rate-row{display:flex;gap:var(--space-2);margin-bottom:var(--space-4)}
        .pse-currency-select{width:90px;flex-shrink:0}
        .pse-rate-hint{font-size:12px;color:var(--color-text-muted);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:8px 12px;margin-bottom:var(--space-4);font-family:monospace}
        .pse-section-divider{height:1px;background:var(--color-border);margin:var(--space-4) 0}
        .pse-nd-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .pse-nd-label{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);display:block}
        .pse-nd-sub{font-size:11px;color:var(--color-text-muted);display:block;margin-top:2px}
        .pse-toggle{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;display:inline-block}
        .pse-toggle input{opacity:0;width:0;height:0;position:absolute}
        .pse-toggle-track{position:absolute;inset:0;border-radius:99px;background:var(--color-border);transition:background .2s}
        .pse-toggle input:checked + .pse-toggle-track{background:var(--brand-orange)}
        .pse-toggle-thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:white;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s;pointer-events:none}
        .pse-toggle input:checked ~ .pse-toggle-thumb{transform:translateX(18px)}
        .pse-nd-body{display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-2)}
        .pse-nd-field-label{font-size:11px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:var(--space-1)}
        .pse-nd-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)}
        .pse-nd-preview{background:#fef3c7;border:1px solid #fde68a;border-radius:var(--radius-md);padding:var(--space-2) var(--space-3);font-size:12px;color:#92400e;font-family:monospace}
        .pse-ot-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0;border-bottom:1px solid var(--color-border)}
        .pse-ot-row:last-child{border-bottom:none}
        .pse-ot-info{flex:1;min-width:0}
        .pse-ot-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text)}
        .pse-ot-sub{font-size:11px;color:var(--color-text-muted);margin-top:2px}
        .pse-ot-rate-wrap{display:flex;align-items:center;gap:6px;margin-left:var(--space-3);flex-shrink:0}
        .pse-ot-rate-input{width:64px;text-align:right;padding:4px 8px;border:1.5px solid var(--color-border);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-family:monospace;color:var(--color-text);background:var(--color-white);transition:border-color .15s}
        .pse-ot-rate-input:focus{outline:none;border-color:var(--brand-orange)}
        .pse-ot-rate-input:disabled{background:var(--color-bg-alt);color:var(--color-text-muted);cursor:not-allowed}
        .pse-ot-pct{font-size:var(--font-size-sm);color:var(--color-text-muted);font-weight:600}
        .pse-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-top:var(--space-3)}
        .pse-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .pse-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .pse-footer{display:flex;justify-content:flex-end;gap:var(--space-3);padding-top:var(--space-4);margin-top:var(--space-3);border-top:1px solid var(--color-border)}
      `}</style>

      <div className="ps-page">
        <div className="ps-header">
          <h1 className="ps-title">Pay Settings</h1>
          <p className="ps-sub">Set pay structure and currency for each employee.</p>
        </div>

        {loading ? (
          <div style={{ padding: "var(--space-8)" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />)}
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Pay Structure</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={i} onClick={() => openEmployee(emp)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {emp.FirstName?.[0]}{emp.LastName?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{emp.FirstName} {emp.LastName}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{emp.Email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`ps-badge ${emp.UserType === "Special" ? "owner" : emp.UserType === "Privilege" ? "admin" : "employee"}`}>
                        {emp.UserType === "Special" ? "Owner" : emp.UserType === "Privilege" ? "Admin" : "Employee"}
                      </span>
                    </td>
                    <td>
                      {(emp as any).PayStructure?.[0]
                        ? <span className="ps-pay-set">{getPaySummary(emp)}</span>
                        : <span className="ps-pay-unset">⚠ Not set</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="pse-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="pse-modal">
            <div className="pse-band" />
            <div className="pse-body">
              <div className="pse-title">Pay Settings</div>

              <div className="pse-emp-row">
                <div className="pse-emp-avatar">{selected.FirstName?.[0]}{selected.LastName?.[0]}</div>
                <div>
                  <div className="pse-emp-name">{selected.FirstName} {selected.LastName}</div>
                  <div className="pse-emp-id">ID: {(selected as any).EmployeeID ?? "Not set"}</div>
                </div>
              </div>

              {/* ── Pay Structure ── */}
              <label className="pse-label">Pay Structure</label>
              <div className="pse-structure-grid">
                {STRUCTURES.map(s => (
                  <div key={s.value} className={`pse-structure-card${structure === s.value ? " active" : ""}`} onClick={() => setStructure(s.value)}>
                    <div className="pse-structure-name">{s.label}</div>
                    <div className="pse-structure-desc">{s.desc}</div>
                  </div>
                ))}
              </div>

              <label className="pse-label">Rate & Currency</label>
              <div className="pse-rate-row">
                <select className="form-select pse-currency-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input
                  className="form-input"
                  type="number"
                  placeholder={structure === "Monthly" ? "e.g. 15000" : structure === "Hourly" ? "e.g. 95" : "e.g. 500"}
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>

              {rate && !isNaN(Number(rate)) && (
                <div className="pse-rate-hint">
                  {structure === "Monthly" && `Flat ${currency}${Number(rate).toLocaleString()} per month`}
                  {structure === "Hourly"  && `${currency}${Number(rate).toLocaleString()} per hour worked`}
                  {structure === "Daily"   && `${currency}${Number(rate).toLocaleString()} per day worked`}
                </div>
              )}

              {/* ── Night Differential ── */}
              <div className="pse-section-divider" />

              <div className="pse-nd-header">
                <div>
                  <span className="pse-nd-label">🌙 Night Differential</span>
                  <span className="pse-nd-sub">Extra pay for hours worked at night</span>
                </div>
                <label className="pse-toggle">
                  <input type="checkbox" checked={ndEnabled} onChange={e => setNdEnabled(e.target.checked)} />
                  <div className="pse-toggle-track" />
                  <div className="pse-toggle-thumb" />
                </label>
              </div>

              {ndEnabled && (
                <div className="pse-nd-body">
                  <div>
                    <span className="pse-nd-field-label">Premium rate</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        max="100"
                        value={ndRate}
                        onChange={e => setNdRate(e.target.value)}
                        style={{ width: 90 }}
                      />
                      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 600 }}>%</span>
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>above base rate</span>
                    </div>
                  </div>

                  <div>
                    <span className="pse-nd-field-label">Night hours window</span>
                    <div className="pse-nd-row">
                      <div>
                        <span className="pse-nd-field-label">From</span>
                        <select className="form-select" value={ndStart} onChange={e => setNdStart(e.target.value)}>
                          {HOUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <span className="pse-nd-field-label">To</span>
                        <select className="form-select" value={ndEnd} onChange={e => setNdEnd(e.target.value)}>
                          {HOUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {rate && !isNaN(Number(rate)) && !isNaN(Number(ndRate)) && (
                    <div className="pse-nd-preview">
                      {ndStart} – {ndEnd} &nbsp;·&nbsp; base {currency}{Number(rate).toLocaleString()}/hr &nbsp;→&nbsp; ND rate {currency}{(Number(rate) * (1 + Number(ndRate) / 100)).toFixed(2)}/hr
                    </div>
                  )}
                </div>
              )}

              {/* ── Overtime ── */}
              <div className="pse-section-divider" />

              <div className="pse-nd-header" style={{ marginBottom: "var(--space-1)" }}>
                <div>
                  <span className="pse-nd-label">⏱ Overtime Pay</span>
                  <span className="pse-nd-sub">Enable OT types and set premium rates</span>
                </div>
              </div>

              <div style={{ marginBottom: "var(--space-2)" }}>
                {OT_TYPES.map(({ key, label, sub }) => {
                  const ot = otSettings[key];
                  return (
                    <div className="pse-ot-row" key={key}>
                      <div className="pse-ot-info">
                        <div className="pse-ot-label">{label}</div>
                        <div className="pse-ot-sub">{sub}</div>
                      </div>
                      <div className="pse-ot-rate-wrap">
                        <input
                          className="pse-ot-rate-input"
                          type="number"
                          min="1"
                          max="999"
                          value={ot.rate}
                          disabled={!ot.enabled}
                          onChange={e => setOtField(key, "rate", e.target.value)}
                        />
                        <span className="pse-ot-pct">%</span>
                        <label className="pse-toggle" style={{ marginLeft: 6 }}>
                          <input
                            type="checkbox"
                            checked={ot.enabled}
                            onChange={e => setOtField(key, "enabled", e.target.checked)}
                          />
                          <div className="pse-toggle-track" />
                          <div className="pse-toggle-thumb" />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {msg && <div className={`pse-alert ${msg.type}`}>{msg.text}</div>}

              <div className="pse-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !rate.trim()}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}