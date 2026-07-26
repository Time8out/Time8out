import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type HolidayType = "regular" | "special";

interface Holiday {
  id: string;
  Date: string;
  Name: string;
  Type: HolidayType;
  Recurring: boolean;
}

function fmtMonthDay(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-PH", { month: "long", day: "numeric" });
}

const TYPE_STYLE: Record<HolidayType, { label: string; bg: string; color: string; border: string }> = {
  regular: { label: "Regular Holiday", bg: "rgba(239,68,68,0.08)",  color: "#dc2626", border: "rgba(239,68,68,0.25)" },
  special: { label: "Special Holiday",  bg: "rgba(234,179,8,0.10)", color: "#92400e", border: "rgba(234,179,8,0.35)" },
};

export default function Holidays() {
  const [companyCode, setCompanyCode] = useState("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("regular");
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Table
  const [filter, setFilter] = useState<"all" | "regular" | "special">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users").select("CompanyCode").eq("Email", email).single();
      if (!user) { setError("Could not load user."); setLoading(false); return; }
      setCompanyCode(user.CompanyCode);
      await fetchHolidays(user.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchHolidays(code: string) {
    const { data } = await supabase.from("Holidays").select("*")
      .eq("CompanyCode", code).order("Date", { ascending: true });
    setHolidays((data ?? []) as Holiday[]);
  }

  async function handleAdd() {
    if (!date) { setMsg({ type: "error", text: "Please select a date." }); return; }
    if (!name.trim()) { setMsg({ type: "error", text: "Please enter a holiday name." }); return; }

    // Check duplicate — for recurring, match month+day; for one-time, match full date
    const dateObj = new Date(date + "T00:00:00");
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();

    const duplicate = holidays.find(h => {
      if (recurring && h.Recurring) {
        const hDate = new Date(h.Date + "T00:00:00");
        return hDate.getMonth() + 1 === month && hDate.getDate() === day;
      }
      return h.Date === date;
    });

    if (duplicate) {
      setMsg({ type: "error", text: `${duplicate.Name} is already registered on this date${recurring ? " (recurring)" : ""}.` });
      return;
    }

    setSaving(true); setMsg(null);
    const { error: e } = await supabase.from("Holidays").insert([{
      CompanyCode: companyCode,
      Date: date,
      Name: name.trim(),
      Type: type,
      Recurring: recurring,
    }]);

    if (e) {
      setMsg({ type: "error", text: e.message });
    } else {
      setMsg({ type: "success", text: `${name} added${recurring ? " as a recurring holiday" : ""}.` });
      setDate(""); setName(""); setType("regular"); setRecurring(false);
      await fetchHolidays(companyCode);
      setTimeout(() => setMsg(null), 2500);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    await supabase.from("Holidays").delete().eq("id", id);
    setHolidays(prev => prev.filter(h => h.id !== id));
    setConfirmDeleteId(null); setDeleteLoading(false);
  }

  const today = new Date().toISOString().split("T")[0];
  const filtered = holidays.filter(h => filter === "all" || h.Type === filter);
  const recurringList = filtered.filter(h => h.Recurring);
  const oneTimeList = filtered.filter(h => !h.Recurring);
  const upcoming = oneTimeList.filter(h => h.Date >= today);
  const past = oneTimeList.filter(h => h.Date < today);

  const regularCount = holidays.filter(h => h.Type === "regular").length;
  const specialCount = holidays.filter(h => h.Type === "special").length;
  const recurringCount = holidays.filter(h => h.Recurring).length;

  return (
    <>
      <style>{`
        .hol-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .hol-header{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-6)}
        .hol-kicker{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .hol-kicker-dot{width:8px;height:8px;border-radius:50%;background:var(--gradient-brand);flex-shrink:0}
        .hol-kicker-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-muted)}
        .hol-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .hol-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}
        .hol-stats{display:flex;gap:var(--space-3);flex-wrap:wrap}
        .hol-stat{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:10px 16px;box-shadow:var(--shadow-xs);text-align:center;min-width:84px;transition:box-shadow .15s,transform .15s}
        .hol-stat:hover{box-shadow:var(--shadow-sm);transform:translateY(-1px)}
        .hol-stat-icon{font-size:15px;line-height:1}
        .hol-stat-val{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);line-height:1.1}
        .hol-stat-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
        .hol-form-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:var(--space-6);box-shadow:var(--shadow-xs);transition:box-shadow .2s}
        .hol-form-card:hover{box-shadow:var(--shadow-sm)}
        .hol-form-band{height:4px;background:var(--gradient-brand)}
        .hol-form-body{padding:var(--space-5)}
        .hol-form-title{font-size:var(--font-size-base);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4);display:flex;align-items:center;gap:8px}
        .hol-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-4)}
        @media(max-width:600px){.hol-form-grid{grid-template-columns:1fr}}
        .hol-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .hol-type-toggle{display:flex;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:3px;gap:3px;margin-bottom:var(--space-3)}
        .hol-type-btn{flex:1;padding:8px 12px;border-radius:calc(var(--radius-lg) - 2px);border:none;font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);transition:all .15s;color:var(--color-text-muted);background:transparent;text-align:center}
        .hol-type-btn.regular.active{background:#fee2e2;color:#dc2626;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
        .hol-type-btn.special.active{background:#fef3c7;color:#92400e;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
        .hol-type-hint{font-size:11px;color:var(--color-text-faint);margin-bottom:var(--space-4)}

        /* Recurring toggle */
        .hol-recurring-toggle{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--color-bg-alt);border:1.5px solid var(--color-border);border-radius:var(--radius-lg);cursor:pointer;margin-bottom:var(--space-4);transition:all .15s;user-select:none}
        .hol-recurring-toggle.on{background:#e0f4fd;border-color:#bae6fd}
        .hol-recurring-toggle-switch{width:36px;height:20px;border-radius:99px;background:var(--color-border-dark);position:relative;transition:background .2s;flex-shrink:0}
        .hol-recurring-toggle.on .hol-recurring-toggle-switch{background:#0369a1}
        .hol-recurring-toggle-knob{width:14px;height:14px;border-radius:50%;background:white;position:absolute;top:3px;left:3px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
        .hol-recurring-toggle.on .hol-recurring-toggle-knob{transform:translateX(16px)}
        .hol-recurring-toggle-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text)}
        .hol-recurring-toggle-desc{font-size:11px;color:var(--color-text-muted)}
        .hol-recurring-preview{font-size:12px;color:#0369a1;background:#e0f4fd;border:1px solid #bae6fd;border-radius:var(--radius-md);padding:8px 12px;margin-bottom:var(--space-4)}

        .hol-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .hol-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .hol-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .hol-filter{display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap}
        .hol-filter-btn{padding:5px 14px;border-radius:99px;border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);color:var(--color-text-muted);transition:all .15s}
        .hol-filter-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange)}
        .hol-filter-btn.active{background:var(--color-text);color:white;border-color:var(--color-text)}
        .hol-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-faint);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)}
        .hol-section-line{flex:1;height:1px;background:var(--color-border)}
        .hol-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-6) var(--space-4);text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--color-text-faint);margin-bottom:var(--space-4)}
        .hol-empty-icon{font-size:26px;opacity:.6}
        .hol-empty-text{font-size:var(--font-size-sm);font-style:italic}
        .hol-table-wrap{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow-x:auto;margin-bottom:var(--space-5);box-shadow:var(--shadow-xs);transition:box-shadow .2s}
        .hol-table-wrap:hover{box-shadow:var(--shadow-sm)}
        .hol-table{width:100%;border-collapse:collapse;min-width:480px}
        .hol-table thead tr{border-bottom:2px solid var(--color-border)}
        .hol-table th{text-align:left;font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-muted);letter-spacing:.07em;text-transform:uppercase;padding:10px 14px;white-space:nowrap}
        .hol-table td{padding:12px 14px;font-size:var(--font-size-sm);color:var(--color-text-secondary);border-bottom:1px solid var(--color-border);vertical-align:middle}
        @media(max-width:480px){.hol-table td,.hol-table th{padding:10px 10px;font-size:var(--font-size-xs)}}
        .hol-table tbody tr:last-child td{border-bottom:none}
        .hol-table tbody tr{transition:background .12s}
        .hol-table tbody tr:hover{background:var(--color-bg)}
        .hol-type-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}
        .hol-type-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
        .hol-rec-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:700;background:#e0f4fd;border:1px solid #bae6fd;color:#0369a1;margin-left:5px}
        .hol-date-cell{font-weight:600;color:var(--color-text);white-space:nowrap;position:relative;padding-left:20px !important}
        .hol-date-cell::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:2px;background:var(--accent,var(--color-border))}
        .hol-name-cell{font-weight:600;color:var(--color-text)}
        .hol-delete-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap}
        .hol-delete-btn:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}
        .hol-confirm-row{display:flex;align-items:center;gap:6px;justify-content:flex-end}
        .hol-confirm-text{font-size:11px;color:#dc2626;font-weight:600}
        .hol-confirm-yes{padding:4px 10px;border-radius:var(--radius-md);border:none;background:#dc2626;font-size:11px;font-weight:700;color:white;cursor:pointer;font-family:var(--font-base)}
        .hol-confirm-yes:disabled{opacity:.5}
        .hol-confirm-no{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base)}
      `}</style>

      <div className="hol-page">
        <div className="hol-header">
          <div>
            <div className="hol-kicker">
              <span className="hol-kicker-dot" />
              <span className="hol-kicker-label">Payroll Settings</span>
            </div>
            <h1 className="hol-title">Holidays</h1>
            <p className="hol-sub">Manage company holidays for payroll and scheduling.</p>
          </div>

          <div className="hol-stats">
            <div className="hol-stat">
              <div className="hol-stat-icon">🔴</div>
              <div className="hol-stat-val">{regularCount}</div>
              <div className="hol-stat-label">Regular</div>
            </div>
            <div className="hol-stat">
              <div className="hol-stat-icon">🟡</div>
              <div className="hol-stat-val">{specialCount}</div>
              <div className="hol-stat-label">Special</div>
            </div>
            <div className="hol-stat">
              <div className="hol-stat-icon">🔁</div>
              <div className="hol-stat-val">{recurringCount}</div>
              <div className="hol-stat-label">Recurring</div>
            </div>
            <div className="hol-stat">
              <div className="hol-stat-icon">📅</div>
              <div className="hol-stat-val">{holidays.length}</div>
              <div className="hol-stat-label">Total</div>
            </div>
          </div>
        </div>

        {/* Add form */}
        <div className="hol-form-card">
          <div className="hol-form-band" />
          <div className="hol-form-body">
            <div className="hol-form-title">🗓️ Add Holiday</div>

            <div className="hol-form-grid">
              <div>
                <label className="hol-label">Date *</label>
                <input className="form-input" type="date" value={date}
                  onChange={e => { setDate(e.target.value); setMsg(null); }} />
              </div>
              <div>
                <label className="hol-label">Holiday Name *</label>
                <input className="form-input" placeholder="e.g. Christmas Day"
                  value={name} onChange={e => { setName(e.target.value); setMsg(null); }}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); }} />
              </div>
            </div>

            <div className="hol-type-toggle">
              <button className={`hol-type-btn regular${type === "regular" ? " active" : ""}`} onClick={() => setType("regular")}>🔴 Regular Holiday</button>
              <button className={`hol-type-btn special${type === "special" ? " active" : ""}`} onClick={() => setType("special")}>🟡 Special Holiday</button>
            </div>
            <div className="hol-type-hint">
              {type === "regular" ? "Paid even if the employee doesn't work (e.g. Christmas, New Year)." : "Paid only if the employee works (e.g. Special Non-Working Day)."}
            </div>

            {/* Recurring toggle */}
            <div className={`hol-recurring-toggle${recurring ? " on" : ""}`} onClick={() => setRecurring(p => !p)}>
              <div className="hol-recurring-toggle-switch">
                <div className="hol-recurring-toggle-knob" />
              </div>
              <div>
                <div className="hol-recurring-toggle-label">🔁 Recurring every year</div>
                <div className="hol-recurring-toggle-desc">Automatically applies on the same date every year</div>
              </div>
            </div>

            {recurring && date && name && (
              <div className="hol-recurring-preview">
                🔁 <strong>{name}</strong> will be treated as a <strong>{TYPE_STYLE[type].label}</strong> every <strong>{fmtMonthDay(date)}</strong> automatically — year is ignored.
              </div>
            )}

            {msg && <div className={`hol-alert ${msg.type}`}>{msg.text}</div>}

            <button className="btn btn-primary btn-sm" onClick={handleAdd}
              disabled={saving || !date || !name.trim()} style={{ minWidth: 140 }}>
              {saving ? "Saving…" : "+ Add Holiday"}
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="hol-filter">
          {(["all", "regular", "special"] as const).map(f => (
            <button key={f} className={`hol-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All Types" : TYPE_STYLE[f].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="hol-empty"><span className="hol-empty-icon">⏳</span><span className="hol-empty-text">Loading…</span></div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <>
            {/* Recurring */}
            {recurringList.length > 0 && (
              <>
                <div className="hol-section-label">🔁 Recurring Every Year <div className="hol-section-line" /></div>
                <HolidayTable holidays={recurringList} confirmDeleteId={confirmDeleteId} deleteLoading={deleteLoading}
                  onConfirmDelete={setConfirmDeleteId} onDelete={handleDelete} showRecurring />
              </>
            )}

            {/* Upcoming one-time */}
            {upcoming.length > 0 && (
              <>
                <div className="hol-section-label" style={{ marginTop: recurringList.length ? "var(--space-4)" : 0 }}>
                  📅 Upcoming <div className="hol-section-line" />
                </div>
                <HolidayTable holidays={upcoming} confirmDeleteId={confirmDeleteId} deleteLoading={deleteLoading}
                  onConfirmDelete={setConfirmDeleteId} onDelete={handleDelete} />
              </>
            )}

            {/* Past one-time */}
            {past.length > 0 && (
              <>
                <div className="hol-section-label" style={{ marginTop: "var(--space-4)" }}>Past <div className="hol-section-line" /></div>
                <HolidayTable holidays={past} confirmDeleteId={confirmDeleteId} deleteLoading={deleteLoading}
                  onConfirmDelete={setConfirmDeleteId} onDelete={handleDelete} muted />
              </>
            )}

            {filtered.length === 0 && (
              <div className="hol-empty">
                <span className="hol-empty-icon">🎉</span>
                <span className="hol-empty-text">No holidays registered yet.</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function HolidayTable({ holidays, confirmDeleteId, deleteLoading, onConfirmDelete, onDelete, muted = false, showRecurring = false }: {
  holidays: Holiday[];
  confirmDeleteId: string | null;
  deleteLoading: boolean;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
  muted?: boolean;
  showRecurring?: boolean;
}) {
  return (
    <div className="hol-table-wrap" style={muted ? { opacity: 0.65 } : {}}>
      <table className="hol-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Holiday</th>
            <th>Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {holidays.map(h => {
            const style = TYPE_STYLE[h.Type];
            const dateDisplay = showRecurring
              ? `🔁 Every ${new Date(h.Date + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric" })}`
              : new Date(h.Date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
            return (
              <tr key={h.id}>
                <td className="hol-date-cell" style={{ "--accent": style.color } as React.CSSProperties}>{dateDisplay}</td>
                <td className="hol-name-cell">{h.Name}</td>
                <td>
                  <span className="hol-type-badge" style={{ background: style.bg, color: style.color, borderColor: style.border }}>
                    {style.label}
                  </span>
                  {h.Recurring && !showRecurring && <span className="hol-rec-badge">🔁 recurring</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  {confirmDeleteId === h.id ? (
                    <div className="hol-confirm-row">
                      <span className="hol-confirm-text">Remove?</span>
                      <button className="hol-confirm-yes" disabled={deleteLoading} onClick={() => onDelete(h.id)}>{deleteLoading ? "…" : "Yes"}</button>
                      <button className="hol-confirm-no" onClick={() => onConfirmDelete(null)}>No</button>
                    </div>
                  ) : (
                    <button className="hol-delete-btn" onClick={() => onConfirmDelete(h.id)}>Remove</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}