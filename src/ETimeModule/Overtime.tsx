import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type OTType = "PartTimeOT" | "RestDayOT";
type PartTimeSubType = "pre_shift" | "post_shift";

interface ShiftSlot {
  timeIn: string;
  timeOut: string;
}

interface BreakSlot {
  breakIn: string;
  breakOut: string;
}

interface BreakOption {
  id: number;
  BreakName: string;
  BreakSchedule: BreakSlot[];
}

interface RestDaySlot {
  timeIn: string;
  timeOut: string;
}

interface OverrideRow {
  id: number;
  Date: string;
  ShiftCoverage: string;
  Schedules: any;
  ScheduleType: string;
  OTHours: number;
  Status: "pending" | "approved" | "rejected" | null;
  AdminNote: string | null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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
  { key: "PartTimeOT", label: "Part-Time OT", icon: "⏱", desc: "Work before or after your scheduled shift", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { key: "RestDayOT",  label: "Rest Day OT",  icon: "📅", desc: "Work on your day off",                     color: "#0369a1", bg: "#e0f4fd", border: "#bae6fd" },
];

const PARTTIME_SUB_TYPES: { key: PartTimeSubType; label: string; icon: string; desc: string }[] = [
  { key: "pre_shift",  label: "Pre-Shift",  icon: "🌅", desc: "Work before your scheduled time-in"  },
  { key: "post_shift", label: "Post-Shift", icon: "🌆", desc: "Work after your scheduled time-out" },
];

export default function Overtime() {
  const [employeeID, setEmployeeID] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [otType, setOtType] = useState<OTType>("PartTimeOT");
  const [otSubType, setOtSubType] = useState<PartTimeSubType>("pre_shift");
  const [date, setDate] = useState("");
  const [otStart, setOtStart] = useState("");
  const [otEnd, setOtEnd] = useState("");
  const [fetchingSchedule, setFetchingSchedule] = useState(false);

  // All available shift slots for the date (supports broken schedules)
  const [availableShifts, setAvailableShifts] = useState<ShiftSlot[]>([]);
  // Which slot the employee selected to extend
  const [selectedShiftIndex, setSelectedShiftIndex] = useState<number>(0);

  const currentShift = availableShifts[selectedShiftIndex] ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [conflict, setConflict] = useState<{ type: string; message: string } | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [breakOptions, setBreakOptions] = useState<BreakOption[]>([]);
  const [selectedBreakIDs, setSelectedBreakIDs] = useState<string[]>([""]);
  const [restDaySlots, setRestDaySlots] = useState<RestDaySlot[]>([{ timeIn: "", timeOut: "" }]);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const email = atob(raw).split(":")[1];
      const { data, error: e } = await supabase
        .from("users").select("EmployeeID, CompanyCode").eq("Email", email).single();
      if (e || !data) { setError("Could not load user."); setLoading(false); return; }
      setEmployeeID(data.EmployeeID ?? "");
      setCompanyCode(data.CompanyCode ?? "");
      await Promise.all([fetchOverrides(data.EmployeeID, data.CompanyCode), fetchBreaks(data.CompanyCode)]);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchBreaks(code: string) {
    const { data } = await supabase.from("Breaks").select("id, BreakName, BreakSchedule").eq("CompanyCode", code);
    setBreakOptions((data ?? []).map(b => ({
      ...b,
      BreakSchedule: typeof b.BreakSchedule === "string" ? JSON.parse(b.BreakSchedule) : b.BreakSchedule,
    })));
  }

  async function fetchOverrides(empID: string, code: string) {
    const { data } = await supabase.from("Overtime").select("*")
      .eq("EmployeeID", empID).eq("CompanyCode", code)
      .not("ScheduleType", "is", null)
      .order("Date", { ascending: false });
    setOverrides((data ?? []) as OverrideRow[]);
  }

  useEffect(() => {
    if (!date || otType === "RestDayOT" || !employeeID || !companyCode) {
      setAvailableShifts([]); setSelectedShiftIndex(0); return;
    }
    fetchScheduleForDate();
  }, [date, otType, employeeID, companyCode]);

  async function fetchScheduleForDate() {
    setFetchingSchedule(true);
    setAvailableShifts([]); setSelectedShiftIndex(0);

    // Priority 1: Regular override (ScheduleType is null)
    const { data: regularOverride } = await supabase
      .from("OverrideSchedules").select("Schedules")
      .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode)
      .eq("DateCoverage", date).is("ScheduleType", null).maybeSingle();

    if (regularOverride?.Schedules) {
      const slots: any[] = typeof regularOverride.Schedules === "string"
        ? JSON.parse(regularOverride.Schedules) : regularOverride.Schedules;
      if (slots.length) {
        setAvailableShifts(slots.map(s => ({ timeIn: s.timeIn, timeOut: s.timeOut ?? s.TimeOut ?? "" })));
        setFetchingSchedule(false); return;
      }
    }

    // Priority 2: Existing OT for this date — use its Schedules as the extended shift
    const { data: otOverride } = await supabase
      .from("Overtime").select("Schedules, ReferenceSchedule")
      .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode)
      .eq("Date", date).not("ScheduleType", "is", null).maybeSingle();

