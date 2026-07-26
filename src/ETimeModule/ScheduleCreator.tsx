import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../utils/supabase'

interface Props {
  CompanyCode: string | null
}

interface TimeSlot {
  timeIn: string
  timeOut: string
}

interface Schedule {
  id: string
  ScheduleName: string
  ShiftCoverage: string
  Schedule: TimeSlot[]
  CompanyCode: string
}

const formatTime = (time: string) => {
  if (!time) return ''
  const [hourStr, minute] = time.split(':')
  let hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${ampm}`
}

function ScheduleCreator({ CompanyCode }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null)
  const [scheduleName, setScheduleName] = useState('')
  const [shiftCoverage, setShiftCoverage] = useState('Day Shift')
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([{ timeIn: '', timeOut: '' }])
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!CompanyCode) return
    if (hasFetched.current) return
    hasFetched.current = true
    fetchSchedules()
  }, [CompanyCode])

  const fetchSchedules = async () => {
    const { data, error } = await supabase
      .from('Schedules')
      .select('*')
      .eq('CompanyCode', CompanyCode)
    if (!error && data) setSchedules(data)
  }

  const handleShiftCoverageChange = (value: string) => {
    setShiftCoverage(value)
    if (value !== 'Broken Schedule') {
      setTimeSlots([{ timeIn: '', timeOut: '' }])
    }
  }

  const handleTimeSlotChange = (index: number, field: 'timeIn' | 'timeOut', value: string) => {
    const updated = [...timeSlots]
    updated[index][field] = value
    setTimeSlots(updated)
  }

  const addTimeSlot = () => setTimeSlots([...timeSlots, { timeIn: '', timeOut: '' }])

  const removeTimeSlot = (index: number) => setTimeSlots(timeSlots.filter((_, i) => i !== index))

  const resetForm = () => {
    setScheduleName('')
    setShiftCoverage('Day Shift')
    setTimeSlots([{ timeIn: '', timeOut: '' }])
    setMsg(null)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSave = async () => {
    if (!scheduleName.trim()) {
      setMsg({ type: 'error', text: 'Schedule name is required.' })
      return
    }
    if (timeSlots.some(s => !s.timeIn || !s.timeOut)) {
      setMsg({ type: 'error', text: 'Please fill in all time slots.' })
      return
    }

    setLoading(true)
    setMsg(null)

    const { error } = await supabase.from('Schedules').insert({
      ScheduleName: scheduleName,
      ShiftCoverage: shiftCoverage,
      Schedule: timeSlots,
      CompanyCode,
    })

    if (error) {
      setMsg({ type: 'error', text: 'Failed to save schedule.' })
      console.error('Supabase insert error:', error)
      setLoading(false)
      return
    }

    setMsg({ type: 'success', text: 'Schedule saved!' })
    hasFetched.current = false
    fetchSchedules()
    hasFetched.current = true
    setLoading(false)
    setTimeout(() => closeModal(), 1000)
  }

  const confirmDelete = (schedule: Schedule, e: React.MouseEvent) => {
    e.stopPropagation()
    setScheduleToDelete(schedule)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!scheduleToDelete) return
    setDeleteLoading(true)

    const deletedId = String(scheduleToDelete.id)

    const { error: deleteErr } = await supabase
      .from('Schedules')
      .delete()
      .eq('id', scheduleToDelete.id)

    if (deleteErr) {
      console.error('Delete error:', deleteErr)
      setDeleteLoading(false)
      setShowDeleteModal(false)
      setScheduleToDelete(null)
      return
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ ScheduleID: null })
      .eq('CompanyCode', CompanyCode)
      .eq('ScheduleID', deletedId)

    if (updateErr) {
      console.error('Error clearing ScheduleID from users:', updateErr)
    }

    setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete.id))
    setDeleteLoading(false)
    setShowDeleteModal(false)
    setScheduleToDelete(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: '10px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h2 className="text-secondary-title">Schedules</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          + New Schedule
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: '290px', overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-alt)' }}>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Schedule Name</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Shift Coverage</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Time In</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Time Out</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No schedules found. Click <strong>+ New Schedule</strong> to get started.
                </td>
              </tr>
            ) : (
              schedules.map(schedule => {
                const slots: TimeSlot[] = typeof schedule.Schedule === 'string'
                  ? JSON.parse(schedule.Schedule)
                  : schedule.Schedule
                return slots.map((slot, i) => (
                  <tr key={`${schedule.id}-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {i === 0 && (
                      <>
                        <td rowSpan={slots.length} style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text)', verticalAlign: 'top' }}>
                          {schedule.ScheduleName}
                        </td>
                        <td rowSpan={slots.length} style={{ padding: 'var(--space-3) var(--space-4)', verticalAlign: 'top' }}>
                          <span className={`badge ${
                            schedule.ShiftCoverage === 'Day Shift' ? 'badge-orange' :
                            schedule.ShiftCoverage === 'Night Shift' ? 'badge-blue' :
                            'badge-neutral'
                          }`}>
                            {schedule.ShiftCoverage}
                          </span>
                        </td>
                      </>
                    )}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {formatTime(slot.timeIn)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {formatTime(slot.timeOut)}
                    </td>
                    {i === 0 && (
                      <td rowSpan={slots.length} style={{ padding: 'var(--space-3) var(--space-4)', verticalAlign: 'top' }}>
                        <button
                          className="btn btn-delete-outline btn-sm"
                          onClick={(e) => confirmDelete(schedule, e)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)'
          }}
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="text-subheading">New Schedule</h3>
              <button className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <div className="form-group">
              <label className="form-label">Schedule Name</label>
              <input
                className="form-input"
                type="text"
                value={scheduleName}
                onChange={e => setScheduleName(e.target.value)}
                placeholder="e.g. Morning A"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shift Coverage</label>
              <select
                className="form-select"
                value={shiftCoverage}
                onChange={e => handleShiftCoverageChange(e.target.value)}
              >
                <option>Day Shift</option>
                <option>Night Shift</option>
                <option>Custom</option>
                <option>Broken Schedule</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Schedule</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {timeSlots.map((slot, index) => (
                  <div key={index} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '1 1 120px' }}>
                      <label className="form-label">Time In</label>
                      <input
                        className="form-input"
                        type="time"
                        value={slot.timeIn}
                        onChange={e => handleTimeSlotChange(index, 'timeIn', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: '1 1 120px' }}>
                      <label className="form-label">Time Out</label>
                      <input
                        className="form-input"
                        type="time"
                        value={slot.timeOut}
                        onChange={e => handleTimeSlotChange(index, 'timeOut', e.target.value)}
                      />
                    </div>
                    {shiftCoverage === 'Broken Schedule' && timeSlots.length > 1 && (
                      <button
                        className="btn btn-delete-outline btn-sm"
                        onClick={() => removeTimeSlot(index)}
                        style={{ marginBottom: '2px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {shiftCoverage === 'Broken Schedule' && (
                  <button className="btn btn-outline-blue btn-sm" onClick={addTimeSlot} style={{ width: 'fit-content' }}>
                    + Add Time Slot
                  </button>
                )}
              </div>
            </div>

            {msg && (
              <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                {msg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && scheduleToDelete && (
        <div
          onClick={() => { setShowDeleteModal(false); setScheduleToDelete(null) }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)'
          }}
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="text-subheading">Delete Schedule</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowDeleteModal(false); setScheduleToDelete(null) }}>✕</button>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <p className="text-body">
              Are you sure you want to delete <strong>{scheduleToDelete.ScheduleName}</strong>? Any employees assigned to this schedule will have their schedule cleared.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowDeleteModal(false); setScheduleToDelete(null) }}>Cancel</button>
              <button className="btn btn-delete" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScheduleCreator