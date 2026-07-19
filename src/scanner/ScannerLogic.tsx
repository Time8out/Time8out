/**
 * ScannerLogic.tsx
 * Holds all processing logic that runs when a QR scan occurs.
 * Called by QRcodeScanner with the scanned value and company code.
 */

import { supabase } from '../../utils/supabase';
import { getInternetTime } from '../../utils/Getinternettime';
import { fillAttendanceDetails } from './fillAttendanceDetails';
import { checkScheduleType } from './checkScheduleType';
import { inputLiveStamp } from './inputLiveStamp';
import { computeOT } from './OTComputation';
import type { StampResult } from './inputLiveStamp';

export async function handleScan(scannedValue: string, companyCode: string): Promise<StampResult> {

  const internetTime = await getInternetTime();
  const today = internetTime.dateStr;

  console.log('[ScannerLogic] Scan time:', internetTime.timeStr, today, `(source: ${internetTime.source})`);

  // ── Step 1: Look up the employee ───────────────────────
  const { data: employee, error: employeeError } = await supabase
    .from('users')
    .select('EmployeeID, CompanyCode')
    .eq('EmployeeID', scannedValue)
    .eq('CompanyCode', companyCode)
    .single();

  if (employeeError || !employee) {
    console.error('[ScannerLogic] Employee not found:', employeeError?.message);
    return { success: false, message: 'Employee not found. Please check your QR code.' };
  }

  console.log('[ScannerLogic] Employee found:', employee);

  const { EmployeeID } = employee;

  // ── Step 2: Fill attendance row first ──────────────────
  await fillAttendanceDetails({ EmployeeID, companyCode });

  // ── Step 3: Check attendance state AFTER fill ──────────
  const { data: existingAttendance } = await supabase
    .from('Attendance')
    .select('id, ScheduleTimeAndAttendance, status')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .or('status.is.null,status.neq.Finished')
    .order('AttendanceDate', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('[ScannerLogic] existingAttendance:', JSON.stringify(existingAttendance));

  // ── Step 4: Always call checkScheduleType ─────────────
  // Let checkScheduleType decide whether to fill, overwrite, or skip.
  // It handles: override schedules, approved OT, holidays, and regular schedules.
  await checkScheduleType({ EmployeeID, companyCode });

  // ── Step 5: Record the live stamp ──────────────────────
  const result = await inputLiveStamp({ EmployeeID, companyCode });

  // ── Step 6: OT Computation ─────────────────────────────
  await computeOT({ EmployeeID, companyCode });

  return result;
}

const ScannerLogic = { handleScan };
export default ScannerLogic;