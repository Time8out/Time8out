import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../utils/supabase'
import AssignSchedule from './AssignSchedule'
import ViewSchedule from './ViewSchedule'
import AssignTemporarySchedule from './AssignTemporarySchedule'

interface Props {
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

interface ScheduleInfo {
  id: string
  ScheduleName: string
  Schedule: TimeSlot[]
}

interface BreakInfo {
  id: string
  BreakName: string
  BreakSchedule: BreakSlot[]
}

interface Employee {
  id: string
  FirstName: string
  LastName: string
  Email: string
  ScheduleID: string | null
  BreakID: string | null
  scheduleInfo?: ScheduleInfo | null
  breaksInfo?: BreakInfo[]
}

type ModalAction = 'assign-schedule' | 'view-schedule' | 'assign-temporary'

const formatTime = (time: string) => {
  if (!time) return ''
  const [hourStr, minute] = time.split(':')
  let hour = parseInt(hourStr)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${ampm}`
}

function AssignScheduleTable({ CompanyCode }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [activeAction, setActiveAction] = useState<ModalAction | null>(null)
  const hasFetched = useRef(false)
  const employeesRef = useRef<Employee[]>([])

  const updateEmployees = (data: Employee[]) => {
    employeesRef.current = data
    setEmployees(data)
  }

  const fetchScheduleInfo = async (scheduleID: string | null): Promise<ScheduleInfo | null> => {
    if (!scheduleID) return null
    const { data } = await supabase
      .from('Schedules')
      .select('id, ScheduleName, Schedule')
      .eq('id', scheduleID)
      .single()
    if (!data) return null
    return {
      ...data,
      Schedule: typeof data.Schedule === 'string' ? JSON.parse(data.Schedule) : data.Schedule
    }
  }

  const fetchBreaksInfo = async (breakID: string | null): Promise<BreakInfo[]> => {
    if (!breakID) return []
    const ids: string[] = typeof breakID === 'string' ? JSON.parse(breakID) : breakID
    if (!ids.length) return []
    const { data } = await supabase
      .from('Breaks')
      .select('id, BreakName, BreakSchedule')
      .in('id', ids)
    if (!data) return []
    return data.map(b => ({
      ...b,
      BreakSchedule: typeof b.BreakSchedule === 'string' ? JSON.parse(b.BreakSchedule) : b.BreakSchedule
    }))
  }

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, FirstName, LastName, Email, ScheduleID, BreakID')
      .eq('CompanyCode', CompanyCode)

    if (error || !data) {
      console.error('Error fetching employees:', error)
      return
    }

    const enriched = await Promise.all(
      data.map(async emp => ({
        ...emp,
        scheduleInfo: await fetchScheduleInfo(emp.ScheduleID),
        breaksInfo: await fetchBreaksInfo(emp.BreakID),
      }))
    )

    updateEmployees(enriched)
  }

  useEffect(() => {
    if (!CompanyCode) return
    if (hasFetched.current) return
    hasFetched.current = true

    fetchEmployees()

    const usersChannel = supabase
      .channel('users-schedule-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `CompanyCode=eq.${CompanyCode}` },
        async (payload) => {
          const updated = payload.new
          const scheduleInfo = await fetchScheduleInfo(updated.ScheduleID)
          const breaksInfo = await fetchBreaksInfo(updated.BreakID)
          const next = employeesRef.current.map(emp =>
            emp.Email === updated.Email
              ? { ...emp, ScheduleID: updated.ScheduleID, BreakID: updated.BreakID, scheduleInfo, breaksInfo }
              : emp
          )
          updateEmployees(next)
        }
      )
      .subscribe()

    const schedulesChannel = supabase
      .channel('schedules-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Schedules' },
        () => { fetchEmployees() }
      )
      .subscribe()

    const breaksChannel = supabase
      .channel('breaks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Breaks' },
        () => { fetchEmployees() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(usersChannel)
      supabase.removeChannel(schedulesChannel)
      supabase.removeChannel(breaksChannel)
    }
  }, [CompanyCode])

  const handleRowClick = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowActionModal(true)
    setActiveAction(null)
  }

  const closeAll = () => {
    setShowActionModal(false)
    setSelectedEmployee(null)
    setActiveAction(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: '10px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="text-secondary-title">Employees</h2>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-alt)' }}>
              {['Name', 'Email', 'Shift Schedule', 'Break Schedule'].map(col => (
                <th key={col} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No employees found under this company.
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr
                  key={emp.id}
                  onClick={() => handleRowClick(emp)}
                  style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-alt)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text)' }}>
                    {emp.FirstName} {emp.LastName}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                    {emp.Email}
                  </td>

                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    {emp.scheduleInfo ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                          {emp.scheduleInfo.ScheduleName}
                        </span>
                        {emp.scheduleInfo.Schedule.map((slot, i) => (
                          <span key={i} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                            {formatTime(slot.timeIn)} – {formatTime(slot.timeOut)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="badge badge-neutral">Unassigned</span>
                    )}
                  </td>

                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    {emp.breaksInfo && emp.breaksInfo.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {emp.breaksInfo.map((b, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                              {b.BreakName}
                            </span>
                            {b.BreakSchedule.map((slot, j) => (
                              <span key={j} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                {formatTime(slot.breakIn)} – {formatTime(slot.breakOut)}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="badge badge-neutral">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showActionModal && selectedEmployee && (
        <div
          onClick={closeAll}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <h3 className="text-subheading">{selectedEmployee.FirstName} {selectedEmployee.LastName}</h3>
                <span className="text-small">{selectedEmployee.Email}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeAll}>✕</button>
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            {!activeAction && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <button className="btn btn-primary btn-block" onClick={() => setActiveAction('assign-schedule')}>
                  Assign Schedule
                </button>
                <button className="btn btn-secondary btn-block" onClick={() => setActiveAction('view-schedule')}>
                  View Schedule
                </button>
                <button className="btn btn-outline btn-block" onClick={() => setActiveAction('assign-temporary')}>
                  Assign Temporary Schedule
                </button>
              </div>
            )}

            {activeAction && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveAction(null)}
                  style={{ width: 'fit-content' }}
                >
                  ← Back
                </button>
                {activeAction === 'assign-schedule' && (
                  <AssignSchedule Email={selectedEmployee.Email} CompanyCode={CompanyCode} />
                )}
                {activeAction === 'view-schedule' && (
                  <ViewSchedule Email={selectedEmployee.Email} CompanyCode={CompanyCode} />
                )}
                {activeAction === 'assign-temporary' && (
                  <AssignTemporarySchedule Email={selectedEmployee.Email} CompanyCode={CompanyCode} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AssignScheduleTable