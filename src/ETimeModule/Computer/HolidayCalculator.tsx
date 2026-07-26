// HolidayCalculator.tsx
// Called for holiday working days. Computes Holiday pay and Overtime only —
// regular (non-holiday) days are handled entirely by RegularScheduleComputer.tsx.
//
// Kept in lockstep with RegularScheduleComputer.tsx and the live SQL function
// public.compute_attendance_pay() — same span-adjustment logic, same Expected
// Salary calculation, same StampsFeedback peso enrichment. If you change one,
// change the others.

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

interface StampFeedbackEntry {
  type: string;
  actualTime?: string;
  scheduledTime?: string;
  deductionMinutes: number;
  deductionAmount?: number;
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

// Compute scheduled minutes for a shift (timeIn → TimeOut)
function scheduledMinutes(shift: ShiftEntry): number {
  let inMin = timeToMinutes(shift.timeIn);
  let outMin = timeToMinutes(shift.TimeOut);
  if (outMin <= inMin) outMin += 24 * 60; // night shift crossing midnight
  return outMin - inMin;
}

// Which deduction types are ALREADY reflected in the ActualTimeIn/ActualTimeOut
// gap, and therefore must NOT also be subtracted separately:
// - 'late'     → ActualTimeIn is literally the late clock-in time, so the
//                actual-out minus actual-in gap is already shorter.
// - 'earlyout' → ActualTimeOut is literally the early clock-out time, same reason.
// Everything else (overbreak, system_auto_logout, system_auto_breakout, missed)
// does NOT touch ActualTimeIn/ActualTimeOut directly (a mid-shift overbreak
// doesn't change the shift's start/end; an auto-logout buffer pads
// ActualTimeOut later than truly worked) — those still need to be subtracted.
const SPAN_REFLECTED_TYPES = new Set(['late', 'earlyout']);

function computeSpanAdjustmentMinutes(feedback: StampFeedbackEntry[]): number {
  return feedback.reduce((sum, f) => {
    if (SPAN_REFLECTED_TYPES.has(f.type)) return sum;
    return sum + (f.deductionMinutes ?? 0);
  }, 0);
}

// Compute actual worked minutes considering:
// - Cap at scheduled hours (don't over-calculate)
// - Apply only the deductions NOT already reflected in Actual clock times
function computeWorkedMinutes(
  schedule: ShiftEntry[],
  spanAdjustmentMins: number
): number {
  let totalScheduledMins = 0;
  let totalActualMins = 0;

  for (const shift of schedule) {
    const schedMins = scheduledMinutes(shift);
    totalScheduledMins += schedMins;

    if (!shift.ActualTimeIn || !shift.ActualTimeOut) continue;

    // Actual worked = from ActualTimeIn to ActualTimeOut
    let actualIn = timeToMinutes(shift.ActualTimeIn);
    let actualOut = timeToMinutes(shift.ActualTimeOut);

    // Handle midnight crossing
    const schedIn = timeToMinutes(shift.timeIn);
    if (actualIn < schedIn - 60) actualIn += 24 * 60;
    if (actualOut <= actualIn) actualOut += 24 * 60;

    let workedMins = actualOut - actualIn;

    // Cap at scheduled hours — don't compute excess
    workedMins = Math.min(workedMins, schedMins);

    totalActualMins += workedMins;
  }

  // Apply only the deductions not already baked into the actual clock gap
  // (overbreak, auto-logout/auto-breakout padding, missed shifts) —
  // late/earlyout are NOT subtracted again here, since they already
  // shortened the gap above.
  const deductedMins = Math.max(0, totalActualMins - spanAdjustmentMins);

  // Final cap at total scheduled hours
  return Math.min(deductedMins, totalScheduledMins);
}

// Derive hourly rate from PayStructure
function getHourlyRate(ps: PayStructureEntry, scheduledHoursPerDay: number): number {
  const base = parseFloat(ps.Formula);
  switch (ps.Structure) {
    case 'Hourly':  return base;
    case 'Daily':   return base / scheduledHoursPerDay;
    case 'Monthly': {
      // Assume 26 working days per month, use scheduled hours per day
      const monthlyHours = 26 * scheduledHoursPerDay;
      return base / monthlyHours;
    }
    default: return 0;
  }
}

export async function HolidayCalculator({
  EmployeeID,
  companyCode,
  attendanceDate,
}: {
  EmployeeID: string;
  companyCode: string;
  attendanceDate: string;
}) {
  console.log('[HolidayCalculator] Running for:', EmployeeID, companyCode, attendanceDate);

  // ── Step 1: Fetch attendance row ──────────────────────
  const { data: attendance, error: attError } = await supabase
    .from('Attendance')
    .select('ScheduleTimeAndAttendance, StampsFeedback, TimeDeduction, ScheduleType')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate)
    .single();