    if (otOverride?.Schedules) {
      const slots: any[] = typeof otOverride.Schedules === "string"
        ? JSON.parse(otOverride.Schedules) : otOverride.Schedules;
      if (slots.length) {
        setAvailableShifts(slots.map(s => ({ timeIn: s.timeIn, timeOut: s.timeOut ?? s.TimeOut ?? "" })));
        setFetchingSchedule(false); return;
      }
    }

    // Priority 3: Regular schedule from users table
    const { data: user } = await supabase.from("users").select("ScheduleID")
      .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode).single();
    if (!user?.ScheduleID) { setFetchingSchedule(false); return; }

    const { data: sched } = await supabase.from("Schedules").select("Schedule")
      .eq("id", user.ScheduleID).single();
    if (sched?.Schedule) {
      const slots: any[] = typeof sched.Schedule === "string" ? JSON.parse(sched.Schedule) : sched.Schedule;
      setAvailableShifts(slots.map(s => ({ timeIn: s.timeIn, timeOut: s.timeOut ?? s.TimeOut ?? "" })));
    }
    setFetchingSchedule(false);
  }

  // Auto-fill OT start/end when shift selection or subtype changes
  useEffect(() => {
    if (!currentShift || otType === "RestDayOT") return;
    if (otSubType === "pre_shift") { setOtEnd(currentShift.timeIn); setOtStart(""); }
    else { setOtStart(currentShift.timeOut); setOtEnd(""); }
  }, [currentShift, otSubType, otType]);

  useEffect(() => {
    if (!date || !employeeID || !companyCode) { setConflict(null); return; }
    checkSameDayConflict();
  }, [date, otType, otSubType, employeeID, companyCode]);

  async function checkSameDayConflict() {
    // Check existing OT on same date
    const { data: otData } = await supabase.from("Overtime").select("ScheduleType, OTHours, ShiftCoverage")
      .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode)
      .eq("Date", date).not("ScheduleType", "is", null).maybeSingle();

    // Check if a temporary override schedule exists for this date
    const { data: overrideData } = await supabase.from("OverrideSchedules").select("ShiftCoverage, DateCoverage")
      .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode)
      .eq("DateCoverage", date).maybeSingle();

    if (otData && (otType === "RestDayOT" || otData.ScheduleType === "RestDayOT")) {
      setConflict({ type: "conflict", message: `Rest Day OT cannot be combined with Part-Time OT on the same day.` });
    } else if (overrideData) {
      setConflict({ type: "warning", message: `⚠ A temporary schedule override (${overrideData.ShiftCoverage}) exists for this date. Your OT and the override may conflict — proceed with caution.` });
    } else if (otData) {
      setConflict({ type: "warning", message: `You already have a Part-Time OT (${otData.ShiftCoverage}) on this date. The new OT will be merged into it.` });
    } else {
      setConflict(null);
    }
  }

  const restDayTotalHours = Math.round(restDaySlots.filter(s => s.timeIn && s.timeOut)
    .reduce((sum, s) => sum + diffHours(s.timeIn, s.timeOut), 0) * 100) / 100;

  const otHours = otStart && otEnd ? diffHours(otStart, otEnd) : 0;

  function getNewSchedule(): { timeIn: string; timeOut: string } | null {
    if (!currentShift) return null;
    if (otSubType === "pre_shift" && otStart) return { timeIn: otStart, timeOut: currentShift.timeOut };
    if (otSubType === "post_shift" && otEnd) return { timeIn: currentShift.timeIn, timeOut: otEnd };
    return null;
  }
  const newSchedule = getNewSchedule();

  const handleBreakChange = (index: number, value: string) => {
    const u = [...selectedBreakIDs]; u[index] = value; setSelectedBreakIDs(u);
  };
  function updateRestSlot(index: number, field: keyof RestDaySlot, value: string) {
    setRestDaySlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function buildBreaksJSON(): string {
    const filled = selectedBreakIDs.filter(id => id !== "");
    if (!filled.length) return JSON.stringify([]);
    return JSON.stringify(filled.flatMap(id => breakOptions.find(b => String(b.id) === id)?.BreakSchedule ?? []));
  }

  async function handleSubmit() {
    if (!date) { setMsg({ type: "error", text: "Please select a date." }); return; }
    if (otType === "RestDayOT") {
      if (!restDaySlots.filter(s => s.timeIn && s.timeOut).length) { setMsg({ type: "error", text: "Please add at least one shift slot." }); return; }
      if (restDayTotalHours <= 0) { setMsg({ type: "error", text: "End time must be after start time." }); return; }
    } else {
      if (!otStart || !otEnd) { setMsg({ type: "error", text: "Please enter OT start and end times." }); return; }
      if (otHours <= 0) { setMsg({ type: "error", text: "OT end time must be after start time." }); return; }
      if (!currentShift) { setMsg({ type: "error", text: "Could not find your schedule for this date." }); return; }
      if (!newSchedule) { setMsg({ type: "error", text: "Could not compute new schedule." }); return; }
    }

    setSubmitting(true); setMsg(null);

    // Conflict check for PartTimeOT
    if (otType === "PartTimeOT") {
      const { data: sameDayOT } = await supabase.from("Overtime").select("ScheduleType, Schedules")
        .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode).eq("Date", date)
        .not("ScheduleType", "is", null);

      if (sameDayOT?.length) {
        const newStart = timeToMinutes(otStart);
        let newEnd = timeToMinutes(otEnd);
        if (newEnd <= newStart) newEnd += 1440;
        for (const ex of sameDayOT) {
          const slots = typeof ex.Schedules === "string" ? JSON.parse(ex.Schedules) : (ex.Schedules ?? []);
          for (const slot of slots) {
            const exStart = timeToMinutes(slot.timeIn);
            let exEnd = timeToMinutes(slot.timeOut);
            if (exEnd <= exStart) exEnd += 1440;
            if (newStart < exEnd && newEnd > exStart) {
              setMsg({ type: "error", text: `OT window conflicts with existing OT (${fmt12(slot.timeIn)} – ${fmt12(slot.timeOut)}). Please adjust your times.` });
              setSubmitting(false); return;
            }
          }
        }
      }
    }

    let scheduleSlots: { timeIn: string; timeOut: string }[];
    let shiftCoverage: string;
    let finalOTHours: number;

    if (otType === "RestDayOT") {
      const validSlots = restDaySlots.filter(s => s.timeIn && s.timeOut);
      scheduleSlots = validSlots;
      shiftCoverage = validSlots.map(s => `${s.timeIn}-${s.timeOut}`).join(", ");
      finalOTHours = restDayTotalHours;
    } else {
      scheduleSlots = [{ timeIn: newSchedule!.timeIn, timeOut: newSchedule!.timeOut }];
      shiftCoverage = `${newSchedule!.timeIn} - ${newSchedule!.timeOut}`;
      finalOTHours = otHours;
    }

    const { data: existingRow } = await supabase.from("Overtime")
      .select("id, Schedules, ScheduleType, OTHours")
      .eq("EmployeeID", employeeID).eq("CompanyCode", companyCode)
      .eq("Date", date).not("ScheduleType", "is", null).maybeSingle();

    if (existingRow) {
      const existingSlots: ShiftSlot[] = typeof existingRow.Schedules === "string"
        ? JSON.parse(existingRow.Schedules) : (existingRow.Schedules ?? []);

      // Keep slots separate — just append the new OT slot
      const finalSlots = [...existingSlots, ...scheduleSlots];
      // OTHours = sum of actual OT durations only, not the merged window
      const finalOTHoursTotal = Math.round(((existingRow.OTHours ?? 0) + finalOTHours) * 100) / 100;

      const { error: e } = await supabase.from("Overtime").update({
        Schedules: JSON.stringify(finalSlots),
        ShiftCoverage: finalSlots.map(s => `${s.timeIn}-${s.timeOut}`).join(", "),
        ScheduleType: "PartTimeOT",
        OTHours: finalOTHoursTotal,
        ReferenceSchedule: currentShift ? `${currentShift.timeIn}-${currentShift.timeOut}` : null,
      }).eq("id", existingRow.id);
      if (e) { setMsg({ type: "error", text: e.message }); setSubmitting(false); return; }
    } else {
      const { error: e } = await supabase.from("Overtime").insert([{
        EmployeeID: employeeID, CompanyCode: companyCode,
        ShiftCoverage: shiftCoverage, Schedules: JSON.stringify(scheduleSlots),
        Breaks: buildBreaksJSON(), Date: date, ScheduleType: otType,
        OTHours: finalOTHours,
        ReferenceSchedule: currentShift ? `${currentShift.timeIn}-${currentShift.timeOut}` : null,
      }]);
      if (e) { setMsg({ type: "error", text: e.message }); setSubmitting(false); return; }
    }

    setMsg({ type: "success", text: "OT schedule saved successfully!" });
    setDate(""); setOtStart(""); setOtEnd(""); setAvailableShifts([]); setSelectedShiftIndex(0);
    setSelectedBreakIDs([""]); setRestDaySlots([{ timeIn: "", timeOut: "" }]);
    await fetchOverrides(employeeID, companyCode);
    setTimeout(() => setMsg(null), 2500);
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    setDeleteLoading(true);
    await supabase.from("Overtime").delete().eq("id", id);
    setOverrides(prev => prev.filter(o => o.id !== id));
    setConfirmDeleteId(null); setDeleteLoading(false);
  }

  if (loading) return <div style={s.page}>{[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />)}</div>;
  if (error) return <div style={s.page}><div className="alert alert-danger">{error}</div></div>;

  const otTypeDef = OT_TYPES.find(t => t.key === otType)!;

  return (
    <>
      <style>{`
        .ot-page{padding:var(--space-6);font-family:var(--font-base);width:100%;box-sizing:border-box}
        .ot-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .ot-sub{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-6)}
        .ot-type-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-3);margin-bottom:var(--space-5)}
        @media(max-width:480px){.ot-type-grid{grid-template-columns:1fr}}
        .ot-type-card{padding:var(--space-4);border-radius:var(--radius-lg);border:1.5px solid var(--color-border);background:var(--color-white);cursor:pointer;transition:all .15s;text-align:left}
        .ot-type-card:hover{transform:translateY(-1px);box-shadow:var(--shadow-md)}
        .ot-type-card.active{border-width:2px}
        .ot-type-icon{font-size:22px;margin-bottom:var(--space-2)}
        .ot-type-label{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .ot-type-desc{font-size:10px;color:var(--color-text-muted);line-height:1.4}
        .ot-subtype-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-2);margin-bottom:var(--space-4)}
        .ot-subtype-card{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);border:1.5px solid var(--color-border);background:var(--color-white);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:var(--space-2)}
        .ot-subtype-card.active{border-color:#7c3aed;background:#f5f3ff}
        .ot-subtype-icon{font-size:16px}
        .ot-subtype-label{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .ot-subtype-desc{font-size:10px;color:var(--color-text-muted)}
        .ot-form-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:var(--space-6);box-shadow:var(--shadow-xs)}
        .ot-form-band{height:4px}
        .ot-form-body{padding:var(--space-5)}
        .ot-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .ot-field{margin-bottom:var(--space-4)}
        .ot-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)}
        @media(max-width:480px){.ot-row{grid-template-columns:1fr}}
        .ot-sched-preview{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap}
        .ot-sched-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-faint)}
        .ot-sched-time{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);font-family:monospace}

        /* Shift picker for broken schedules */
        .ot-shift-picker{margin-bottom:var(--space-4)}
        .ot-shift-picker-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--color-text-faint);margin-bottom:var(--space-2);display:block}
        .ot-shift-slots{display:flex;flex-direction:column;gap:var(--space-2)}
        .ot-shift-slot{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);border:1.5px solid var(--color-border);background:var(--color-white);cursor:pointer;transition:all .15s}
        .ot-shift-slot:hover{border-color:#7c3aed;background:#f5f3ff}
        .ot-shift-slot.active{border-color:#7c3aed;background:#f5f3ff}
        .ot-shift-slot-radio{width:16px;height:16px;border-radius:50%;border:2px solid var(--color-border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
        .ot-shift-slot.active .ot-shift-slot-radio{border-color:#7c3aed;background:#7c3aed}
        .ot-shift-slot-dot{width:6px;height:6px;border-radius:50%;background:white}
        .ot-shift-slot-time{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);font-family:monospace}
        .ot-shift-slot-label{font-size:10px;color:var(--color-text-muted);margin-left:auto}

        .ot-new-sched{border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4)}
        .ot-new-sched-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
        .ot-new-sched-time{font-size:var(--font-size-sm);font-weight:700;font-family:monospace}
        .ot-hours-pill{display:inline-flex;align-items:center;gap:6px;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:4px 12px;font-size:var(--font-size-xs);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}
        .ot-divider{height:1px;background:var(--color-border);margin:var(--space-6) 0}
        .ot-history-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .ot-history-title{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .ot-count{font-size:11px;font-weight:700;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:1px 8px;color:var(--color-text-muted)}
        .ot-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .ot-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2);display:flex;align-items:flex-start;gap:var(--space-3)}
        .ot-card-icon{width:34px;height:34px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .ot-card-info{flex:1;min-width:0}
        .ot-card-date{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .ot-card-shift{font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:monospace}
        .ot-card-meta{font-size:10px;color:var(--color-text-faint);margin-top:2px}
        .ot-delete-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap;flex-shrink:0}
        .ot-delete-btn:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}
        .ot-confirm-row{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .ot-confirm-text{font-size:11px;color:#dc2626;font-weight:600}
        .ot-confirm-yes{padding:4px 10px;border-radius:var(--radius-md);border:none;background:#dc2626;font-size:11px;font-weight:700;color:white;cursor:pointer;font-family:var(--font-base)}
        .ot-confirm-yes:disabled{opacity:.5}
        .ot-confirm-no{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base)}
        .ot-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .ot-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .ot-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .ot-alert.warning{background:#fef3c7;color:#92400e}
        .ot-break-row{display:flex;gap:var(--space-2);align-items:center;margin-bottom:var(--space-2)}
        .ot-break-preview{padding:var(--space-2) var(--space-3);background:#e0f4fd;border:1px solid #bae6fd;border-radius:var(--radius-md);margin-bottom:var(--space-2)}
        .ot-break-preview-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#0369a1;margin-bottom:2px}
        .ot-break-preview-time{font-size:var(--font-size-xs);color:var(--color-text-secondary);font-family:monospace}
        .ot-add-break{font-size:var(--font-size-xs);font-weight:700;color:#0369a1;background:#e0f4fd;border:1px solid #bae6fd;border-radius:var(--radius-md);padding:4px 12px;cursor:pointer;font-family:var(--font-base);margin-top:var(--space-1)}
        .ot-add-break:hover{background:#bae6fd}
        .ot-remove-break{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);white-space:nowrap;flex-shrink:0}
        .ot-remove-break:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}
        .ot-rd-slot{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3)}
        .ot-rd-slot-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .ot-rd-slot-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#0369a1}
        .ot-rd-slot-hours{font-size:10px;font-weight:700;color:#0369a1;font-family:monospace}
        .ot-rd-add{width:100%;padding:9px;border-radius:var(--radius-md);border:1.5px dashed #bae6fd;background:#e0f4fd;font-size:var(--font-size-xs);font-weight:700;color:#0369a1;cursor:pointer;font-family:var(--font-base);transition:all .15s;margin-bottom:var(--space-4)}
        .ot-rd-add:hover{background:#bae6fd}
        .ot-rd-total{display:inline-flex;align-items:center;gap:6px;background:#e0f4fd;border:1px solid #bae6fd;border-radius:99px;padding:4px 12px;font-size:var(--font-size-xs);font-weight:700;color:#0369a1;margin-bottom:var(--space-4)}
      `}</style>

      <div className="ot-page">
        <h1 className="ot-title">Overtime</h1>
        <p className="ot-sub">File your overtime schedule for a specific date.</p>

        <div className="ot-type-grid">
          {OT_TYPES.map(t => (
            <div key={t.key} className={`ot-type-card${otType === t.key ? " active" : ""}`}
              style={otType === t.key ? { borderColor: t.color, background: t.bg } : {}}
              onClick={() => { setOtType(t.key); setOtSubType("pre_shift"); setOtStart(""); setOtEnd(""); setMsg(null); setAvailableShifts([]); setSelectedShiftIndex(0); setSelectedBreakIDs([""]); setRestDaySlots([{ timeIn: "", timeOut: "" }]); }}>
              <div className="ot-type-icon">{t.icon}</div>
              <div className="ot-type-label" style={otType === t.key ? { color: t.color } : {}}>{t.label}</div>
              <div className="ot-type-desc">{t.desc}</div>
            </div>
          ))}
        </div>

        <div className="ot-form-card">
          <div className="ot-form-band" style={{ background: otTypeDef.color }} />
          <div className="ot-form-body">

            <div className="ot-field">
              <label className="ot-label">Date *</label>
              <input className="form-input" type="date" value={date}
                onChange={e => { setDate(e.target.value); setOtStart(""); setOtEnd(""); setAvailableShifts([]); setSelectedShiftIndex(0); setMsg(null); }} />
            </div>

            {otType === "PartTimeOT" && (
              <>
                {/* Sub-type selector */}
                <div className="ot-field">
                  <label className="ot-label">OT Type</label>
                  <div className="ot-subtype-grid">
                    {PARTTIME_SUB_TYPES.map(st => (
                      <div key={st.key} className={`ot-subtype-card${otSubType === st.key ? " active" : ""}`}
                        onClick={() => { setOtSubType(st.key); setOtStart(""); setOtEnd(""); setMsg(null); }}>
                        <span className="ot-subtype-icon">{st.icon}</span>
                        <div>
                          <div className="ot-subtype-label">{st.label}</div>
                          <div className="ot-subtype-desc">{st.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shift picker — shown when broken schedule detected */}
                {date && (
                  fetchingSchedule ? (
                    <div className="ot-sched-preview"><span className="ot-sched-tag">Fetching schedule…</span></div>
                  ) : availableShifts.length === 0 ? (
                    <div className="ot-sched-preview">
                      <span className="ot-sched-tag" style={{ color: "var(--color-danger)" }}>⚠ No schedule found for this date</span>
                    </div>
                  ) : availableShifts.length === 1 ? (
                    <div className="ot-sched-preview">
                      <span className="ot-sched-tag">Current Shift</span>
                      <span className="ot-sched-time">{fmt12(availableShifts[0].timeIn)}</span>
                      <span style={{ color: "var(--color-text-faint)" }}>→</span>
                      <span className="ot-sched-time">{fmt12(availableShifts[0].timeOut)}</span>
                    </div>
                  ) : (
                    /* Broken schedule — let employee pick which shift to extend */
                    <div className="ot-shift-picker">
                      <span className="ot-shift-picker-label">
                        Broken schedule detected — select the shift to extend OT {otSubType === "pre_shift" ? "before" : "after"}:
                      </span>
                      <div className="ot-shift-slots">
                        {availableShifts.map((shift, i) => (
                          <div key={i} className={`ot-shift-slot${selectedShiftIndex === i ? " active" : ""}`}
                            onClick={() => { setSelectedShiftIndex(i); setOtStart(""); setOtEnd(""); }}>
                            <div className="ot-shift-slot-radio">
                              {selectedShiftIndex === i && <div className="ot-shift-slot-dot" />}
                            </div>
                            <span className="ot-shift-slot-time">
                              {fmt12(shift.timeIn)} → {fmt12(shift.timeOut)}
                            </span>
                            <span className="ot-shift-slot-label">Shift {i + 1} · {diffHours(shift.timeIn, shift.timeOut)}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}

                {/* OT times */}
                {availableShifts.length > 0 && (
                  <div className="ot-row">
                    <div>
                      <label className="ot-label">OT Start *</label>
                      <input className="form-input" type="time" value={otStart}
                        onChange={e => setOtStart(e.target.value)}
                        readOnly={otSubType === "post_shift" && !!currentShift}
                        style={otSubType === "post_shift" && !!currentShift ? { background: "var(--color-bg-alt)", color: "var(--color-text-muted)" } : {}} />
                      {otSubType === "post_shift" && currentShift && <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 3 }}>Auto-filled from selected shift time-out</div>}
                    </div>
                    <div>
                      <label className="ot-label">OT End *</label>
                      <input className="form-input" type="time" value={otEnd}
                        onChange={e => setOtEnd(e.target.value)}
                        readOnly={otSubType === "pre_shift" && !!currentShift}
                        style={otSubType === "pre_shift" && !!currentShift ? { background: "var(--color-bg-alt)", color: "var(--color-text-muted)" } : {}} />
                      {otSubType === "pre_shift" && currentShift && <div style={{ fontSize: 10, color: "var(--color-text-faint)", marginTop: 3 }}>Auto-filled from selected shift time-in</div>}
                    </div>
                  </div>
                )}

                {otHours > 0 && <div className="ot-hours-pill">⏱ OT Duration: <strong>{otHours}h</strong></div>}

                {newSchedule && otHours > 0 && (
                  <div className="ot-new-sched" style={{ background: otTypeDef.bg, border: `1px solid ${otTypeDef.border}` }}>
                    <div className="ot-new-sched-label" style={{ color: otTypeDef.color }}>New Shift Schedule</div>
                    <div className="ot-new-sched-time" style={{ color: otTypeDef.color }}>
                      {fmt12(newSchedule.timeIn)} → {fmt12(newSchedule.timeOut)}
                    </div>
                  </div>
                )}
              </>
            )}

            {otType === "RestDayOT" && (
              <>
                {restDaySlots.map((slot, index) => {
                  const slotHours = slot.timeIn && slot.timeOut ? diffHours(slot.timeIn, slot.timeOut) : 0;
                  return (
                    <div key={index} className="ot-rd-slot">
                      <div className="ot-rd-slot-header">
                        <span className="ot-rd-slot-label">Shift {index + 1}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {slotHours > 0 && <span className="ot-rd-slot-hours">{slotHours}h</span>}
                          {restDaySlots.length > 1 && <button className="ot-remove-break" onClick={() => setRestDaySlots(p => p.filter((_, i) => i !== index))}>Remove</button>}
                        </div>
                      </div>
                      <div className="ot-row" style={{ marginBottom: 0 }}>
                        <div>
                          <label className="ot-label">Time In *</label>
                          <input className="form-input" type="time" value={slot.timeIn} onChange={e => updateRestSlot(index, "timeIn", e.target.value)} />
                        </div>
                        <div>
                          <label className="ot-label">Time Out *</label>
                          <input className="form-input" type="time" value={slot.timeOut} onChange={e => updateRestSlot(index, "timeOut", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button className="ot-rd-add" onClick={() => setRestDaySlots(p => [...p, { timeIn: "", timeOut: "" }])}>+ Add Another Shift</button>
                {restDayTotalHours > 0 && (
                  <div className="ot-rd-total">⏱ Total OT: <strong>{restDayTotalHours}h</strong> across {restDaySlots.filter(s => s.timeIn && s.timeOut).length} shift{restDaySlots.filter(s => s.timeIn && s.timeOut).length > 1 ? "s" : ""}</div>
                )}
                <div className="ot-field">
                  <label className="ot-label">Break Schedule <span style={{ color: "var(--color-text-faint)", fontWeight: 400, fontSize: 11 }}>(optional)</span></label>
                  {breakOptions.length === 0 ? (
                    <div className="ot-sched-preview"><span className="ot-sched-tag" style={{ color: "var(--color-danger)" }}>⚠ No break schedules found</span></div>
                  ) : (
                    <>
                      {selectedBreakIDs.map((breakID, index) => {
                        const sel = breakOptions.find(b => String(b.id) === breakID);
                        return (
                          <div key={index}>
                            <div className="ot-break-row">
                              <select className="form-select" value={breakID} onChange={e => handleBreakChange(index, e.target.value)} style={{ flex: 1 }}>
                                <option value="">Select a break</option>
                                {breakOptions.map(b => <option key={b.id} value={String(b.id)}>{b.BreakName}</option>)}
                              </select>
                              <button className="ot-remove-break" onClick={() => setSelectedBreakIDs(p => p.length > 1 ? p.filter((_, i) => i !== index) : [""])}>Remove</button>
                            </div>
                            {sel && (
                              <div className="ot-break-preview">
                                <div className="ot-break-preview-label">{sel.BreakName}</div>
                                {sel.BreakSchedule.map((slot, i) => (
                                  <div key={i} className="ot-break-preview-time">Break In: <strong>{fmt12(slot.breakIn)}</strong> → Break Out: <strong>{fmt12(slot.breakOut)}</strong></div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button className="ot-add-break" onClick={() => setSelectedBreakIDs(p => [...p, ""])}>+ Add Another Break</button>
                    </>
                  )}
                </div>
              </>
            )}

            {conflict && <div className={`ot-alert ${conflict.type}`}>{conflict.message}</div>}
            {msg && <div className={`ot-alert ${msg.type}`}>{msg.text}</div>}

            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={submitting || !date || conflict?.type === "conflict" ||
                (otType === "PartTimeOT" && (!otStart || !otEnd || otHours <= 0)) ||
                (otType === "RestDayOT" && restDayTotalHours <= 0)}
              style={{ width: "100%" }}>
              {submitting ? "Saving…" : "Save OT Schedule"}
            </button>
          </div>
        </div>

        <div className="ot-divider" />

        <div className="ot-history-header">
          <span className="ot-history-title">My OT Schedules</span>
          <span className="ot-count">{overrides.length}</span>
        </div>

        {overrides.length === 0 ? (
          <div className="ot-empty">No OT schedules filed yet.</div>
        ) : overrides.map(o => {
          const slots = typeof o.Schedules === "string" ? JSON.parse(o.Schedules) : (o.Schedules ?? []);
          const typeDef = OT_TYPES.find(t => t.key === o.ScheduleType) ?? OT_TYPES[0];
          const statusKey = o.Status ?? "pending";
          const statusStyle = {
            pending:  { bg: "rgba(234,179,8,0.08)",  color: "#92400e", border: "rgba(234,179,8,0.35)",  label: "⏳ Pending" },
            approved: { bg: "rgba(22,163,74,0.08)",  color: "#15803d", border: "rgba(22,163,74,0.25)",  label: "✓ Approved" },
            rejected: { bg: "rgba(220,38,38,0.08)",  color: "#dc2626", border: "rgba(220,38,38,0.25)",  label: "✕ Rejected" },
          }[statusKey];
          return (
            <div key={o.id} className="ot-card">
              <div className="ot-card-icon" style={{ background: typeDef.bg }}>{typeDef.icon}</div>
              <div className="ot-card-info">
                <div className="ot-card-date">{fmtDate(o.Date)}</div>
                {slots.map((slot: any, i: number) => <div key={i} className="ot-card-shift">{fmt12(slot.timeIn)} → {fmt12(slot.timeOut)}</div>)}
                <div className="ot-card-meta">{typeDef.label} · {o.OTHours}h OT{slots.length > 1 ? ` · ${slots.length} shifts` : ""}</div>
                {o.AdminNote && (
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic", marginTop: 3 }}>
                    💬 {o.AdminNote}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: statusStyle?.bg, color: statusStyle?.color, border: `1px solid ${statusStyle?.border}` }}>
                  {statusStyle?.label}
                </span>
                {statusKey === "pending" && (
                  confirmDeleteId === o.id ? (
                    <div className="ot-confirm-row">
                      <span className="ot-confirm-text">Remove?</span>
                      <button className="ot-confirm-yes" disabled={deleteLoading} onClick={() => handleDelete(o.id)}>{deleteLoading ? "…" : "Yes"}</button>
                      <button className="ot-confirm-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </div>
                  ) : (
                    <button className="ot-delete-btn" onClick={() => setConfirmDeleteId(o.id)}>Remove</button>
                  )
                )}
              </div>
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