import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

interface Schedule {
  id: number;
  ScheduleName: string;
  ShiftCoverage: string;
  Schedule: { timeIn: string; timeOut: string }[];
}

interface Break {
  id: number;
  BreakName: string;
  BreakSchedule: { breakIn: string; breakOut: string }[];
}

interface PayStructureEntry {
  Structure: string;
  Formula: string;
  NightDiffRate?: string;
  NightDiffTimeSpan?: string;
  PartTimeOT?: string;
  RestDayOT?: string;
  RegularHolidayOT?: string;
  SpecialHolidayOT?: string;
}

interface OverrideRow {
  id: number;
  DateCoverage: string;
  ShiftCoverage: string;
  Schedules: any;
  ScheduleType: string | null;
}

interface UserProfile {
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  Email: string;
  UserName: string;
  UserType: string;
  CompanyCode: string;
  CompanyName: string;
  ScheduleID: string | null;
  BreakID: string | null;
  PayStructure: PayStructureEntry[] | null;
  Currency: string | null;
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

const USER_TYPE_LABEL: Record<string, string> = {
  Special: "Owner", Privilege: "Admin", User: "Employee",
};

const USER_TYPE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Special:   { bg: "var(--brand-orange-light)", color: "var(--brand-orange-dark)", border: "var(--brand-orange-muted)" },
  Privilege: { bg: "var(--brand-blue-light)",   color: "var(--brand-blue-dark)",   border: "var(--brand-blue-muted)" },
  User:      { bg: "var(--color-bg-alt)",        color: "var(--color-text-muted)",  border: "var(--color-border)" },
};

const PAY_FIELD_META: { key: keyof PayStructureEntry; label: string; suffix?: string; prefix?: boolean }[] = [
  { key: "NightDiffRate",       label: "Night Differential Rate" },
  { key: "NightDiffTimeSpan",   label: "Night Diff Time Span" },
  { key: "PartTimeOT",          label: "Part-Time OT Rate" },
  { key: "RestDayOT",           label: "Rest Day OT Rate" },
  { key: "RegularHolidayOT",    label: "Regular Holiday OT Rate" },
  { key: "SpecialHolidayOT",    label: "Special Holiday OT Rate" },
];

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit password/email
  const [showEdit, setShowEdit] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirm, setEditConfirm] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];

      const { data: user, error: e } = await supabase
        .from("users")
        .select("EmployeeID, FirstName, LastName, Email, UserName, UserType, CompanyCode, CompanyName, ScheduleID, BreakID, PayStructure, Currency")
        .eq("Email", email).single();

      if (e || !user) { setError("Could not load profile."); setLoading(false); return; }
      setProfile(user as UserProfile);
      setEditEmail(user.Email);

      if (user.ScheduleID) {
        const { data: sched } = await supabase.from("Schedules").select("id, ScheduleName, ShiftCoverage, Schedule").eq("id", user.ScheduleID).single();
        if (sched) setSchedule({ ...sched, Schedule: typeof sched.Schedule === "string" ? JSON.parse(sched.Schedule) : sched.Schedule });
      }

      if (user.BreakID) {
        let ids: string[] = [];
        try { ids = JSON.parse(user.BreakID); } catch { ids = [user.BreakID]; }
        const { data: bl } = await supabase.from("Breaks").select("id, BreakName, BreakSchedule").in("id", ids);
        if (bl) setBreaks(bl.map(b => ({ ...b, BreakSchedule: typeof b.BreakSchedule === "string" ? JSON.parse(b.BreakSchedule) : b.BreakSchedule })));
      }

      // Fetch overrides (non-OT only)
      const { data: ov } = await supabase.from("OverrideSchedules").select("id, DateCoverage, ShiftCoverage, Schedules, ScheduleType")
        .eq("EmployeeID", user.EmployeeID).eq("CompanyCode", user.CompanyCode)
        .is("ScheduleType", null).order("DateCoverage", { ascending: true });
      setOverrides((ov ?? []) as OverrideRow[]);

      setLoading(false);
    }
    bootstrap();
  }, []);

  async function handleSaveCredentials() {
    if (!profile) return;
    if (editPassword && editPassword !== editConfirm) { setEditMsg({ type: "error", text: "Passwords do not match." }); return; }
    if (editPassword && editPassword.length < 8) { setEditMsg({ type: "error", text: "Password must be at least 8 characters." }); return; }
    setEditSaving(true); setEditMsg(null);
    const payload: Record<string, any> = {};
    if (editEmail !== profile.Email) payload.Email = editEmail;
    if (editPassword) payload.Password = editPassword;
    if (Object.keys(payload).length === 0) { setEditMsg({ type: "error", text: "No changes to save." }); setEditSaving(false); return; }
    const { error: e } = await supabase.from("users").update(payload).eq("Email", profile.Email);
    if (e) { setEditMsg({ type: "error", text: e.message }); }
    else {
      setEditMsg({ type: "success", text: "Credentials updated successfully." });
      setProfile(p => p ? { ...p, Email: editEmail } : p);
      setEditPassword(""); setEditConfirm("");
      setTimeout(() => { setShowEdit(false); setEditMsg(null); }, 1500);
    }
    setEditSaving(false);
  }

  if (loading) return (
    <div style={s.page}>
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 16 }} />)}
    </div>
  );
  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;
  if (!profile) return null;

  const ps = profile.PayStructure?.[0] ?? null;
  const baseStructures = profile.PayStructure?.filter(p => ["Monthly", "Hourly", "Daily"].includes(p.Structure)) ?? [];

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingOverrides = overrides.filter(o => o.DateCoverage >= todayStr);
  const pastOverrides = overrides.filter(o => o.DateCoverage < todayStr);

  return (
    <>
      <style>{`
        .prof-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}

        /* Hero */
        .prof-hero{display:flex;align-items:center;justify-content:space-between;gap:var(--space-6);padding:var(--space-6) var(--space-8);background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-xl);margin-bottom:var(--space-5);box-shadow:var(--shadow-sm);flex-wrap:wrap}
        @media(max-width:480px){.prof-hero{padding:var(--space-5);flex-direction:column;align-items:stretch}.prof-hero>.btn{width:100%}}
        .prof-hero-left{display:flex;align-items:center;gap:var(--space-5)}
        @media(max-width:480px){.prof-hero-left{gap:var(--space-4)}}
        .prof-avatar{width:80px;height:80px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:white;flex-shrink:0;box-shadow:var(--shadow-brand-orange)}
        @media(max-width:480px){.prof-avatar{width:60px;height:60px;font-size:20px}}
        .prof-name{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:3px}
        .prof-email{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-2)}
        .prof-badges{display:flex;gap:var(--space-2);flex-wrap:wrap}
        .prof-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid}

        /* Layout grid */
        .prof-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}
        @media(max-width:900px){.prof-grid{grid-template-columns:1fr}}
        .prof-grid-full{grid-column:1/-1}

        /* Section cards */
        .prof-section{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-xs)}
        .prof-section-header{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);background:var(--color-bg-alt)}
        .prof-section-icon{width:28px;height:28px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
        .prof-section-title{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .prof-section-body{padding:var(--space-4) var(--space-5)}

        /* Info grid */
        .prof-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3) var(--space-5)}
        @media(max-width:420px){.prof-info-grid{grid-template-columns:1fr}}
        .prof-info-item{display:flex;flex-direction:column;gap:2px}
        .prof-info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-faint)}
        .prof-info-value{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text)}
        .prof-info-value.mono{font-family:monospace}

        /* Schedule */
        .prof-sched-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:var(--space-3)}
        .prof-sched-tag{font-weight:400;color:var(--color-text-muted);margin-left:6px;font-size:var(--font-size-xs)}
        .prof-shift{background:var(--brand-orange-light);border:1.5px solid var(--brand-orange-muted);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2)}
        .prof-shift:last-child{margin-bottom:0}
        .prof-shift-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--brand-orange-dark);margin-bottom:2px}
        .prof-shift-time{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);font-family:monospace}

        /* Breaks */
        .prof-break-card{background:var(--brand-blue-light);border:1.5px solid var(--brand-blue-muted);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2)}
        .prof-break-card:last-child{margin-bottom:0}
        .prof-break-card-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--brand-blue-dark);margin-bottom:var(--space-2)}
        .prof-break-row{display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-xs);color:var(--color-text-secondary);font-family:monospace}
        .prof-break-dot{width:5px;height:5px;border-radius:50%;background:var(--brand-blue);flex-shrink:0}

        /* Pay */
        .prof-pay-main{display:flex;align-items:center;justify-content:space-between;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3)}
        .prof-pay-main-label{font-size:var(--font-size-xs);font-weight:600;color:var(--color-text-muted)}
        .prof-pay-main-value{font-size:var(--font-size-lg);font-weight:800;color:var(--color-text);font-family:monospace}
        .prof-pay-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);margin-bottom:2px}
        .prof-pay-row:hover{background:var(--color-bg-alt)}
        .prof-pay-row-label{font-size:var(--font-size-xs);color:var(--color-text-muted)}
        .prof-pay-row-value{font-size:var(--font-size-xs);font-weight:700;color:var(--color-text);font-family:monospace}
        .prof-pay-divider{height:1px;background:var(--color-border);margin:var(--space-3) 0}
        .prof-pay-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-faint);margin-bottom:var(--space-2)}

        /* Overrides */
        .prof-override-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);margin-bottom:var(--space-2)}
        .prof-override-date{font-size:var(--font-size-xs);font-weight:700;color:var(--color-text)}
        .prof-override-shift{font-size:10px;color:var(--color-text-muted);font-family:monospace;margin-top:1px}
        .prof-past-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-faint);margin:var(--space-3) 0 var(--space-2);display:flex;align-items:center;gap:var(--space-2)}
        .prof-past-line{flex:1;height:1px;background:var(--color-border)}
        .prof-past-wrap{opacity:.6}

        .prof-empty{font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic;text-align:center;padding:var(--space-4) 0}

        /* Edit modal */
        .prof-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px;animation:profFade .15s ease}
        @keyframes profFade{from{opacity:0}to{opacity:1}}
        .prof-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:420px;overflow:hidden;animation:profUp .2s cubic-bezier(.22,1,.36,1)}
        @keyframes profUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .prof-modal-band{height:4px;background:var(--gradient-brand)}
        .prof-modal-body{padding:var(--space-6)}
        .prof-modal-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:var(--space-5)}
        .prof-modal-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .prof-modal-field{margin-bottom:var(--space-4)}
        .prof-modal-footer{display:flex;justify-content:flex-end;gap:var(--space-3);padding-top:var(--space-4);border-top:1px solid var(--color-border);margin-top:var(--space-4)}
        @media(max-width:420px){.prof-modal-footer{flex-direction:column-reverse}.prof-modal-footer .btn{width:100%;justify-content:center}}
        .prof-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .prof-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .prof-alert.success{background:var(--color-success-light);color:var(--color-success)}
      `}</style>

      <div className="prof-page">

        {/* ── Hero ── */}
        <div className="prof-hero">
          <div className="prof-hero-left">
            <div className="prof-avatar">{profile.FirstName?.[0]}{profile.LastName?.[0]}</div>
            <div>
              <div className="prof-name">{profile.FirstName} {profile.LastName}</div>
              <div className="prof-email">{profile.Email}</div>
              <div className="prof-badges">
                {(() => { const st = USER_TYPE_STYLE[profile.UserType] ?? USER_TYPE_STYLE.User; return (
                  <span className="prof-badge" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                    {USER_TYPE_LABEL[profile.UserType] ?? profile.UserType}
                  </span>
                ); })()}
                <span className="prof-badge" style={{ background: "var(--color-bg-alt)", color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}>
                  {profile.CompanyName}
                </span>
                <span className="prof-badge" style={{ background: "var(--color-bg-alt)", color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}>
                  ID: {profile.EmployeeID ?? "—"}
                </span>
              </div>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setShowEdit(true); setEditMsg(null); }}>
            ✏ Edit Credentials
          </button>
        </div>

        {/* ── Grid Layout ── */}
        <div className="prof-grid">

          {/* Personal Information */}
          <div className="prof-section">
            <div className="prof-section-header">
              <div className="prof-section-icon" style={{ background: "var(--brand-orange-light)" }}>👤</div>
              <span className="prof-section-title">Personal Information</span>
            </div>
            <div className="prof-section-body">
              <div className="prof-info-grid">
                {[
                  { label: "First Name",    value: profile.FirstName },
                  { label: "Last Name",     value: profile.LastName },
                  { label: "Username",      value: profile.UserName, mono: true },
                  { label: "Employee ID",   value: profile.EmployeeID ?? "—", mono: true },
                  { label: "Email",         value: profile.Email },
                  { label: "Role",          value: USER_TYPE_LABEL[profile.UserType] ?? profile.UserType },
                  { label: "Company",       value: profile.CompanyName },
                  { label: "Company Code",  value: profile.CompanyCode, mono: true },
                ].map(item => (
                  <div key={item.label} className="prof-info-item">
                    <span className="prof-info-label">{item.label}</span>
                    <span className={`prof-info-value${item.mono ? " mono" : ""}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pay Structure */}
          <div className="prof-section">
            <div className="prof-section-header">
              <div className="prof-section-icon" style={{ background: "#f5f3ff" }}>💰</div>
              <span className="prof-section-title">Pay Structure</span>
            </div>
            <div className="prof-section-body">
              {!ps ? (
                <div className="prof-empty">No pay structure assigned.</div>
              ) : (
                <>
                  {baseStructures.map((p, i) => (
                    <div key={i} className="prof-pay-main">
                      <div>
                        <div className="prof-pay-main-label">{p.Structure} Rate</div>
                        <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 1 }}>Base pay per {p.Structure.toLowerCase()}</div>
                      </div>
                      <div className="prof-pay-main-value">{profile.Currency ?? ""}{Number(p.Formula).toLocaleString()}</div>
                    </div>
                  ))}

                  {/* OT & differential rates */}
                  {PAY_FIELD_META.some(f => ps[f.key]) && (
                    <>
                      <div className="prof-pay-divider" />
                      <div className="prof-pay-section-label">Rates & Differentials</div>
                      {PAY_FIELD_META.map(f => ps[f.key] ? (
                        <div key={f.key} className="prof-pay-row">
                          <span className="prof-pay-row-label">{f.label}</span>
                          <span className="prof-pay-row-value">{ps[f.key]}</span>
                        </div>
                      ) : null)}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Work Schedule */}
          <div className="prof-section">
            <div className="prof-section-header">
              <div className="prof-section-icon" style={{ background: "var(--brand-orange-light)" }}>🕐</div>
              <span className="prof-section-title">Work Schedule</span>
            </div>
            <div className="prof-section-body">
              {!schedule ? (
                <div className="prof-empty">No schedule assigned.</div>
              ) : (
                <>
                  <div className="prof-sched-name">
                    {schedule.ScheduleName}
                    <span className="prof-sched-tag">{schedule.ShiftCoverage}</span>
                  </div>
                  {schedule.Schedule.map((slot, i) => (
                    <div key={i} className="prof-shift">
                      <div className="prof-shift-label">Shift {i + 1}</div>
                      <div className="prof-shift-time">{fmt12(slot.timeIn)} → {fmt12(slot.timeOut)}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Break Schedule */}
          <div className="prof-section">
            <div className="prof-section-header">
              <div className="prof-section-icon" style={{ background: "var(--brand-blue-light)" }}>☕</div>
              <span className="prof-section-title">Break Schedule</span>
            </div>
            <div className="prof-section-body">
              {breaks.length === 0 ? (
                <div className="prof-empty">No breaks assigned.</div>
              ) : breaks.map((brk, i) => (
                <div key={i} className="prof-break-card">
                  <div className="prof-break-card-label">{brk.BreakName}</div>
                  {brk.BreakSchedule.map((slot, j) => (
                    <div key={j} className="prof-break-row">
                      <div className="prof-break-dot" />
                      {fmt12(slot.breakIn)} – {fmt12(slot.breakOut)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Override Schedules — full width */}
          <div className="prof-section prof-grid-full">
            <div className="prof-section-header">
              <div className="prof-section-icon" style={{ background: "#e0f4fd" }}>📅</div>
              <span className="prof-section-title">Temporary Schedule Overrides</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", borderRadius: 99, padding: "1px 8px", color: "var(--color-text-muted)" }}>
                {overrides.length}
              </span>
            </div>
            <div className="prof-section-body">
              {overrides.length === 0 ? (
                <div className="prof-empty">No temporary schedule overrides.</div>
              ) : (
                <>
                  {/* Upcoming */}
                  {upcomingOverrides.length > 0 && upcomingOverrides.map(o => {
                    const slots = typeof o.Schedules === "string" ? JSON.parse(o.Schedules) : (o.Schedules ?? []);
                    return (
                      <div key={o.id} className="prof-override-row">
                        <div>
                          <div className="prof-override-date">{fmtDate(o.DateCoverage)}</div>
                          <div className="prof-override-shift">
                            {slots.map((s: any, i: number) => (
                              <span key={i}>{fmt12(s.timeIn)} → {fmt12(s.timeOut ?? s.TimeOut)}{i < slots.length - 1 ? "  ·  " : ""}</span>
                            ))}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: "var(--brand-orange-light)", border: "1px solid var(--brand-orange-muted)", color: "var(--brand-orange-dark)", borderRadius: 99, padding: "2px 8px" }}>Upcoming</span>
                      </div>
                    );
                  })}

                  {/* Past */}
                  {pastOverrides.length > 0 && (
                    <>
                      <div className="prof-past-label">Past <div className="prof-past-line" /></div>
                      <div className="prof-past-wrap">
                        {pastOverrides.map(o => {
                          const slots = typeof o.Schedules === "string" ? JSON.parse(o.Schedules) : (o.Schedules ?? []);
                          return (
                            <div key={o.id} className="prof-override-row">
                              <div>
                                <div className="prof-override-date">{fmtDate(o.DateCoverage)}</div>
                                <div className="prof-override-shift">
                                  {slots.map((s: any, i: number) => (
                                    <span key={i}>{fmt12(s.timeIn)} → {fmt12(s.timeOut ?? s.TimeOut)}{i < slots.length - 1 ? "  ·  " : ""}</span>
                                  ))}
                                </div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "var(--color-bg-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-faint)", borderRadius: 99, padding: "2px 8px" }}>Past</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Edit Credentials Modal ── */}
      {showEdit && (
        <div className="prof-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEdit(false); }}>
          <div className="prof-modal">
            <div className="prof-modal-band" />
            <div className="prof-modal-body">
              <div className="prof-modal-title">Edit Credentials</div>

              <div className="prof-modal-field">
                <label className="prof-modal-label">Email Address</label>
                <input className="form-input" type="email" value={editEmail}
                  onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div className="prof-modal-field">
                <label className="prof-modal-label">New Password <span style={{ color: "var(--color-text-faint)", fontWeight: 400, fontSize: 11 }}>(leave blank to keep current)</span></label>
                <input className="form-input" type="password" placeholder="Min. 8 characters"
                  value={editPassword} onChange={e => setEditPassword(e.target.value)} />
              </div>
              <div className="prof-modal-field">
                <label className="prof-modal-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="Repeat new password"
                  value={editConfirm} onChange={e => setEditConfirm(e.target.value)} />
              </div>

              {editMsg && <div className={`prof-alert ${editMsg.type}`}>{editMsg.text}</div>}

              <div className="prof-modal-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveCredentials} disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "var(--space-6)", fontFamily: "var(--font-base)", width: "100%", maxWidth: "100%", boxSizing: "border-box" },
};