  if (attError || !attendance) {
    console.error('[HolidayCalculator] Attendance not found:', attError?.message);
    return;
  }

  const scheduleType: string = attendance.ScheduleType ?? '';
  const isRegularHoliday = scheduleType.includes('RegularHoliday');
  const isSpecialHoliday = scheduleType.includes('SpecialHoliday');

  if (!isRegularHoliday && !isSpecialHoliday) {
    console.log('[HolidayCalculator] No holiday type in ScheduleType — skipping.');
    return;
  }

  console.log('[HolidayCalculator] Holiday type:', isRegularHoliday ? 'RegularHoliday' : 'SpecialHoliday');

  const schedule: ShiftEntry[] = typeof attendance.ScheduleTimeAndAttendance === 'string'
    ? JSON.parse(attendance.ScheduleTimeAndAttendance)
    : (attendance.ScheduleTimeAndAttendance ?? []);

  const stampsFeedback: StampFeedbackEntry[] = typeof attendance.StampsFeedback === 'string'
    ? (attendance.StampsFeedback ? JSON.parse(attendance.StampsFeedback) : [])
    : (attendance.StampsFeedback ?? []);

  const spanAdjustmentMins = computeSpanAdjustmentMinutes(stampsFeedback);

  if (schedule.length === 0) {
    console.log('[HolidayCalculator] No schedule data — skipping.');
    return;
  }

  // ── Step 2: Fetch PayStructure from users ─────────────
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('PayStructure, Currency')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .single();

  if (userError || !user?.PayStructure) {
    console.error('[HolidayCalculator] PayStructure not found:', userError?.message);
    return;
  }

  const psArray: PayStructureEntry[] = typeof user.PayStructure === 'string'
    ? JSON.parse(user.PayStructure)
    : user.PayStructure;

  const ps = psArray.find(p => ['Daily', 'Monthly', 'Hourly'].includes(p.Structure));
  if (!ps) {
    console.error('[HolidayCalculator] No base pay structure found.');
    return;
  }

  console.log('[HolidayCalculator] PayStructure:', ps.Structure, ps.Formula);

  // ── Step 3: Compute total scheduled hours per day ─────
  const totalScheduledMins = schedule.reduce((sum, shift) => sum + scheduledMinutes(shift), 0);
  const scheduledHoursPerDay = totalScheduledMins / 60;

  console.log('[HolidayCalculator] Scheduled hours per day:', scheduledHoursPerDay);

  // ── Step 4: Compute actual worked minutes ─────────────
  const workedMins = computeWorkedMinutes(schedule, spanAdjustmentMins);
  const workedHours = workedMins / 60;

  console.log('[HolidayCalculator] Worked hours (after deduction, capped):', workedHours);

  // ── Step 5: Get hourly rate ────────────────────────────
  // (computed before the zero-hours check — needed to price StampsFeedback
  // entries and compute Expected Salary even on a fully-missed day)
  const hourlyRate = getHourlyRate(ps, scheduledHoursPerDay);
  console.log('[HolidayCalculator] Hourly rate:', hourlyRate);

  // ── Enrich StampsFeedback with a peso deductionAmount per entry ──
  const enrichedFeedback: StampFeedbackEntry[] = stampsFeedback.map(f => ({
    ...f,
    deductionAmount: Math.round(hourlyRate * ((f.deductionMinutes ?? 0) / 60) * 100) / 100,
  }));

  // ── Step 6: Check for OT on this date ────────────────
  // (moved before the zero-hours check — OT is pre-approved and doesn't
  //  depend on whether the employee actually clocked in today)
  const { data: otRow } = await supabase
    .from('Overtime')
    .select('OTHours, ScheduleType, Schedules')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('Date', attendanceDate)
    .eq('Status', 'approved')
    .maybeSingle();

  const hasOT = !!otRow;
  const otHours = otRow?.OTHours ?? 0;
  const isRestDayOT = hasOT && otHours >= scheduledHoursPerDay;
  const isPartTimeOT = hasOT && otHours < scheduledHoursPerDay;

  console.log('[HolidayCalculator] OT found:', hasOT, '| OTHours:', otHours, '| RestDayOT:', isRestDayOT, '| PartTimeOT:', isPartTimeOT);

  // ── Apply holiday + OT rates ─────────────────────────
  const holidayRate = isRegularHoliday
    ? parsePercent(ps.RegularHolidayOT)
    : parsePercent(ps.SpecialHolidayOT);

  const partTimeOTRate = parsePercent(ps.PartTimeOT);
  const restDayOTRate  = parsePercent(ps.RestDayOT);

