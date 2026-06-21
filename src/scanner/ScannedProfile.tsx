/**
 * ScannedProfile.tsx
 * Modal shown for 4 seconds after a successful QR scan.
 * Receives the scanned value, company code, and stamp result as props.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import type { StampResult } from './inputLiveStamp';

interface ScannedProfileProps {
  scannedValue: string;
  companyCode: string;
  stampResult: StampResult | null;
}

interface AttendanceData {
  StampsFeedback: {
    type: 'late' | 'overbreak' | 'earlyout';
    scheduledTime: string;
    actualTime: string;
    deductionMinutes: number;
  }[];
  TimeDeduction: number;
  status: string;
}

function ScannedProfile({ scannedValue, companyCode, stampResult }: ScannedProfileProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // ── Fetch employee name ─────────────────────────────
      const { data: user } = await supabase
        .from('users')
        .select('FirstName, LastName')
        .eq('EmployeeID', scannedValue)
        .eq('CompanyCode', companyCode)
        .single();

      if (user) {
        setFirstName(user.FirstName);
        setLastName(user.LastName);
      }

      // ── Fetch today's attendance ────────────────────────
      const { data: serverTime } = await supabase.rpc('get_server_time');
      const today = new Date(serverTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

      const { data: att } = await supabase
        .from('Attendance')
        .select('StampsFeedback, TimeDeduction, status')
        .eq('EmployeeID', scannedValue)
        .eq('CompanyCode', companyCode)
        .eq('AttendanceDate', today)
        .maybeSingle();

      if (att) setAttendance(att);

      setLoading(false);
    }

    fetchData();
  }, [scannedValue, companyCode]);

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';

  const feedbackColor = (type: string) => {
    if (type === 'late') return { bg: '#fef3c7', text: '#d97706' };
    if (type === 'overbreak') return { bg: '#fee2e2', text: '#dc2626' };
    if (type === 'earlyout') return { bg: '#fce7f3', text: '#db2777' };
    return { bg: '#f3f4f6', text: '#6b7280' };
  };

  const feedbackLabel = (type: string) => {
    if (type === 'late') return 'Late';
    if (type === 'overbreak') return 'Overbreak';
    if (type === 'earlyout') return 'Early Out';
    return type;
  };

  const isRejected = stampResult && !stampResult.success;
  const isProcessing = stampResult === null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: '8px 0',
    }}>
      {/* Avatar */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: isRejected
          ? 'linear-gradient(135deg, #f87171, #ef4444)'
          : 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 28,
        fontWeight: 700,
      }}>
        {loading ? '?' : isRejected ? '!' : initials}
      </div>

      {/* Employee name */}
      <div style={{ textAlign: 'center' }}>
        {loading ? (
          <p style={{ fontSize: 16, color: '#9ca3af', margin: 0 }}>Loading...</p>
        ) : (
          <>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
              {firstName} {lastName}
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, fontFamily: 'monospace' }}>
              {scannedValue}
            </p>
          </>
        )}
      </div>

      {/* Stamp result message */}
      {isProcessing ? (
        <div style={{
          width: '100%',
          background: '#f9fafb',
          border: '1.5px solid #e5e7eb',
          borderRadius: 10,
          padding: '10px 14px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', margin: 0 }}>
            Processing scan...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{
          width: '100%',
          background: stampResult!.success ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${stampResult!.success ? '#86efac' : '#fca5a5'}`,
          borderRadius: 10,
          padding: '10px 14px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 13,
            fontWeight: 700,
            color: stampResult!.success ? '#16a34a' : '#dc2626',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {stampResult!.success ? '✓ ' : '✕ '}{stampResult!.message}
          </p>
        </div>
      )}

      {/* Status + Company badge — only show if not rejected */}
      {!isRejected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            color: '#0284c7',
            background: '#e0f4fd',
            padding: '4px 12px',
            borderRadius: 99,
            letterSpacing: '0.04em',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {companyCode}
          </div>

          {attendance?.status && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: attendance.status === 'Finished' ? '#16a34a' : '#d97706',
              background: attendance.status === 'Finished' ? '#dcfce7' : '#fef3c7',
              padding: '4px 12px',
              borderRadius: 99,
            }}>
              {attendance.status === 'Finished' ? '✓ Finished' : '● Active'}
            </div>
          )}
        </div>
      )}

      {/* Feedback — only show if not rejected */}
      {!isRejected && attendance?.StampsFeedback && attendance.StampsFeedback.length > 0 && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Feedback
          </p>
          {attendance.StampsFeedback.map((f, i) => {
            const { bg, text } = feedbackColor(f.type);
            return (
              <div key={i} style={{
                background: bg,
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: text, margin: '0 0 2px' }}>
                    {feedbackLabel(f.type)}
                  </p>
                  <p style={{ fontSize: 11, color: text, margin: 0, opacity: 0.8 }}>
                    Scheduled: {f.scheduledTime} · Actual: {f.actualTime}
                  </p>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: text, margin: 0 }}>
                  -{f.deductionMinutes} min
                </p>
              </div>
            );
          })}

          {attendance.TimeDeduction > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e5e7eb',
              paddingTop: 8,
              marginTop: 2,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: 0 }}>Total Deduction</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: 0 }}>-{attendance.TimeDeduction} min</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScannedProfile;