import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type OTType = "pre_shift" | "post_shift" | "rest_day";

interface OTRequest {
  id: string;
  Date: string;
  OTType: OTType;
  OTStart: string;
  OTEnd: string;
  OTHours: number;
  ScheduledTimeIn: string | null;
  ScheduledTimeOut: string | null;
  Status: "pending" | "approved" | "rejected";
  AdminNote: string | null;
  CreatedAt: string;
}

interface ShiftSlot {
  timeIn: string;
  TimeOut: string;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function diffHours(start: string, end: string): number {
  let s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e <= s) e += 1440;
  return Math.round(((e - s) / 60) * 100) / 100;
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

const OT_TYPES: { key: OTType; label: string; icon: string; desc: string; color: string; bg: string; border: string }[] = [
  {
    key: "pre_shift",
    label: "Pre-Shift OT",
    icon: "🌅",
    desc: "Work before your scheduled time-in",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  {
    key: "post_shift",
    label: "Post-Shift OT",
    icon: "🌆",
    desc: "Work after your scheduled time-out",
    color: "var(--brand-orange-dark)",
    bg: "var(--brand-orange-light)",
    border: "var(--brand-orange-muted)",
  },
  {
    key: "rest_day",
    label: "Rest Day OT",
    icon: "📅",
    desc: "Work on your day off",
    color: "#0369a1",
    bg: "#e0f4fd",
    border: "#bae6fd",
  },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: "rgba(234,179,8,0.08)",  color: "#92400e", border: "rgba(234,179,8,0.35)",  label: "Pending" },
  approved: { bg: "var(--color-success-light)", color: "var(--color-success)", border: "rgba(22,163,74,0.25)", label: "Approved" },
  rejected: { bg: "var(--color-danger-light)",  color: "var(--color-danger)",  border: "rgba(220,38,38,0.25)",  label: "Rejected" },
};

export default function Overtime() {
  const [employeeID, setEmployeeID] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [otType, setOtType] = useState<OTType>("pre_shift");
  const [date, setDate] = useState("");
  const [otStart, setOtStart] = useState("");
  const [otEnd, setOtEnd] = useState("");
  const [fetchingSchedule, setFetchingSchedule] = useState(false);
  const [currentShift, setCurrentShift] = useState<ShiftSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // History
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data, error: e } = await supabase
        .from("users")
        .select("EmployeeID, FirstName, LastName, CompanyCode")
        .eq("Email", email)
        .single();
      if (e || !data) { setError("Could not load user."); setLoading(false); return; }
      setEmployeeID(data.EmployeeID ?? "");
      setEmployeeName(`${data.FirstName} ${data.LastName}`);
      setCompanyCode(data.CompanyCode ?? "");
      await fetchRequests(data.EmployeeID, data.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchRequests(empID: string, code: string) {
    setLoadingRequests(true);
    const { data } = await supabase
      .from("OvertimeRequests")
      .select("*")
      .eq("EmployeeID", empID)
      .eq("CompanyCode", code)
      .order("CreatedAt", { ascending: false });
    setRequests((data as OTRequest[]) ?? []);
    setLoadingRequests(false);
  }

  // Fetch current schedule when date changes (for pre/post shift)
  useEffect(() => {
    if (!date || otType === "rest_day" || !employeeID || !companyCode) {
      setCurrentShift(null);
      return;
    }
    fetchScheduleForDate();
  }, [date, otType, employeeID, companyCode]);

  async function fetchScheduleForDate() {
    setFetchingSchedule(true);
    setCurrentShift(null);

    // Check OverrideSchedules first
    const { data: override } = await supabase
      .from("OverrideSchedules")
      .select("Schedules")
      .eq("EmployeeID", employeeID)
      .eq("CompanyCode", companyCode)
      .eq("DateCoverage", date)
      .maybeSingle();

    if (override?.Schedules) {
      const slots: ShiftSlot[] = typeof override.Schedules === "string"
        ? JSON.parse(override.Schedules)
        : override.Schedules;
      if (slots[0]) { setCurrentShift({ timeIn: slots[0].timeIn, TimeOut: slots[0].TimeOut }); setFetchingSchedule(false); return; }
    }

    // Fall back to regular schedule
    const { data: user } = await supabase
      .from("users").select("ScheduleID").eq("EmployeeID", employeeID).eq("CompanyCode", companyCode).single();
    if (!user?.ScheduleID) { setFetchingSchedule(false); return; }

    const { data: sched } = await supabase
      .from("Schedules").select("Schedule").eq("id", user.ScheduleID).single();
    if (sched?.Schedule) {
      const slots: ShiftSlot[] = typeof sched.Schedule === "string" ? JSON.parse(sched.Schedule) : sched.Schedule;
      if (slots[0]) setCurrentShift({ timeIn: slots[0].timeIn, TimeOut: slots[0].TimeOut });
    }
    setFetchingSchedule(false);
  }

  // Auto-fill OT start/end based on type and current shift
  useEffect(() => {
    if (!currentShift) return;
    if (otType === "pre_shift") {
      setOtEnd(currentShift.timeIn);
      setOtStart("");
    } else if (otType === "post_shift") {
      setOtStart(currentShift.TimeOut);
      setOtEnd("");
    }
  }, [currentShift, otType]);

  const otHours = otStart && otEnd ? diffHours(otStart, otEnd) : 0;

  // Compute what the new schedule will look like
  function getNewSchedulePreview(): { timeIn: string; TimeOut: string } | null {
    if (!currentShift || otType === "rest_day") return null;
    if (otType === "pre_shift" && otStart) {
      return { timeIn: otStart, TimeOut: currentShift.TimeOut };
    }
    if (otType === "post_shift" && otEnd) {
      return { timeIn: currentShift.timeIn, TimeOut: otEnd };
    }
    return null;
  }

  const newSchedule = getNewSchedulePreview();

  async function handleSubmit() {
    if (!date) { setMsg({ type: "error", text: "Please select a date." }); return; }
    if (!otStart || !otEnd) { setMsg({ type: "error", text: "Please enter OT start and end times." }); return; }
    if (otHours <= 0) { setMsg({ type: "error", text: "OT end time must be after start time." }); return; }
    if (otType !== "rest_day" && !currentShift) { setMsg({ type: "error", text: "Could not find your schedule for this date." }); return; }

    setSubmitting(true); setMsg(null);

    const { error: e } = await supabase.from("OvertimeRequests").insert([{
      EmployeeID: employeeID,
      CompanyCode: companyCode,
      EmployeeName: employeeName,
      Date: date,
      OTType: otType,
      OTStart: otStart,
      OTEnd: otEnd,
      OTHours: otHours,
      ScheduledTimeIn: currentShift?.timeIn ?? null,
      ScheduledTimeOut: currentShift?.TimeOut ?? null,
      Status: "pending",
    }]);

    if (e) {
      setMsg({ type: "error", text: e.message });
    } else {
      setMsg({ type: "success", text: "OT request submitted! Waiting for admin approval." });
      setDate(""); setOtStart(""); setOtEnd(""); setCurrentShift(null);
      await fetchRequests(employeeID, companyCode);
      setTimeout(() => setMsg(null), 3000);
    }
    setSubmitting(false);
  }

  if (loading) return (
    <div style={s.page}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  );

  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;

  const otTypeDef = OT_TYPES.find(t => t.key === otType)!;

  return (
    <>
      <style>{`
        .ot-page{padding:var(--space-6);font-family:var(--font-base);width:100%;max-width:680px;box-sizing:border-box}
        .ot-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .ot-sub{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-6)}

        /* Type selector */
        .ot-type-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-3);margin-bottom:var(--space-6)}
        @media(max-width:480px){.ot-type-grid{grid-template-columns:1fr}}
        .ot-type-card{padding:var(--space-4);border-radius:var(--radius-lg);border:1.5px solid var(--color-border);background:var(--color-white);cursor:pointer;transition:all .15s;text-align:left}
        .ot-type-card:hover{transform:translateY(-1px);box-shadow:var(--shadow-md)}
        .ot-type-card.active{border-width:2px}
        .ot-type-icon{font-size:22px;margin-bottom:var(--space-2)}
        .ot-type-label{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .ot-type-desc{font-size:10px;color:var(--color-text-muted);line-height:1.4}

        /* Form card */
        .ot-form-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-6);box-shadow:var(--shadow-xs)}
        .ot-form-band{height:3px;border-radius:var(--radius-lg) var(--radius-lg) 0 0;margin:-var(--space-5) -var(--space-5) var(--space-5);margin-top:calc(-1 * var(--space-5));margin-left:calc(-1 * var(--space-5));margin-right:calc(-1 * var(--space-5));margin-bottom:var(--space-5)}
        .ot-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .ot-field{margin-bottom:var(--space-4)}
        .ot-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)}
        @media(max-width:480px){.ot-row{grid-template-columns:1fr}}

        /* Schedule preview */
        .ot-sched-preview{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap}
        .ot-sched-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-faint)}
        .ot-sched-time{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);font-family:monospace}
        .ot-sched-arrow{color:var(--color-text-faint);font-size:12px}

        /* New schedule preview */
        .ot-new-sched{border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4)}
        .ot-new-sched-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
        .ot-new-sched-time{font-size:var(--font-size-sm);font-weight:700;font-family:monospace}
        .ot-ot-hours{display:inline-flex;align-items:center;gap:6px;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:4px 12px;font-size:var(--font-size-xs);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}

        /* History */
        .ot-history-title{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:var(--space-3);display:flex;align-items:center;justify-content:space-between}
        .ot-history-count{font-size:11px;font-weight:700;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:1px 8px;color:var(--color-text-muted)}
        .ot-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .ot-request-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2);display:flex;align-items:flex-start;gap:var(--space-3)}
        .ot-request-card:last-child{margin-bottom:0}
        .ot-request-icon{width:34px;height:34px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .ot-request-info{flex:1;min-width:0}
        .ot-request-date{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .ot-request-meta{font-size:var(--font-size-xs);color:var(--color-text-muted);margin-bottom:3px}
        .ot-request-hours{font-size:11px;font-family:monospace;font-weight:600;color:var(--color-text-secondary)}
        .ot-status-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid;flex-shrink:0}
        .ot-admin-note{font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:3px;font-style:italic}

        .ot-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .ot-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .ot-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .ot-divider{height:1px;background:var(--color-border);margin:var(--space-6) 0}
      `}</style>

      <div className="ot-page">
        <h1 className="ot-title">Overtime Request</h1>
        <p className="ot-sub">Submit an overtime request for admin approval.</p>

        {/* ── OT Type Selector ── */}
        <div className="ot-type-grid">
          {OT_TYPES.map(t => (
            <div key={t.key}
              className={`ot-type-card${otType === t.key ? " active" : ""}`}
              style={otType === t.key ? { borderColor: t.color, background: t.bg } : {}}
              onClick={() => { setOtType(t.key); setOtStart(""); setOtEnd(""); setMsg(null); }}
            >
              <div className="ot-type-icon">{t.icon}</div>
              <div className="ot-type-label" style={otType === t.key ? { color: t.color } : {}}>{t.label}</div>
              <div className="ot-type-desc">{t.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Form ── */}
        <div className="ot-form-card">
          <div className="ot-form-band" style={{ background: otTypeDef.color }} />

          {/* Date */}
          <div className="ot-field">
            <label className="ot-label">Date *</label>
            <input className="form-input" type="date" value={date}
              onChange={e => { setDate(e.target.value); setOtStart(""); setOtEnd(""); setMsg(null); }} />
          </div>

          {/* Current schedule preview (pre/post shift only) */}
          {otType !== "rest_day" && date && (
            fetchingSchedule ? (
              <div className="ot-sched-preview">
                <span className="ot-sched-tag">Fetching schedule…</span>
              </div>
            ) : currentShift ? (
              <div className="ot-sched-preview">
                <span className="ot-sched-tag">Current Shift</span>
                <span className="ot-sched-time">{fmt12(currentShift.timeIn)}</span>
                <span className="ot-sched-arrow">→</span>
                <span className="ot-sched-time">{fmt12(currentShift.TimeOut)}</span>
              </div>
            ) : (
              <div className="ot-sched-preview">
                <span className="ot-sched-tag" style={{ color: "var(--color-danger)" }}>⚠ No schedule found for this date</span>
              </div>
            )
          )}

          {/* OT Times */}
          <div className="ot-row">
            <div>
              <label className="ot-label">
                {otType === "pre_shift" ? "OT Start Time *" : otType === "post_shift" ? "OT Start (= Scheduled Out) *" : "OT Start Time *"}
              </label>
              <input className="form-input" type="time" value={otStart}
                onChange={e => setOtStart(e.target.value)}
                readOnly={otType === "post_shift" && !!currentShift}
                style={otType === "post_shift" && !!currentShift ? { background: "var(--color-bg-alt)", color: "var(--color-text-muted)" } : {}}
              />
              {otType === "post_shift" && currentShift && (
                <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 3 }}>Auto-filled from scheduled time-out</div>
              )}
            </div>
            <div>
              <label className="ot-label">
                {otType === "pre_shift" ? "OT End (= Scheduled In) *" : otType === "post_shift" ? "OT End Time *" : "OT End Time *"}
              </label>
              <input className="form-input" type="time" value={otEnd}
                onChange={e => setOtEnd(e.target.value)}
                readOnly={otType === "pre_shift" && !!currentShift}
                style={otType === "pre_shift" && !!currentShift ? { background: "var(--color-bg-alt)", color: "var(--color-text-muted)" } : {}}
              />
              {otType === "pre_shift" && currentShift && (
                <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 3 }}>Auto-filled from scheduled time-in</div>
              )}
            </div>
          </div>

          {/* OT Hours computed */}
          {otHours > 0 && (
            <div className="ot-ot-hours">
              ⏱ OT Duration: <strong>{otHours}h</strong>
            </div>
          )}

          {/* New schedule preview */}
          {newSchedule && otHours > 0 && (
            <div className="ot-new-sched" style={{ background: otTypeDef.bg, border: `1px solid ${otTypeDef.border}` }}>
              <div className="ot-new-sched-label" style={{ color: otTypeDef.color }}>New Schedule (if approved)</div>
              <div className="ot-new-sched-time" style={{ color: otTypeDef.color }}>
                {fmt12(newSchedule.timeIn)} → {fmt12(newSchedule.TimeOut)}
              </div>
            </div>
          )}

          {/* Rest day note */}
          {otType === "rest_day" && otHours > 0 && (
            <div className="ot-new-sched" style={{ background: "#e0f4fd", border: "1px solid #bae6fd" }}>
              <div className="ot-new-sched-label" style={{ color: "#0369a1" }}>Rest Day OT Schedule (if approved)</div>
              <div className="ot-new-sched-time" style={{ color: "#0369a1" }}>
                {fmt12(otStart)} → {fmt12(otEnd)} · {otHours}h on rest day
              </div>
            </div>
          )}

          {msg && <div className={`ot-alert ${msg.type}`}>{msg.text}</div>}

          <button className="btn btn-primary btn-sm" onClick={handleSubmit}
            disabled={submitting || !date || !otStart || !otEnd || otHours <= 0}
            style={{ width: "100%" }}>
            {submitting ? "Submitting…" : "Submit OT Request"}
          </button>
        </div>

        <div className="ot-divider" />

        {/* ── Request History ── */}
        <div className="ot-history-title">
          <span>My OT Requests</span>
          <span className="ot-history-count">{requests.length}</span>
        </div>

        {loadingRequests ? (
          <div className="ot-empty">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="ot-empty">No overtime requests yet.</div>
        ) : requests.map(r => {
          const typeDef = OT_TYPES.find(t => t.key === r.OTType)!;
          const statusDef = STATUS_STYLE[r.Status];
          return (
            <div key={r.id} className="ot-request-card">
              <div className="ot-request-icon" style={{ background: typeDef.bg }}>{typeDef.icon}</div>
              <div className="ot-request-info">
                <div className="ot-request-date">{fmtDate(r.Date)}</div>
                <div className="ot-request-meta">{typeDef.label} · {fmt12(r.OTStart)} – {fmt12(r.OTEnd)}</div>
                <div className="ot-request-hours">{r.OTHours}h OT</div>
                {r.AdminNote && <div className="ot-admin-note">Admin: {r.AdminNote}</div>}
              </div>
              <span className="ot-status-badge" style={{ background: statusDef.bg, color: statusDef.color, borderColor: statusDef.border }}>
                {statusDef.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "var(--space-6)", fontFamily: "var(--font-base)", width: "100%", maxWidth: 680, boxSizing: "border-box" },
};