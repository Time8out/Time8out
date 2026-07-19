import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../utils/supabase'

interface Props {
  Email: string
  CompanyCode: string | null
}

interface TimeSlot {
  timeIn: string
  timeOut: string
}

interface BreakSlot {
  breakIn: string
  breakOut: string
}

interface Schedule {
  id: number
  ScheduleName: string
  ShiftCoverage: string
  Schedule: TimeSlot[]
}

interface Break {
  id: number
  BreakName: string
  BreakSchedule: BreakSlot[]
}

interface OverrideRow {
  id: number
  EmployeeID: string
  CompanyCode: string
  ShiftCoverage: string
  Schedules: TimeSlot[]
  Breaks: BreakSlot[]
  DateCoverage: string
}

const formatTime = (time: string) => {
  if (!time) return ''
  const [hourStr, minute] = time.split(':')
  let hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${ampm}`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function AssignTemporarySchedule({ Email, CompanyCode }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [breaks, setBreaks] = useState<Break[]>([])
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [employeeID, setEmployeeID] = useState<string>('')

  // Form state
  const [selectedScheduleID, setSelectedScheduleID] = useState('')
  const [selectedBreakIDs, setSelectedBreakIDs] = useState<string[]>([''])
  const [dateCoverage, setDateCoverage] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const hasFetched = useRef(false)

  useEffect(() => {
    if (!CompanyCode || !Email) return
    if (hasFetched.current) return
    hasFetched.current = true
    fetchAll()
  }, [CompanyCode, Email])

  async function fetchAll() {
    setFetching(true)
    const [{ data: scheduleData }, { data: breakData }, { data: userData }, { data: overrideData }] = await Promise.all([
      supabase.from('Schedules').select('id, ScheduleName, ShiftCoverage, Schedule').eq('CompanyCode', CompanyCode),
      supabase.from('Breaks').select('id, BreakName, BreakSchedule').eq('CompanyCode', CompanyCode),
      supabase.from('users').select('EmployeeID').eq('Email', Email).single(),
      supabase.from('OverrideSchedules').select('*').eq('CompanyCode', CompanyCode).order('DateCoverage', { ascending: true }),
    ])

    const parsedSchedules = (scheduleData ?? []).map(s => ({
      ...s,
      Schedule: typeof s.Schedule === 'string' ? JSON.parse(s.Schedule) : s.Schedule,
    }))
    const parsedBreaks = (breakData ?? []).map(b => ({
      ...b,
      BreakSchedule: typeof b.BreakSchedule === 'string' ? JSON.parse(b.BreakSchedule) : b.BreakSchedule,
    }))
    const empID = userData?.EmployeeID ?? ''

    const parsedOverrides = ((overrideData ?? []) as any[])
      .filter(o => o.EmployeeID === empID)
      .map(o => ({
        ...o,
        Schedules: typeof o.Schedules === 'string' ? JSON.parse(o.Schedules) : (o.Schedules ?? []),
        Breaks: typeof o.Breaks === 'string' ? JSON.parse(o.Breaks) : (o.Breaks ?? []),
      }))

    setSchedules(parsedSchedules)
    setBreaks(parsedBreaks)
    setEmployeeID(empID)
    setOverrides(parsedOverrides)
    setFetching(false)
  }

  const handleBreakChange = (index: number, value: string) => {
    const updated = [...selectedBreakIDs]
    updated[index] = value
    setSelectedBreakIDs(updated)
  }
  const addBreakSlot = () => setSelectedBreakIDs([...selectedBreakIDs, ''])
  const removeBreakSlot = (index: number) => {
    if (selectedBreakIDs.length > 1) setSelectedBreakIDs(selectedBreakIDs.filter((_, i) => i !== index))
    else setSelectedBreakIDs([''])
  }

  const selectedSchedule = schedules.find(s => String(s.id) === String(selectedScheduleID))

  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [conflictConfirmed, setConflictConfirmed] = useState(false);

  async function checkOTConflict(date: string): Promise<string | null> {
    const { data: otRow } = await supabase
      .from('Overtime')
      .select('OTHours, ShiftCoverage, ScheduleType')
      .eq('EmployeeID', employeeID)
      .eq('CompanyCode', CompanyCode)
      .eq('Date', date)
      .maybeSingle();
    if (otRow) {
      return `This employee already has an OT request (${otRow.ScheduleType} · ${otRow.ShiftCoverage}) on this date. The override and OT may conflict.`;
    }
    return null;
  }

  async function handleSave() {
    if (!selectedScheduleID) { setMsg({ type: 'error', text: 'Please select a schedule.' }); return }
    if (!dateCoverage) { setMsg({ type: 'error', text: 'Please select a date.' }); return }
    if (!employeeID) { setMsg({ type: 'error', text: 'Employee ID not found.' }); return }

    // Check OT conflict — warn but allow
    if (!conflictConfirmed) {
      const warning = await checkOTConflict(dateCoverage);
      if (warning) {
        setConflictWarning(warning);
        return; // pause — wait for user to confirm
      }
    }

    const filledBreaks = selectedBreakIDs.filter(id => id !== '')
    const selectedBreakObjects = filledBreaks
      .map(id => breaks.find(b => String(b.id) === id))
      .filter(Boolean)
      .flatMap(b => b!.BreakSchedule)

    const scheduleSlots = selectedSchedule?.Schedule ?? []

    setLoading(true); setMsg(null); setConflictWarning(null); setConflictConfirmed(false);

    const { error } = await supabase.from('OverrideSchedules').insert([{
      EmployeeID: employeeID,
      CompanyCode: CompanyCode,
      ShiftCoverage: selectedSchedule?.ShiftCoverage ?? '',
      Schedules: JSON.stringify(scheduleSlots),
      Breaks: JSON.stringify(selectedBreakObjects),
      DateCoverage: dateCoverage,
    }])

    if (error) {
      setMsg({ type: 'error', text: 'Failed to save override schedule.' })
    } else {
      setMsg({ type: 'success', text: 'Temporary schedule assigned!' })
      setSelectedScheduleID('')
      setSelectedBreakIDs([''])
      setDateCoverage('')
      await fetchAll()
      setTimeout(() => setMsg(null), 2000)
    }
    setLoading(false)
  }

  async function handleDelete(id: number) {
    setDeleteLoading(true)
    await supabase.from('OverrideSchedules').delete().eq('id', id)
    setOverrides(prev => prev.filter(o => o.id !== id))
    setConfirmDeleteId(null)
    setDeleteLoading(false)
  }

  if (fetching) return <div className="text-small text-muted">Loading...</div>

  return (
    <>
      <style>{`
        .ats-section-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:var(--space-3)}
        .ats-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic;margin-bottom:var(--space-5)}
        .ats-override-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-2);display:flex;align-items:flex-start;gap:var(--space-3)}
        .ats-override-card:last-child{margin-bottom:0}
        .ats-override-icon{width:32px;height:32px;border-radius:var(--radius-md);background:var(--brand-orange-light);border:1px solid var(--brand-orange-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
        .ats-override-info{flex:1;min-width:0}
        .ats-override-date{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:2px}
        .ats-override-shift{font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:monospace}
        .ats-override-breaks{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
        .ats-break-pill{font-size:10px;background:var(--brand-blue-light);border:1px solid var(--brand-blue-muted);color:var(--brand-blue-dark);border-radius:99px;padding:2px 8px;font-weight:600}
        .ats-override-actions{flex-shrink:0;display:flex;align-items:center;gap:6px}
        .ats-delete-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap}
        .ats-delete-btn:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}
        .ats-confirm-row{display:flex;align-items:center;gap:6px}
        .ats-confirm-text{font-size:11px;color:#dc2626;font-weight:600}
        .ats-confirm-yes{padding:4px 10px;border-radius:var(--radius-md);border:none;background:#dc2626;font-size:11px;font-weight:700;color:white;cursor:pointer;font-family:var(--font-base)}
        .ats-confirm-yes:disabled{opacity:.5}
        .ats-confirm-no{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base)}
        .ats-divider{height:1px;background:var(--color-border);margin:var(--space-5) 0}
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* ── Existing Overrides ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span className="ats-section-label" style={{ marginBottom: 0 }}>Assigned Temporary Schedules</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: 99, padding: '1px 8px', color: 'var(--color-text-muted)' }}>
              {overrides.length}
            </span>
          </div>

          {overrides.length === 0 ? (
            <div className="ats-empty">No temporary schedules assigned yet.</div>
          ) : (
            overrides.map(o => (
              <div key={o.id} className="ats-override-card">
                <div className="ats-override-icon">📅</div>
                <div className="ats-override-info">
                  <div className="ats-override-date">{fmtDate(o.DateCoverage)}</div>
                  <div className="ats-override-shift">
                    {(o.Schedules ?? []).map((s: TimeSlot, i: number) => (
                      <span key={i}>{formatTime(s.timeIn)} – {formatTime(s.timeOut)}{i < o.Schedules.length - 1 ? ', ' : ''}</span>
                    ))}
                  </div>
                  {(o.Breaks ?? []).length > 0 && (
                    <div className="ats-override-breaks">
                      {(o.Breaks as BreakSlot[]).map((b, i) => (
                        <span key={i} className="ats-break-pill">{formatTime(b.breakIn)} – {formatTime(b.breakOut)}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ats-override-actions">
                  {confirmDeleteId === o.id ? (
                    <div className="ats-confirm-row">
                      <span className="ats-confirm-text">Remove?</span>
                      <button className="ats-confirm-yes" disabled={deleteLoading}
                        onClick={() => handleDelete(o.id)}>{deleteLoading ? '…' : 'Yes'}</button>
                      <button className="ats-confirm-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </div>
                  ) : (
                    <button className="ats-delete-btn" onClick={() => setConfirmDeleteId(o.id)}>Remove</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="ats-divider" />

        <div className="ats-section-label">Add Temporary Schedule</div>

        {/* Date */}
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            className="form-input"
            type="date"
            value={dateCoverage}
            onChange={e => setDateCoverage(e.target.value)}
          />
        </div>

        {/* Shift Schedule */}
        <div className="form-group">
          <label className="form-label">Shift Schedule</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <select className="form-select" value={selectedScheduleID}
              onChange={e => setSelectedScheduleID(e.target.value)} style={{ flex: 1 }}>
              <option value="">Select a schedule</option>
              {schedules.map(s => (
                <option key={s.id} value={String(s.id)}>{s.ScheduleName} — {s.ShiftCoverage}</option>
              ))}
            </select>
            {selectedScheduleID && (
              <button className="btn btn-delete-outline btn-sm" onClick={() => setSelectedScheduleID('')}>Remove</button>
            )}
          </div>

          {selectedSchedule && (
            <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', background: 'var(--brand-orange-light)', border: '1.5px solid var(--brand-orange-muted)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--brand-orange-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Schedule Preview</span>
              {selectedSchedule.Schedule.map((slot, i) => (
                <span key={i} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Time In: <strong>{formatTime(slot.timeIn)}</strong> – Time Out: <strong>{formatTime(slot.timeOut)}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Break Schedules */}
        <div className="form-group">
          <label className="form-label">Break Schedule</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {selectedBreakIDs.map((breakID, index) => {
              const selectedBreak = breaks.find(b => String(b.id) === String(breakID))
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <select className="form-select" value={breakID}
                      onChange={e => handleBreakChange(index, e.target.value)} style={{ flex: 1 }}>
                      <option value="">Select a break</option>
                      {breaks.map(b => (
                        <option key={b.id} value={String(b.id)}>{b.BreakName}</option>
                      ))}
                    </select>
                    <button className="btn btn-delete-outline btn-sm" onClick={() => removeBreakSlot(index)}>Remove</button>
                  </div>

                  {selectedBreak && (
                    <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--brand-blue-light)', border: '1.5px solid var(--brand-blue-muted)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--brand-blue-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Break Preview</span>
                      {selectedBreak.BreakSchedule.map((slot, i) => (
                        <span key={i} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          Break In: <strong>{formatTime(slot.breakIn)}</strong> – Break Out: <strong>{formatTime(slot.breakOut)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button className="btn btn-outline-blue btn-sm" onClick={addBreakSlot}
            style={{ marginTop: 'var(--space-2)', width: 'fit-content' }}>
            + Add Another Break
          </button>
        </div>

        {conflictWarning && (
          <div style={{ background: "#fef3c7", border: "1.5px solid rgba(234,179,8,0.4)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚠ OT Conflict Detected</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "#92400e", marginBottom: "var(--space-3)", lineHeight: 1.6 }}>{conflictWarning}</div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setConflictConfirmed(true); handleSave(); }}>Proceed Anyway</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setConflictWarning(null); }}>Cancel</button>
            </div>
          </div>
        )}

        {msg && (
          <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {msg.text}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Assign Temporary Schedule'}
        </button>

      </div>
    </>
  )
}

export default AssignTemporarySchedule