  // ── Expected Salary: what pay WOULD be with zero lateness/deductions ──
  // Same formula shape as the actual pay below, but using the full
  // scheduled hours instead of workedHours (which has deductions baked in).
  let expectedHolidayPay = 0;
  let expectedOvertimePay = 0;

  if (isRestDayOT) {
    expectedHolidayPay = Math.round(hourlyRate * scheduledHoursPerDay * (1 + holidayRate) * 100) / 100;
    expectedOvertimePay = Math.round(hourlyRate * scheduledHoursPerDay * restDayOTRate * 100) / 100;
  } else if (isPartTimeOT) {
    const expectedRegularHours = Math.max(0, scheduledHoursPerDay - otHours);
    const expectedOtWorkedHours = Math.min(otHours, scheduledHoursPerDay);
    expectedHolidayPay = Math.round(hourlyRate * expectedRegularHours * (1 + holidayRate) * 100) / 100;
    expectedOvertimePay = Math.round(hourlyRate * expectedOtWorkedHours * (1 + holidayRate + partTimeOTRate) * 100) / 100;
  } else {
    expectedHolidayPay = Math.round(hourlyRate * scheduledHoursPerDay * (1 + holidayRate) * 100) / 100;
    expectedOvertimePay = 0;
  }

  // Expected Night Shift Differential — uses the SCHEDULED timeIn/TimeOut
  // (not ActualTimeIn/ActualTimeOut), since this represents "if they
  // clocked in and out exactly on schedule."
  const nightDiffRateForExpected = parsePercent(ps.NightDiffRate);
  let expectedNightShiftDiff = 0;

  if (nightDiffRateForExpected > 0 && ps.NightDiffTimeSpan) {
    const [ndStart, ndEnd] = ps.NightDiffTimeSpan.split('-').map(t => t.trim());
    const ndStartMin = timeToMinutes(ndStart);
    let ndEndMin = timeToMinutes(ndEnd);
    if (ndEndMin <= ndStartMin) ndEndMin += 24 * 60;

    let expectedNightMins = 0;
    for (const shift of schedule) {
      const schedIn = timeToMinutes(shift.timeIn);
      let schedOut = timeToMinutes(shift.TimeOut);
      if (schedOut <= schedIn) schedOut += 24 * 60;

      const overlapStart = Math.max(schedIn, ndStartMin);
      const overlapEnd = Math.min(schedOut, ndEndMin);
      if (overlapEnd > overlapStart) expectedNightMins += overlapEnd - overlapStart;
    }

    if (hasOT && otRow?.Schedules) {
      const otSlots = typeof otRow.Schedules === 'string' ? JSON.parse(otRow.Schedules) : otRow.Schedules;
      for (const slot of otSlots) {
        let otIn = timeToMinutes(slot.timeIn);
        let otOut = timeToMinutes(slot.timeOut);
        if (otOut <= otIn) otOut += 24 * 60;
        const overlapStart = Math.max(otIn, ndStartMin);
        const overlapEnd = Math.min(otOut, ndEndMin);
        if (overlapEnd > overlapStart) expectedNightMins += overlapEnd - overlapStart;
      }
    }

    expectedNightShiftDiff = Math.round(hourlyRate * (expectedNightMins / 60) * nightDiffRateForExpected * 100) / 100;
  }

  if (workedHours <= 0) {
    console.log('[HolidayCalculator] No hours worked — Holiday pay = 0 (Expected still computed).');
    await supabase.from('Attendance').update({
      Regular: 0,
      Holiday: 0,
      Overtime: 0,
      NightShiftDifferential: 0,
      ExpectedRegular: 0,
      ExpectedHoliday: expectedHolidayPay,
      ExpectedOvertime: expectedOvertimePay,
      ExpectedNightShiftDifferential: expectedNightShiftDiff,
      StampsFeedback: enrichedFeedback,
    })
      .eq('EmployeeID', EmployeeID).eq('CompanyCode', companyCode).eq('AttendanceDate', attendanceDate);
    return;
  }

  // ── Step 7: Compute actual Holiday & Overtime pay ─────
  let holidayPay = 0;
  let overtimePay = 0;

