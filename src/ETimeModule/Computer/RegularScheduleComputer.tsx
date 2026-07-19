// RegularScheduleComputer.tsx
// Called when the employee's last stamp is on a regular working day (no holiday).

import { supabase } from '../../../utils/supabase';

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

interface ShiftEntry {
  timeIn: string;
  TimeOut: string;
  ActualTimeIn: string;
  ActualTimeOut: string;
  breaks: {
    breakIn: string;
    breakOut: string;
    ActualBreakIn: string;
    ActualBreakOut: string;
  }[];
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function parsePercent(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace('%', '')) / 100;
}

function scheduledMinutes(shift: ShiftEntry): number {
  let inMin  = timeToMinutes(shift.timeIn);
  let outMin = timeToMinutes(shift.TimeOut);
  if (outMin <= inMin) outMin += 24 * 60;
  return outMin - inMin;
}

function computeWorkedMinutes(schedule: ShiftEntry[], totalDeductionMins: number): number {
  let totalScheduledMins = 0;
  let totalActualMins    = 0;

  for (const shift of schedule) {
    const schedMins = scheduledMinutes(shift);
    totalScheduledMins += schedMins;

    if (!shift.ActualTimeIn || !shift.ActualTimeOut) continue;

    let actualIn  = timeToMinutes(shift.ActualTimeIn);
    let actualOut = timeToMinutes(shift.ActualTimeOut);
    const schedIn = timeToMinutes(shift.timeIn);

    if (actualIn < schedIn - 60) actualIn += 24 * 60;
    if (actualOut <= actualIn)   actualOut += 24 * 60;

    // Cap at scheduled hours
    let workedMins = Math.min(actualOut - actualIn, schedMins);
    totalActualMins += workedMins;
  }

  // Apply deductions, cap at scheduled
  return Math.min(Math.max(0, totalActualMins - totalDeductionMins), totalScheduledMins);
}

function getHourlyRate(ps: PayStructureEntry, scheduledHoursPerDay: number): number {
  const base = parseFloat(ps.Formula);
  switch (ps.Structure) {
    case 'Hourly':  return base;
    case 'Daily':   return base / scheduledHoursPerDay;
    case 'Monthly': return base / (26 * scheduledHoursPerDay);
    default:        return 0;
  }
}

