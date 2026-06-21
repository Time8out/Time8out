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

interface ScheduleDetails {
  ScheduleName: string
  ShiftCoverage: string
  Schedule: TimeSlot[]
}

interface BreakDetails {
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

function ViewSchedule({ Email }: Props) {
  const [schedule, setSchedule] = useState<ScheduleDetails | null>(null)
  const [breakDetails, setBreakDetails] = useState<BreakDetails[]>([])
  const [loading, setLoading] = useState(true)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchSchedule()
  }, [Email])

  const fetchSchedule = async () => {
    setLoading(true)

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('ScheduleID, BreakID')
      .eq('Email', Email)
      .single()

    if (userError || !userData) {
      console.error('Error fetching user:', userError)
      setLoading(false)
      return
    }

    if (userData.ScheduleID) {
      const { data: scheduleData } = await supabase
        .from('Schedules')
        .select('ScheduleName, ShiftCoverage, Schedule')
        .eq('id', userData.ScheduleID)
        .single()

      if (scheduleData) {
        setSchedule({
          ...scheduleData,
          Schedule: typeof scheduleData.Schedule === 'string'
            ? JSON.parse(scheduleData.Schedule)
            : scheduleData.Schedule
        })
      }
    }

    if (userData.BreakID) {
      const ids: string[] = typeof userData.BreakID === 'string'
        ? JSON.parse(userData.BreakID)
        : userData.BreakID

      if (ids.length > 0) {
        const { data: breaksData } = await supabase
          .from('Breaks')
          .select('BreakName, BreakSchedule')
          .in('id', ids)

        if (breaksData) {
          setBreakDetails(breaksData.map(b => ({
            ...b,
            BreakSchedule: typeof b.BreakSchedule === 'string'
              ? JSON.parse(b.BreakSchedule)
              : b.BreakSchedule
          })))
        }
      }
    }

    setLoading(false)
  }

  if (loading) return <div className="text-small text-muted">Loading schedule...</div>

  if (!schedule && breakDetails.length === 0) return (
    <div className="alert alert-warning">No schedule assigned to this employee yet.</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Shift Schedule */}
      {schedule && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="text-subheading">{schedule.ScheduleName}</span>
            <span className="badge badge-orange">{schedule.ShiftCoverage}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-alt)' }}>
                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Time In</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Time Out</th>
              </tr>
            </thead>
            <tbody>
              {schedule.Schedule.map((slot, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>{formatTime(slot.timeIn)}</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>{formatTime(slot.timeOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <hr className="divider" style={{ margin: 0 }} />

      {/* Break Schedules */}
      {breakDetails.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {breakDetails.map((b, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="text-subheading">{b.BreakName}</span>
                <span className="badge badge-blue">Break</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-alt)' }}>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Break In</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Break Out</th>
                  </tr>
                </thead>
                <tbody>
                  {b.BreakSchedule.map((slot, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>{formatTime(slot.breakIn)}</td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-secondary)' }}>{formatTime(slot.breakOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {index < breakDetails.length - 1 && <hr className="divider" style={{ margin: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ViewSchedule