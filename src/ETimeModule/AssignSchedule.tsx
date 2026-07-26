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

const formatTime = (time: string) => {
  if (!time) return ''
  const [hourStr, minute] = time.split(':')
  let hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${ampm}`
}

function AssignSchedule({ Email, CompanyCode }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [breaks, setBreaks] = useState<Break[]>([])
  const [selectedScheduleID, setSelectedScheduleID] = useState('')
  const [selectedBreakIDs, setSelectedBreakIDs] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const hasFetched = useRef(false)

  // Initial fetch
  useEffect(() => {
    if (!CompanyCode) return
    if (hasFetched.current) return
    hasFetched.current = true

    const fetchData = async () => {
      setFetching(true)

      const [{ data: scheduleData }, { data: breakData }, { data: userData }] = await Promise.all([
        supabase.from('Schedules').select('id, ScheduleName, ShiftCoverage, Schedule').eq('CompanyCode', CompanyCode),
        supabase.from('Breaks').select('id, BreakName, BreakSchedule').eq('CompanyCode', CompanyCode),
        supabase.from('users').select('ScheduleID, BreakID').eq('Email', Email).single(),
      ])

      const parsedSchedules = (scheduleData ?? []).map(s => ({
        ...s,
        Schedule: typeof s.Schedule === 'string' ? JSON.parse(s.Schedule) : s.Schedule
      }))

      const parsedBreaks = (breakData ?? []).map(b => ({
        ...b,
        BreakSchedule: typeof b.BreakSchedule === 'string' ? JSON.parse(b.BreakSchedule) : b.BreakSchedule
      }))

      setSchedules(parsedSchedules)
      setBreaks(parsedBreaks)

      if (userData) {
        const rawScheduleID = userData.ScheduleID ? String(userData.ScheduleID) : ''
        const scheduleExists = parsedSchedules.some(s => String(s.id) === rawScheduleID)
        setSelectedScheduleID(scheduleExists ? rawScheduleID : '')

        if (userData.BreakID) {
          const rawBreakIDs: string[] = typeof userData.BreakID === 'string'
            ? JSON.parse(userData.BreakID)
            : userData.BreakID

          const validBreakIDs = rawBreakIDs
            .map(String)
            .filter(id => parsedBreaks.some(b => String(b.id) === id))

          setSelectedBreakIDs(validBreakIDs.length > 0 ? validBreakIDs : [''])
        }
      }

      setFetching(false)
    }

    fetchData()
  }, [CompanyCode, Email])

  // Realtime subscription on Breaks table
  useEffect(() => {
    if (!CompanyCode || !Email) return

    const channel = supabase
      .channel('breaks-realtime')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'Breaks',
          filter: `CompanyCode=eq.${CompanyCode}`,
        },
        async (payload) => {
          const deletedID = String(payload.old.id)

          setSelectedBreakIDs(prev => {
            const wasSelected = prev.includes(deletedID)
            const updated = prev.filter(id => id !== deletedID)
            const cleaned = updated.length > 0 ? updated : ['']

            if (wasSelected) {
              const filledBreaks = cleaned.filter(id => id !== '')
              supabase
                .from('users')
                .update({ BreakID: JSON.stringify(filledBreaks) })
                .eq('Email', Email)
                .then(({ error }) => {
                  if (error) console.error('Failed to sync BreakID after delete:', error)
                })
            }

            return cleaned
          })

          setBreaks(prev => prev.filter(b => String(b.id) !== deletedID))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [CompanyCode, Email])

  const handleBreakChange = (index: number, value: string) => {
    const updated = [...selectedBreakIDs]
    updated[index] = value
    setSelectedBreakIDs(updated)
  }

  const addBreakSlot = () => setSelectedBreakIDs([...selectedBreakIDs, ''])

  const removeBreakSlot = (index: number) => {
    if (selectedBreakIDs.length > 1) {
      setSelectedBreakIDs(selectedBreakIDs.filter((_, i) => i !== index))
    } else {
      setSelectedBreakIDs([''])
    }
  }

  const handleSave = async () => {
    if (!selectedScheduleID) {
      setMsg({ type: 'error', text: 'Please select a schedule.' })
      return
    }

    setLoading(true)
    setMsg(null)

    // Query Breaks table fresh to validate IDs before saving
    const { data: validBreaks } = await supabase
      .from('Breaks')
      .select('id')
      .eq('CompanyCode', CompanyCode)

    const validBreakIDSet = new Set((validBreaks ?? []).map(b => String(b.id)))

    const filledBreaks = selectedBreakIDs.filter(
      id => id !== '' && validBreakIDSet.has(id)
    )

    if (filledBreaks.length === 0) {
      setMsg({ type: 'error', text: 'Please select at least one break.' })
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('users')
      .update({
        ScheduleID: selectedScheduleID || null,
        BreakID: JSON.stringify(filledBreaks),
      })
      .eq('Email', Email)

    if (error) {
      setMsg({ type: 'error', text: 'Failed to assign schedule.' })
      console.error('Supabase update error:', error)
    } else {
      setSelectedBreakIDs(filledBreaks)
      setMsg({ type: 'success', text: 'Schedule assigned successfully.' })
    }

    setLoading(false)
  }

  const selectedSchedule = schedules.find(s => String(s.id) === String(selectedScheduleID))

  if (fetching) return <div className="text-small text-muted">Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Shift Schedule */}
      <div className="form-group">
        <label className="form-label">Shift Schedule</label>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={selectedScheduleID}
            onChange={e => setSelectedScheduleID(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Select a schedule</option>
            {schedules.map(s => (
              <option key={s.id} value={String(s.id)}>
                {s.ScheduleName} — {s.ShiftCoverage}
              </option>
            ))}
          </select>

          {selectedScheduleID && (
            <button
              className="btn btn-delete-outline btn-sm"
              onClick={() => setSelectedScheduleID('')}
            >
              Remove
            </button>
          )}
        </div>

        {selectedSchedule && (
          <div style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--brand-orange-light)',
            border: '1.5px solid var(--brand-orange-muted)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)'
          }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--brand-orange-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Schedule Preview
            </span>
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
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="form-select"
                    value={breakID}
                    onChange={e => handleBreakChange(index, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select a break</option>
                    {breaks.map(b => (
                      <option key={b.id} value={String(b.id)}>{b.BreakName}</option>
                    ))}
                  </select>

                  <button
                    className="btn btn-delete-outline btn-sm"
                    onClick={() => removeBreakSlot(index)}
                  >
                    Remove
                  </button>
                </div>

                {selectedBreak && (
                  <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--brand-blue-light)',
                    border: '1.5px solid var(--brand-blue-muted)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-1)'
                  }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--brand-blue-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Break Preview
                    </span>
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

        <button
          className="btn btn-outline-blue btn-sm"
          onClick={addBreakSlot}
          style={{ marginTop: 'var(--space-2)', width: 'fit-content' }}
        >
          + Add Another Break
        </button>
      </div>

      {msg && (
        <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {msg.text}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Assign Schedule'}
      </button>
    </div>
  )
}

export default AssignSchedule