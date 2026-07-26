// AttendancePayDispatcher.tsx
// (renamed from AttendanceControl.tsx — that name collides with the admin
//  panel React component of the same name elsewhere in this codebase;
//  keeping both files named identically risks one silently overwriting
//  the other)
//
// Single entry point for pay computation. Reads the Attendance row's
// ScheduleType and dispatches to whichever calculator owns that day:
// RegularHoliday/SpecialHoliday → HolidayCalculator (Holiday + Overtime only)
// everything else               → RegularScheduleComputer (Regular + Overtime only)
//
// Callers (e.g. inputLiveStamp.tsx) should go through this dispatcher instead
// of importing HolidayCalculator/RegularScheduleComputer directly, so the
// holiday/regular decision lives in exactly one place.

import { supabase } from '../../../utils/supabase';
import { HolidayCalculator } from './HolidayCalculator';
import { RegularScheduleComputer } from './RegularScheduleComputer';

export async function AttendancePayDispatcher({
  EmployeeID,
  companyCode,
  attendanceDate,
}: {
  EmployeeID: string;
  companyCode: string;
  attendanceDate: string;
}): Promise<boolean> {
  const { data: attendance, error } = await supabase
    .from('Attendance')
    .select('ScheduleType')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', attendanceDate)
    .single();

  if (error || !attendance) {
    console.error('[AttendancePayDispatcher] Attendance not found:', error?.message);
    return false;
  }

  const scheduleType: string = attendance.ScheduleType ?? '';
  const isHoliday = scheduleType.includes('RegularHoliday') || scheduleType.includes('SpecialHoliday');

  try {
    if (isHoliday) {
      console.log('[AttendancePayDispatcher] ScheduleType is holiday — delegating to HolidayCalculator.');
      await HolidayCalculator({ EmployeeID, companyCode, attendanceDate });
    } else {
      console.log('[AttendancePayDispatcher] ScheduleType is regular — delegating to RegularScheduleComputer.');
      await RegularScheduleComputer({ EmployeeID, companyCode, attendanceDate });
    }
    return true;
  } catch (err) {
    // HolidayCalculator/RegularScheduleComputer don't currently throw on
    // their own errors (they log and return), but this guards against any
    // unexpected exception (network failure, malformed data, etc.) so a
    // single bad record can't crash whatever loop is calling this dispatcher
    // for many employees/dates in sequence.
    console.error('[AttendancePayDispatcher] Unexpected error during dispatch:', err);
    return false;
  }
}