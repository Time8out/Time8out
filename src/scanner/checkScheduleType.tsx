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

  // ── Step 3: Check Overtime table — only use if Status = 'approved' ──
  const { data: otRow } = await supabase
    .from('Overtime')
    .select('Schedules, Breaks, Status, ScheduleType')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('Date', attendanceDate)
    .maybeSingle();

  // ── Step 4: Check OverrideSchedules for regular override ──
  console.log('[checkScheduleType] Querying override for EmployeeID:', EmployeeID, '| CompanyCode:', companyCode, '| DateCoverage:', attendanceDate);
  const { data: overrideRow, error: overrideError } = await supabase
    .from('OverrideSchedules')
    .select('Schedules, Breaks, ShiftCoverage')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('DateCoverage', attendanceDate)
    .maybeSingle();

  console.log('[checkScheduleType] Override query result:', overrideRow ? JSON.stringify(overrideRow) : 'not found', overrideError?.message ?? '');

  // ── Step 5: Check Holidays table (one-time + recurring) ──
  const dateObj = new Date(attendanceDate + 'T00:00:00');
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  const { data: allHolidays } = await supabase
    .from('Holidays')
    .select('Name, Type, Date, Recurring')
    .eq('CompanyCode', companyCode);

  const activeHoliday = (allHolidays ?? []).find(h => {
    if (h.Date === attendanceDate) return true;
    if (h.Recurring) {
      const hDate = new Date(h.Date + 'T00:00:00');
      return hDate.getMonth() + 1 === month && hDate.getDate() === day;
    }
    return false;
  }) ?? null;

  // ── Step 6: Build ScheduleType label ───────────────────
  // Collect all tags that apply to this attendance date
  const tags: string[] = [];

  const approvedOT = otRow?.Status === 'approved' ? otRow : null;

  if (approvedOT) {
    // OT type: PartTimeOT → "Overtime", RestDayOT → "RestDayOT"
    tags.push(otRow!.ScheduleType === 'RestDayOT' ? 'RestDayOT' : 'Overtime');
  }

  if (overrideRow) {
    tags.push('Override');
  }

  if (!approvedOT && !overrideRow) {
    tags.push('Regular');
  }

  if (activeHoliday) {
    tags.push(activeHoliday.Type === 'regular' ? 'RegularHoliday' : 'SpecialHoliday');
  }

  // Combine into comma-separated label e.g. "Regular,RegularHoliday" or "Override,Overtime"
  const scheduleTypeLabel = tags.join(',');

  console.log('[checkScheduleType] ScheduleType label:', scheduleTypeLabel);
  console.log('[checkScheduleType] OT:', otRow?.Status ?? 'none', '| Override:', overrideRow ? 'yes' : 'no', '| Holiday:', activeHoliday?.Name ?? 'none');

  // ── Step 7: Determine active schedule source ────────────
  const activeRow = approvedOT ?? overrideRow ?? null;

  // If nothing overrides and already has content — just update the label
  if (!activeRow && openRow?.ScheduleTimeAndAttendance) {
    // Still update ScheduleType label even if schedule content stays the same
    if (activeHoliday) {
      await supabase
        .from('Attendance')
        .update({ ScheduleType: scheduleTypeLabel })
        .eq('EmployeeID', EmployeeID)
        .eq('CompanyCode', companyCode)
        .eq('AttendanceDate', attendanceDate);
      console.log('[checkScheduleType] Updated ScheduleType label only (schedule already exists):', scheduleTypeLabel);
    } else {
      console.log('[checkScheduleType] No override/OT and ScheduleTimeAndAttendance already has content — skipping.');
    }
    return;
  }

  let combined: ShiftEntry[];

  if (activeRow) {
    console.log('[checkScheduleType] Override/OT schedule found for date:', attendanceDate);

    const overrideSlots: ScheduleSlot[] = typeof activeRow.Schedules === 'string'
      ? JSON.parse(activeRow.Schedules)
      : (activeRow.Schedules ?? []);

    const overrideBreaks: BreakSlot[] = typeof activeRow.Breaks === 'string'
      ? JSON.parse(activeRow.Breaks)
      : (activeRow.Breaks ?? []);

    combined = distributeSchedule(overrideSlots, overrideBreaks);

    // Preserve any actual stamps already recorded from the old schedule
    const existingSchedule: ShiftEntry[] = openRow?.ScheduleTimeAndAttendance ?? [];
    combined = combined.map((shift, i) => {
      const existing = existingSchedule[i];
      if (!existing) return shift;
      return {
        ...shift,
        ActualTimeIn: existing.ActualTimeIn || shift.ActualTimeIn,
        ActualTimeOut: existing.ActualTimeOut || shift.ActualTimeOut,
        breaks: shift.breaks.map((brk, j) => {
          const existingBreak = existing.breaks?.[j];
          if (!existingBreak) return brk;
          return {
            ...brk,
            ActualBreakIn: existingBreak.ActualBreakIn || brk.ActualBreakIn,
            ActualBreakOut: existingBreak.ActualBreakOut || brk.ActualBreakOut,
          };
        }),
      };
    });

    console.log('[checkScheduleType] Using override/OT schedule (with preserved stamps):', JSON.stringify(combined, null, 2));

  } else {
    // ── Fall back to regular schedule ──────────────────────
    console.log('[checkScheduleType] No override found — using regular schedule.');

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

    combined = distributeSchedule(scheduleSlots, breakSlots);
    console.log('[checkScheduleType] Using regular schedule:', JSON.stringify(combined, null, 2));
  }

  // ── Step 8: Update Attendance with schedule + ScheduleType label ──
  const { error: updateError } = await supabase
    .from('Attendance')
    .update({
      ScheduleTimeAndAttendance: combined,
      ScheduleType: scheduleTypeLabel,
    })
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate);

  if (updateError) {
    console.error('[checkScheduleType] Update error:', updateError.message);
    return;
  }

  console.log('[checkScheduleType] Updated successfully. ScheduleType:', scheduleTypeLabel, '| Date:', attendanceDate);
}