  if (isRestDayOT) {
    // Rest Day OT — whole day is OT, split: base holiday in Holiday, OT premium in Overtime
    const baseHolidayPay = Math.round(hourlyRate * workedHours * (1 + holidayRate) * 100) / 100;
    const restDayPremium = Math.round(hourlyRate * workedHours * restDayOTRate * 100) / 100;
    holidayPay  = baseHolidayPay;
    overtimePay = restDayPremium;
    console.log('[HolidayCalculator] RestDayOT — Holiday:', holidayPay, '| OT premium:', overtimePay);

  } else if (isPartTimeOT) {
    // Part Time OT — regular hours → Holiday, OT hours → Overtime
    const regularHours   = Math.max(0, workedHours - otHours);
    const otWorkedHours  = Math.min(otHours, workedHours);

    holidayPay  = Math.round(hourlyRate * regularHours * (1 + holidayRate) * 100) / 100;
    overtimePay = Math.round(hourlyRate * otWorkedHours * (1 + holidayRate + partTimeOTRate) * 100) / 100;

    console.log('[HolidayCalculator] PartTimeOT — regularHours:', regularHours, '| otWorkedHours:', otWorkedHours);
    console.log('[HolidayCalculator] Holiday:', holidayPay, '| OT:', overtimePay);

  } else {
    // No OT — all goes to Holiday
    holidayPay  = Math.round(hourlyRate * workedHours * (1 + holidayRate) * 100) / 100;
    overtimePay = 0;
    console.log('[HolidayCalculator] No OT — Holiday only:', holidayPay);
  }

  console.log('[HolidayCalculator] Final — Holiday:', holidayPay, '| Overtime:', overtimePay);

  // ── Step 8: Compute Night Shift Differential ──────────
  const nightDiffRate = parsePercent(ps.NightDiffRate);
  let nightShiftDiff = 0;

  if (nightDiffRate > 0 && ps.NightDiffTimeSpan) {
    const [ndStart, ndEnd] = ps.NightDiffTimeSpan.split('-').map(t => t.trim());
    const ndStartMin = timeToMinutes(ndStart); // e.g. 22:00 = 1320
    let ndEndMin = timeToMinutes(ndEnd);       // e.g. 06:00 = 360
    // Night diff span crosses midnight — end is next day
    if (ndEndMin <= ndStartMin) ndEndMin += 24 * 60; // 360 + 1440 = 1800

    let nightMins = 0;

    for (const shift of schedule) {
      if (!shift.ActualTimeIn || !shift.ActualTimeOut) continue;

      let actualIn  = timeToMinutes(shift.ActualTimeIn);
      let actualOut = timeToMinutes(shift.ActualTimeOut);
      const schedIn = timeToMinutes(shift.timeIn);

      // Handle midnight crossing for actual stamps
      if (actualIn < schedIn - 60) actualIn += 24 * 60;
      if (actualOut <= actualIn) actualOut += 24 * 60;

      // Cap actual out at scheduled out
      const schedOut = timeToMinutes(shift.TimeOut) <= timeToMinutes(shift.timeIn)
        ? timeToMinutes(shift.TimeOut) + 24 * 60
        : timeToMinutes(shift.TimeOut);
      actualOut = Math.min(actualOut, schedOut + (actualIn - schedIn > 0 ? 0 : 0));

      // Normalize actual times to same day reference as night diff span
      // If actualIn is before ndStart, push to next-day reference
      let normIn  = actualIn;
      let normOut = actualOut;

      // Overlap with night diff window [ndStartMin, ndEndMin]
      const overlapStart = Math.max(normIn, ndStartMin);
      const overlapEnd   = Math.min(normOut, ndEndMin);

      if (overlapEnd > overlapStart) {
        nightMins += overlapEnd - overlapStart;
      }

      // Also check if shift wraps: e.g. shift is 19:00-03:00
      // actualIn=19:00=1140, ndStart=22:00=1320, ndEnd=06:00=1800(next day)
      // The overlap check above handles this since ndEndMin is already +1440
    }

    // Also include OT hours that fall in night diff span
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

    // Apply deduction proportionally to night hours
    const nightHours = nightMins / 60;
    nightShiftDiff = Math.round(hourlyRate * nightHours * nightDiffRate * 100) / 100;
    console.log('[HolidayCalculator] Night diff hours:', nightHours, '| Rate:', nightDiffRate, '| Amount:', nightShiftDiff);
  }

  // ── Step 9: Write all to Attendance ───────────────────
  const { error: updateError } = await supabase
    .from('Attendance')
    .update({
      Regular: 0,
      Holiday: holidayPay,
      Overtime: overtimePay,
      NightShiftDifferential: nightShiftDiff,
      ExpectedRegular: 0,
      ExpectedHoliday: expectedHolidayPay,
      ExpectedOvertime: expectedOvertimePay,
      ExpectedNightShiftDifferential: expectedNightShiftDiff,
      StampsFeedback: enrichedFeedback,
    })
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate);

  if (updateError) {
    console.error('[HolidayCalculator] Failed to write pay:', updateError.message);
    return;
  }

  console.log('[HolidayCalculator] Written — Holiday:', holidayPay, '| Overtime:', overtimePay, '| NightDiff:', nightShiftDiff, '| Expected Holiday:', expectedHolidayPay);
}
