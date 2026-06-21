// fillAttendanceDetails.tsx
import { supabase } from '../../utils/supabase';

export async function fillAttendanceDetails({ EmployeeID, companyCode }: { EmployeeID: string; companyCode: string }) {
  console.log('[fillAttendanceDetails] Running for:', EmployeeID, companyCode);

  // ── Step 1: Get today's date from Supabase server ──────
  const { data: serverTime, error: timeError } = await supabase.rpc('get_server_time');
  if (timeError || !serverTime) {
    console.error('[fillAttendanceDetails] Failed to get server time:', timeError?.message);
    return;
  }

  const today = new Date(serverTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  // ── Step 2: Check for open attendance row (night shift support) ──
  const { data: openRow } = await supabase
    .from('Attendance')
    .select('id, AttendanceDate')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .neq('status', 'Finished')
    .order('AttendanceDate', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Step 3: If open row exists stop here ───────────────
  if (openRow) {
    console.log('[fillAttendanceDetails] Open attendance row exists for date:', openRow.AttendanceDate, '— skipping insert.');
    return;
  }

  // ── Step 4: No open row — check if today's row exists ──
  const { data: existing } = await supabase
    .from('Attendance')
    .select('id')
    .eq('EmployeeID', EmployeeID)
    .eq('CompanyCode', companyCode)
    .eq('AttendanceDate', today)
    .maybeSingle();

  if (existing) {
    console.log('[fillAttendanceDetails] Attendance already exists for today — skipping.');
    return;
  }

  // ── Step 5: Insert new attendance row ──────────────────
  const { error: insertError } = await supabase
    .from('Attendance')
    .insert({
      EmployeeID,
      CompanyCode: companyCode,
      AttendanceDate: today,
    });

  if (insertError) {
    console.error('[fillAttendanceDetails] Insert error:', insertError.message);
    return;
  }

  console.log('[fillAttendanceDetails] Attendance row created for:', EmployeeID, today);
}