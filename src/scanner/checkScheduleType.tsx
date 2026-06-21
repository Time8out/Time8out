// checkScheduleType.tsx
import { supabase } from '../../utils/supabase';

type ScheduleSlot = { timeIn: string; timeOut: string };
type BreakSlot = { breakIn: string; breakOut: string };

type BreakEntry = {
  breakIn: string;
  ActualBreakIn: string;
  breakOut: string;
  ActualBreakOut: string;
};

type ShiftEntry = {
  timeIn: string;
  ActualTimeIn: string;
  breaks: BreakEntry[];
  TimeOut: string;
  ActualTimeOut: string;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function distributeSchedule(scheduleSlots: ScheduleSlot[], breakSlots: BreakSlot[]): ShiftEntry[] {
  return scheduleSlots.map(slot => {
    const shiftInMin = timeToMinutes(slot.timeIn);
    let shiftOutMin = timeToMinutes(slot.timeOut);
    if (shiftOutMin <= shiftInMin) shiftOutMin += 24 * 60;

    const slotBreaks = breakSlots
      .filter(b => {
        if (!b?.breakIn || !b?.breakOut) return false;
        let breakInMin = timeToMinutes(b.breakIn);
        let breakOutMin = timeToMinutes(b.breakOut);
        if (breakInMin < shiftInMin) breakInMin += 24 * 60;
        if (breakOutMin < shiftInMin) breakOutMin += 24 * 60;
        return breakInMin >= shiftInMin && breakOutMin <= shiftOutMin;
      })
      .sort((a, b) => {
        let aMin = timeToMinutes(a.breakIn);
        let bMin = timeToMinutes(b.breakIn);
        if (aMin < shiftInMin) aMin += 24 * 60;
        if (bMin < shiftInMin) bMin += 24 * 60;
        return aMin - bMin;
      })
      .map(b => ({
        breakIn: b.breakIn,
        ActualBreakIn: '',
        breakOut: b.breakOut,
        ActualBreakOut: '',
      }));

    return {
      timeIn: slot.timeIn,
      ActualTimeIn: '',
      breaks: slotBreaks,
      TimeOut: slot.timeOut,
      ActualTimeOut: '',
    };
  });
}

export async function checkScheduleType({ EmployeeID, companyCode }: { EmployeeID: string; companyCode: string }) {
  console.log('[checkScheduleType] Running for:', EmployeeID, companyCode);

  // ── Step 1: Get today's date from Supabase server ──────
  const { data: serverTime, error: timeError } = await supabase.rpc('get_server_time');
  if (timeError || !serverTime) {
    console.error('[checkScheduleType] Failed to get server time:', timeError?.message);
    return;
  }

  const today = new Date(serverTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  // ── Step 2: Find open attendance row (night shift support) ──
  const { data: openRow } = await supabase
    .from('Attendance')
    .select('AttendanceDate, ScheduleTimeAndAttendance')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .neq('status', 'Finished')
    .order('AttendanceDate', { ascending: false })
    .limit(1)
    .maybeSingle();

  const attendanceDate = openRow?.AttendanceDate ?? today;

  // ── Step 3: Check if ScheduleTimeAndAttendance already has content ──
  if (openRow?.ScheduleTimeAndAttendance) {
    console.log('[checkScheduleType] ScheduleTimeAndAttendance already has content — skipping.');
    return;
  }

  // ── Step 4: Get ScheduleID and BreakID from users table ─
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('ScheduleID, BreakID')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .single();

  if (userError || !user) {
    console.error('[checkScheduleType] User not found:', userError?.message);
    return;
  }

  const { ScheduleID, BreakID } = user;

  // ── Step 5: Get Schedule from Schedules table ───────────
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('Schedules')
    .select('Schedule')
    .eq('id', ScheduleID)
    .single();

  if (scheduleError || !scheduleData) {
    console.error('[checkScheduleType] Schedule not found:', scheduleError?.message);
    return;
  }

  const scheduleSlots: ScheduleSlot[] = scheduleData.Schedule;

  // ── Step 6: Parse BreakID array and fetch each break ────
  let parsedBreakIDs: string[] = [];
  try {
    parsedBreakIDs = JSON.parse(BreakID);
  } catch {
    console.error('[checkScheduleType] Failed to parse BreakID:', BreakID);
    return;
  }

  const breakSlots: BreakSlot[] = [];

  for (const breakId of parsedBreakIDs) {
    const { data: breakData, error: breakError } = await supabase
      .from('Breaks')
      .select('BreakSchedule')
      .eq('id', breakId)
      .single();

    if (breakError || !breakData) {
      console.error('[checkScheduleType] Break not found for ID:', breakId, breakError?.message);
      continue;
    }

    if (Array.isArray(breakData.BreakSchedule)) {
      breakSlots.push(...breakData.BreakSchedule);
    } else if (breakData.BreakSchedule?.breakIn && breakData.BreakSchedule?.breakOut) {
      breakSlots.push(breakData.BreakSchedule);
    } else {
      console.warn('[checkScheduleType] Unexpected BreakSchedule format for ID:', breakId, breakData.BreakSchedule);
    }
  }

  // ── Step 7: Distribute breaks into shifts ───────────────
  const combined = distributeSchedule(scheduleSlots, breakSlots);

  console.log('[checkScheduleType] Combined schedule:', JSON.stringify(combined, null, 2));

  // ── Step 8: Update Attendance with combined schedule ────
  const { error: updateError } = await supabase
    .from('Attendance')
    .update({ ScheduleTimeAndAttendance: combined })
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate);

  if (updateError) {
    console.error('[checkScheduleType] Update error:', updateError.message);
    return;
  }

  console.log('[checkScheduleType] ScheduleTimeAndAttendance updated successfully for date:', attendanceDate);
}