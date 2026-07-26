// inputLiveStamp.tsx
import { supabase } from '../../utils/supabase';
import { AttendancePayDispatcher } from '../ETimeModule/Computer/AttendanceDispatcher';

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

type FeedbackEntry = {
  type: 'late' | 'overbreak' | 'earlyout';
  scheduledTime: string;
  actualTime: string;
  deductionMinutes: number;
};

export type StampResult = {
  success: boolean;
  message: string;
};

const GRACE_PERIOD = 2;
const WINDOW = 15;
const COOLDOWN_MS = 3000;

const processingMap = new Map<string, boolean>();
const cooldownMap = new Map<string, number>();

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function diffMinutes(scheduled: string, actual: string, crossesMidnight = false): number {
  let scheduledMin = timeToMinutes(scheduled);
  let actualMin = timeToMinutes(actual);
  if (crossesMidnight && actualMin < scheduledMin) actualMin += 24 * 60;
  return actualMin - scheduledMin;
}

function isWithinWindow(scheduledTime: string, currentTime: string): boolean {
  const scheduledMin = timeToMinutes(scheduledTime);
  const currentMin = timeToMinutes(currentTime);
  const diff = Math.abs(currentMin - scheduledMin);
  const diffWrapped = Math.abs(currentMin + 1440 - scheduledMin);
  return Math.min(diff, diffWrapped) <= WINDOW;
}

function computeTotalWorkingMinutes(schedule: ShiftEntry[]): number {
  let total = 0;
  for (const shift of schedule) {
    let shiftInMin = timeToMinutes(shift.timeIn);
    let shiftOutMin = timeToMinutes(shift.TimeOut);
    if (shiftOutMin <= shiftInMin) shiftOutMin += 24 * 60;
    total += shiftOutMin - shiftInMin;
  }
  return total;
}

export async function inputLiveStamp({ EmployeeID, companyCode }: { EmployeeID: string; companyCode: string }): Promise<StampResult> {
  console.log('[inputLiveStamp] Running for:', EmployeeID, companyCode);

  const key = `${EmployeeID}-${companyCode}`;

  if (processingMap.get(key)) {
    console.log('[inputLiveStamp] Already processing — skipping duplicate.');
    return { success: false, message: 'Already processing — please wait.' };
  }

  const lastStamp = cooldownMap.get(key) ?? 0;
  if (Date.now() - lastStamp < COOLDOWN_MS) {
    console.log('[inputLiveStamp] Cooldown active — skipping scan.');
    return { success: false, message: 'Scan registered too quickly. Please wait a moment.' };
  }

  processingMap.set(key, true);

  try {
    // ── Step 1: Get current time ────────────────────────────
    const { data: serverTime, error: timeError } = await supabase.rpc('get_server_time');
    if (timeError || !serverTime) {
      console.error('[inputLiveStamp] Failed to get server time:', timeError?.message);
      return { success: false, message: 'Failed to get server time.' };
    }

    const now = new Date(serverTime);
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const currentTime = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false,
    });

    console.log('[inputLiveStamp] Current time:', currentTime, today);

    // ── Step 2: Find open attendance row ───────────────────
    const { data: openRow, error: openRowError } = await supabase
      .from('Attendance')
      .select('AttendanceDate, ScheduleTimeAndAttendance, StampsFeedback, TimeDeduction, status')
      .eq('EmployeeID', EmployeeID)
      .eq('CompanyCode', companyCode)
      .or('status.is.null,status.neq.Finished')
      .order('AttendanceDate', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openRowError) {
      console.error('[inputLiveStamp] Error finding open attendance row:', openRowError.message);
      return { success: false, message: 'Error finding attendance record.' };
    }

    // ── Step 3: Fall back to today ─────────────────────────
    let attendance = openRow;
    let attendanceDate = openRow?.AttendanceDate ?? today;

    if (!openRow) {
      const { data: todayRow, error: todayError } = await supabase
        .from('Attendance')
        .select('AttendanceDate, ScheduleTimeAndAttendance, StampsFeedback, TimeDeduction, status')
        .eq('EmployeeID', EmployeeID)
        .eq('CompanyCode', companyCode)
        .eq('AttendanceDate', today)
        .maybeSingle();

      if (todayError || !todayRow) {
        console.error('[inputLiveStamp] Attendance not found:', todayError?.message);
        return { success: false, message: 'Attendance record not found.' };
      }

      attendance = todayRow;
      attendanceDate = today;
    }

    // ── Step 4: Already finished? ──────────────────────────
    if (attendance!.status === 'Finished') {
      console.log('[inputLiveStamp] Employee already finished — skipping.');
      return { success: false, message: 'You have already completed your shift for today.' };
    }

    const schedule: ShiftEntry[] = attendance!.ScheduleTimeAndAttendance;
    const feedback: FeedbackEntry[] = attendance!.StampsFeedback ?? [];
    let totalDeduction: number = attendance!.TimeDeduction ?? 0;

    if (!schedule || schedule.length === 0) {
      console.error('[inputLiveStamp] No schedule found in ScheduleTimeAndAttendance.');
      return { success: false, message: 'No schedule found.' };
    }

    let stamped = false;
    let isLastStamp = false;
    let resultMessage = '';

    // ── Step 5: Find first empty Actual field and fill it ──
    outer:
    for (let si = 0; si < schedule.length; si++) {
      const shift = schedule[si];
      const isLastShift = si === schedule.length - 1;

      // ActualTimeIn — block only if too early
      if (!shift.ActualTimeIn) {
        console.log('[inputLiveStamp] shift.ActualTimeIn value:', JSON.stringify(shift.ActualTimeIn));

        const scheduledMin = timeToMinutes(shift.timeIn);
        let currentMin = timeToMinutes(currentTime);
        if (currentMin < scheduledMin - WINDOW && scheduledMin - currentMin > 12 * 60) currentMin += 24 * 60;
        const minutesUntilShift = scheduledMin - currentMin;

        if (minutesUntilShift > WINDOW) {
          return {
            success: false,
            message: `Not yet time for Time In — scheduled at ${shift.timeIn}. Please scan within 15 minutes of your schedule.`,
          };
        }

        shift.ActualTimeIn = currentTime;
        const diff = diffMinutes(shift.timeIn, currentTime);
        if (diff > GRACE_PERIOD) {
          feedback.push({ type: 'late', scheduledTime: shift.timeIn, actualTime: currentTime, deductionMinutes: diff });
          totalDeduction += diff;
          console.log(`[inputLiveStamp] Late by ${diff} mins. Deduction: ${totalDeduction}`);
          resultMessage = `Logged in late by ${diff} minutes.`;
        } else {
          resultMessage = 'Time In recorded successfully.';
        }

        stamped = true;
        break outer;
      }

      // Breaks
      for (let bi = 0; bi < shift.breaks.length; bi++) {
        const b = shift.breaks[bi];

        if (!b.ActualBreakIn) {
          if (!isWithinWindow(b.breakIn, currentTime)) {
            return {
              success: false,
              message: `Not yet time for Break — scheduled at ${b.breakIn}. Please scan within 15 minutes of your break.`,
            };
          }
          b.ActualBreakIn = currentTime;
          resultMessage = 'Break In recorded successfully.';
          stamped = true;
          break outer;
        }

        if (b.ActualBreakIn && !b.ActualBreakOut) {
          b.ActualBreakOut = currentTime;
          const diff = diffMinutes(b.breakOut, currentTime);
          if (diff > GRACE_PERIOD) {
            feedback.push({ type: 'overbreak', scheduledTime: b.breakOut, actualTime: currentTime, deductionMinutes: diff });
            totalDeduction += diff;
            console.log(`[inputLiveStamp] Overbreak by ${diff} mins. Deduction: ${totalDeduction}`);
            resultMessage = `Returned ${diff} minutes late from break.`;
          } else {
            resultMessage = 'Break Out recorded successfully.';
          }
          stamped = true;
          break outer;
        }
      }

      // ActualTimeOut
      if (shift.ActualTimeIn && !shift.ActualTimeOut) {
        shift.ActualTimeOut = currentTime;
        const diff = diffMinutes(currentTime, shift.TimeOut);
        if (diff > GRACE_PERIOD) {
          feedback.push({ type: 'earlyout', scheduledTime: shift.TimeOut, actualTime: currentTime, deductionMinutes: diff });
          totalDeduction += diff;
          console.log(`[inputLiveStamp] Early out by ${diff} mins. Deduction: ${totalDeduction}`);
          resultMessage = `Early out by ${diff} minutes.`;
        } else {
          resultMessage = 'Time Out recorded successfully.';
        }
        stamped = true;
        isLastStamp = isLastShift;
        break outer;
      }
    }

    if (!stamped) {
      console.log('[inputLiveStamp] All stamps already filled — nothing to update.');
      return { success: false, message: 'All stamps already filled for today.' };
    }

    // ── Step 6: Compute TotalWorkingHours (pure — no DB read yet) ──
    const totalWorkingMinutes: number | null = isLastStamp ? computeTotalWorkingMinutes(schedule) : null;
    if (isLastStamp) console.log('[inputLiveStamp] Total working minutes:', totalWorkingMinutes);

    // ── Step 7: Save this stamp first ──────────────────────
    // Must happen BEFORE AttendancePayDispatcher runs below — the calculators
    // read the Attendance row fresh from the DB, and also write back their
    // own enriched StampsFeedback (with peso deductionAmount). If this write
    // ran after AttendancePayDispatcher, it would clobber that enrichment with
    // the plain (un-enriched) `feedback` array.
    const { error: updateError } = await supabase
      .from('Attendance')
      .update({
        ScheduleTimeAndAttendance: schedule,
        StampsFeedback: feedback,
        TimeDeduction: totalDeduction,
        ...(isLastStamp && { status: 'Finished' }),
        ...(totalWorkingMinutes !== null && { TotalWorkingHours: totalWorkingMinutes }),
      })
      .eq('EmployeeID', EmployeeID)
      .eq('CompanyCode', companyCode)
      .eq('AttendanceDate', attendanceDate);

    if (updateError) {
      console.error('[inputLiveStamp] Update error:', updateError.message);
      return { success: false, message: 'Failed to save stamp.' };
    }

    // ── Step 8: Trigger pay computation on the final stamp ─
    if (isLastStamp) {
      console.log('[inputLiveStamp] → Calling AttendancePayDispatcher');
      await AttendancePayDispatcher({ EmployeeID, companyCode, attendanceDate });
    }

    cooldownMap.set(key, Date.now());
    console.log('[inputLiveStamp] Stamp recorded successfully:', currentTime, 'for date:', attendanceDate);
    if (isLastStamp) console.log(`[inputLiveStamp] Employee marked as Finished. Total working minutes: ${totalWorkingMinutes}`);

    return { success: true, message: resultMessage };

  } finally {
    processingMap.delete(key);
  }
}