export async function RegularScheduleComputer({
  EmployeeID,
  companyCode,
  attendanceDate,
}: {
  EmployeeID: string;
  companyCode: string;
  attendanceDate: string;
}) {
  console.log('[RegularScheduleComputer] Running for:', EmployeeID, companyCode, attendanceDate);

  // ── Step 1: Fetch attendance row ──────────────────────
  const { data: attendance, error: attError } = await supabase
    .from('Attendance')
    .select('ScheduleTimeAndAttendance, StampsFeedback, TimeDeduction, ScheduleType')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate)
    .single();

  if (attError || !attendance) {
    console.error('[RegularScheduleComputer] Attendance not found:', attError?.message);
    return;
  }

  const schedule: ShiftEntry[] = typeof attendance.ScheduleTimeAndAttendance === 'string'
    ? JSON.parse(attendance.ScheduleTimeAndAttendance)
    : (attendance.ScheduleTimeAndAttendance ?? []);

  const timeDeduction: number = attendance.TimeDeduction ?? 0;

  if (schedule.length === 0) {
    console.log('[RegularScheduleComputer] No schedule data — skipping.');
    return;
  }

  // ── Step 2: Fetch PayStructure ────────────────────────
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('PayStructure, Currency')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .single();

  if (userError || !user?.PayStructure) {
    console.error('[RegularScheduleComputer] PayStructure not found:', userError?.message);
    return;
  }

  const psArray: PayStructureEntry[] = typeof user.PayStructure === 'string'
    ? JSON.parse(user.PayStructure)
    : user.PayStructure;

  const ps = psArray.find(p => ['Daily', 'Monthly', 'Hourly'].includes(p.Structure));
  if (!ps) {
    console.error('[RegularScheduleComputer] No base pay structure found.');
    return;
  }

  console.log('[RegularScheduleComputer] PayStructure:', ps.Structure, ps.Formula);

  // ── Step 3: Scheduled hours per day ──────────────────
  const totalScheduledMins    = schedule.reduce((sum, s) => sum + scheduledMinutes(s), 0);
  const scheduledHoursPerDay  = totalScheduledMins / 60;
  console.log('[RegularScheduleComputer] Scheduled hours/day:', scheduledHoursPerDay);

  // ── Step 4: Actual worked hours ───────────────────────
  const workedMins  = computeWorkedMinutes(schedule, timeDeduction);
  const workedHours = workedMins / 60;
  console.log('[RegularScheduleComputer] Worked hours (deducted, capped):', workedHours);

  if (workedHours <= 0) {
    console.log('[RegularScheduleComputer] No hours worked — all pay = 0.');
    await supabase.from('Attendance').update({ Regular: 0, Overtime: 0, NightShiftDifferential: 0 })
      .eq('EmployeeID', EmployeeID).eq('CompanyCode', companyCode).eq('AttendanceDate', attendanceDate);
    return;
  }

  // ── Step 5: Hourly rate ───────────────────────────────
  const hourlyRate = getHourlyRate(ps, scheduledHoursPerDay);
  console.log('[RegularScheduleComputer] Hourly rate:', hourlyRate);

  // ── Step 6: Check for approved OT ────────────────────
  const { data: otRow } = await supabase
    .from('Overtime')
    .select('OTHours, ScheduleType, Schedules, Status')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('Date', attendanceDate)
    .eq('Status', 'approved')
    .maybeSingle();

  const hasOT       = !!otRow;
  const otHours     = otRow?.OTHours ?? 0;
  const isRestDayOT = hasOT && otHours >= scheduledHoursPerDay;
  const isPartTimeOT = hasOT && otHours < scheduledHoursPerDay;

  const partTimeOTRate = parsePercent(ps.PartTimeOT);
  const restDayOTRate  = parsePercent(ps.RestDayOT);

  console.log('[RegularScheduleComputer] OT:', hasOT, '| OTHours:', otHours, '| RestDay:', isRestDayOT, '| PartTime:', isPartTimeOT);

  // ── Step 7: Compute Regular & Overtime pay ────────────
  let regularPay  = 0;
  let overtimePay = 0;

  if (isRestDayOT) {
    // Whole day is rest day OT — base pay in Regular, OT premium in Overtime
    regularPay  = Math.round(hourlyRate * workedHours * 100) / 100;
    overtimePay = Math.round(hourlyRate * workedHours * restDayOTRate * 100) / 100;
    console.log('[RegularScheduleComputer] RestDayOT — Regular:', regularPay, '| OT premium:', overtimePay);

  } else if (isPartTimeOT) {
    // Regular shift hours → base rate, OT hours → base + PartTimeOT%
    const regularHours  = Math.max(0, workedHours - otHours);
    const otWorkedHours = Math.min(otHours, workedHours);

    regularPay  = Math.round(hourlyRate * regularHours * 100) / 100;
    overtimePay = Math.round(hourlyRate * otWorkedHours * (1 + partTimeOTRate) * 100) / 100;
    console.log('[RegularScheduleComputer] PartTimeOT — regularHours:', regularHours, '| otHours:', otWorkedHours);
    console.log('[RegularScheduleComputer] Regular:', regularPay, '| OT:', overtimePay);

  } else {
    // No OT — all regular pay
    regularPay  = Math.round(hourlyRate * workedHours * 100) / 100;
    overtimePay = 0;
    console.log('[RegularScheduleComputer] No OT — Regular only:', regularPay);
  }

  // ── Step 8: Night Shift Differential ─────────────────
  const nightDiffRate = parsePercent(ps.NightDiffRate);
  let nightShiftDiff  = 0;

  if (nightDiffRate > 0 && ps.NightDiffTimeSpan) {
    const [ndStart, ndEnd] = ps.NightDiffTimeSpan.split('-').map(t => t.trim());
    const ndStartMin = timeToMinutes(ndStart);
    let ndEndMin     = timeToMinutes(ndEnd);
    if (ndEndMin <= ndStartMin) ndEndMin += 24 * 60; // crosses midnight

    let nightMins = 0;

    for (const shift of schedule) {
      if (!shift.ActualTimeIn || !shift.ActualTimeOut) continue;

      let actualIn  = timeToMinutes(shift.ActualTimeIn);
      let actualOut = timeToMinutes(shift.ActualTimeOut);
      const schedIn = timeToMinutes(shift.timeIn);

      if (actualIn < schedIn - 60) actualIn += 24 * 60;
      if (actualOut <= actualIn)   actualOut += 24 * 60;

      // Cap at scheduled out
      const schedOutMin = timeToMinutes(shift.TimeOut) <= timeToMinutes(shift.timeIn)
        ? timeToMinutes(shift.TimeOut) + 24 * 60
        : timeToMinutes(shift.TimeOut);
      actualOut = Math.min(actualOut, schedOutMin + (actualIn > schedIn ? 24 * 60 : 0));

      // Overlap with night diff window
      const overlapStart = Math.max(actualIn, ndStartMin);
      const overlapEnd   = Math.min(actualOut, ndEndMin);
      if (overlapEnd > overlapStart) nightMins += overlapEnd - overlapStart;
    }

    // Include OT hours that fall in night diff span
    if (hasOT && otRow?.Schedules) {
      const otSlots = typeof otRow.Schedules === 'string' ? JSON.parse(otRow.Schedules) : otRow.Schedules;
      for (const slot of otSlots) {
        let otIn  = timeToMinutes(slot.timeIn);
        let otOut = timeToMinutes(slot.timeOut);
        if (otOut <= otIn) otOut += 24 * 60;
        const overlapStart = Math.max(otIn, ndStartMin);
        const overlapEnd   = Math.min(otOut, ndEndMin);
        if (overlapEnd > overlapStart) nightMins += overlapEnd - overlapStart;
      }
    }

    const nightHours = nightMins / 60;
    nightShiftDiff   = Math.round(hourlyRate * nightHours * nightDiffRate * 100) / 100;
    console.log('[RegularScheduleComputer] Night diff hours:', nightHours, '| Rate:', nightDiffRate, '| Amount:', nightShiftDiff);
  }

  // ── Step 9: Write to Attendance ───────────────────────
  const { error: updateError } = await supabase
    .from('Attendance')
    .update({
      Regular:                regularPay,
      Overtime:               overtimePay,
      NightShiftDifferential: nightShiftDiff,
    })
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate);

  if (updateError) {
    console.error('[RegularScheduleComputer] Failed to write:', updateError.message);
    return;
  }

  console.log('[RegularScheduleComputer] Written — Regular:', regularPay, '| Overtime:', overtimePay, '| NightDiff:', nightShiftDiff);
}