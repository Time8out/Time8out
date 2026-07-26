import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../utils/supabase'

interface Props {
  CompanyCode: string | null
}

interface TimeSlot {
  breakIn: string
  breakOut: string
}

interface Break {
  id: string
  BreakName: string
  BreakSchedule: TimeSlot[]
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

function BreaksCreator({ CompanyCode }: Props) {
  const [breaks, setBreaks] = useState<Break[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [breakToDelete, setBreakToDelete] = useState<Break | null>(null)
  const [breakName, setBreakName] = useState('')
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([{ breakIn: '', breakOut: '' }])
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!CompanyCode) return
    if (hasFetched.current) return
    hasFetched.current = true
    fetchBreaks()
  }, [CompanyCode])

  const fetchBreaks = async () => {
    const { data, error } = await supabase
      .from('Breaks')
      .select('*')
      .eq('CompanyCode', CompanyCode)
    if (!error && data) setBreaks(data)
  }

  const handleTimeSlotChange = (index: number, field: 'breakIn' | 'breakOut', value: string) => {
    const updated = [...timeSlots]
    updated[index][field] = value
    setTimeSlots(updated)
  }

  const resetForm = () => {
    setBreakName('')
    setTimeSlots([{ breakIn: '', breakOut: '' }])
    setMsg(null)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSave = async () => {
    if (!breakName.trim()) {
      setMsg({ type: 'error', text: 'Break name is required.' })
      return
    }
    if (timeSlots.some(s => !s.breakIn || !s.breakOut)) {
      setMsg({ type: 'error', text: 'Please fill in all time slots.' })
      return
    }

    setLoading(true)
    setMsg(null)

    const { error } = await supabase.from('Breaks').insert({
      BreakName: breakName,
      BreakSchedule: timeSlots,
      CompanyCode,
    })

    if (error) {
      setMsg({ type: 'error', text: 'Failed to save break.' })
      console.error('Supabase insert error:', error)
      setLoading(false)
      return
    }

    setMsg({ type: 'success', text: 'Break saved!' })
    hasFetched.current = false
    fetchBreaks()
    hasFetched.current = true
    setLoading(false)
    setTimeout(() => closeModal(), 1000)
  }

  const confirmDelete = (b: Break, e: React.MouseEvent) => {
    e.stopPropagation()
    setBreakToDelete(b)
    setShowDeleteModal(true)
  }

  /* ══════════════════════════════════════════════
     DELETE — removes the break, then scrubs its ID
     from every user's BreakID array in the same
     CompanyCode.
  ══════════════════════════════════════════════ */
  const handleDelete = async () => {
    if (!breakToDelete) return
    setDeleteLoading(true)

    const deletedId = String(breakToDelete.id)

    // 1. Delete the break record itself
    const { error: deleteErr } = await supabase
      .from('Breaks')
      .delete()
      .eq('id', breakToDelete.id)

    if (deleteErr) {
      console.error('Delete error:', deleteErr)
      setDeleteLoading(false)
      setShowDeleteModal(false)
      setBreakToDelete(null)
      return
    }

    // 2. Fetch all users in this company that have a BreakID array
    const { data: users, error: fetchErr } = await supabase
      .from('users')
      .select('id, BreakID')
      .eq('CompanyCode', CompanyCode)
      .not('BreakID', 'is', null)

    if (fetchErr) {
      console.error('Error fetching users for cleanup:', fetchErr)
    } else if (users && users.length > 0) {
      // 3. For each user, parse their BreakID array, remove the deleted ID, write back
      const updates = users
        .map((user: { id: string; BreakID: string | string[] | null }) => {
          // BreakID may be stored as a JSON string or already parsed array
          let ids: string[] = []
          if (Array.isArray(user.BreakID)) {
            ids = user.BreakID.map(String)
          } else if (typeof user.BreakID === 'string') {
            try {
              const parsed = JSON.parse(user.BreakID)
              ids = Array.isArray(parsed) ? parsed.map(String) : []
            } catch {
              ids = []
            }
          }

          // Only update if the deleted ID was actually in their array
          if (!ids.includes(deletedId)) return null

          const updated = ids.filter(id => id !== deletedId)
          // If array is now empty, store null instead of "[]"
          return { id: user.id, BreakID: updated.length > 0 ? JSON.stringify(updated) : null }
        })
        .filter(Boolean) as { id: string; BreakID: string | null }[]

      // 4. Fire all updates (one per affected user)
      await Promise.all(
        updates.map(u =>
          supabase.from('users').update({ BreakID: u.BreakID }).eq('id', u.id)
        )
      )
    }

    // 5. Update local state
    setBreaks(prev => prev.filter(b => b.id !== breakToDelete.id))
    setDeleteLoading(false)
    setShowDeleteModal(false)
    setBreakToDelete(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: '10px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h2 className="text-secondary-title">Breaks</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          + New Break
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: '290px', overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-alt)' }}>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Break Name</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Break In</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Break Out</th>
              <th style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {breaks.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No breaks found. Click <strong>+ New Break</strong> to get started.
                </td>
              </tr>
            ) : (
              breaks.map(b => {
                const slots: TimeSlot[] = typeof b.BreakSchedule === 'string'
                  ? JSON.parse(b.BreakSchedule)
                  : b.BreakSchedule
                return slots.map((slot, i) => (
                  <tr key={`${b.id}-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {i === 0 && (
                      <td rowSpan={slots.length} style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text)', verticalAlign: 'top' }}>
                        {b.BreakName}
                      </td>
                    )}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {formatTime(slot.breakIn)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {formatTime(slot.breakOut)}
                    </td>
                    {i === 0 && (
                      <td rowSpan={slots.length} style={{ padding: 'var(--space-3) var(--space-4)', verticalAlign: 'top' }}>
                        <button
                          className="btn btn-delete-outline btn-sm"
                          onClick={(e) => confirmDelete(b, e)}
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
              <h3 className="text-subheading">New Break</h3>
              <button className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <div className="form-group">
              <label className="form-label">Break Name</label>
              <input
                className="form-input"
                type="text"
                value={breakName}
                onChange={e => setBreakName(e.target.value)}
                placeholder="e.g. Lunch Break"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Schedule</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 120px' }}>
                  <label className="form-label">Break In</label>
                  <input
                    className="form-input"
                    type="time"
                    value={timeSlots[0].breakIn}
                    onChange={e => handleTimeSlotChange(0, 'breakIn', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 120px' }}>
                  <label className="form-label">Break Out</label>
                  <input
                    className="form-input"
                    type="time"
                    value={timeSlots[0].breakOut}
                    onChange={e => handleTimeSlotChange(0, 'breakOut', e.target.value)}
                  />
                </div>
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
                {loading ? 'Saving...' : 'Save Break'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && breakToDelete && (
        <div
          onClick={() => { setShowDeleteModal(false); setBreakToDelete(null) }}
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
              <h3 className="text-subheading">Delete Break</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowDeleteModal(false); setBreakToDelete(null) }}>✕</button>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <p className="text-body">
              Are you sure you want to delete <strong>{breakToDelete.BreakName}</strong>? This will also remove it from any employees it has been assigned to.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowDeleteModal(false); setBreakToDelete(null) }}>Cancel</button>
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

export default BreaksCreator