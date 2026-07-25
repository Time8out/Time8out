import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../utils/supabase'
import ScheduleCreator from './ScheduleCreator'
import BreaksCreator from './BreaksCreator'
import AssignScheduleTable from './AssignScheduleTable'

function CompanyScheduler() {
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const hasFetched = useRef(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const fetchCompanyCode = async () => {
      const raw = sessionStorage.getItem('t8_session')
      if (!raw) return

      const decoded = atob(raw)
      const parts = decoded.split(':')
      const userEmail = parts[1]

      const { data, error } = await supabase
        .from('users')
        .select('CompanyCode')
        .eq('Email', userEmail)
        .single()

      if (!error && data) {
        setCompanyCode(data.CompanyCode)
      } else {
        console.error('Error:', error)
      }
    }

    fetchCompanyCode()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* Top Row — side by side on desktop, stacked on mobile */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        width: '100%'
      }}>
        <div style={{ width: isMobile ? '100%' : '50%' }}>
          <ScheduleCreator CompanyCode={companyCode} />
        </div>
        <div style={{ width: isMobile ? '100%' : '50%' }}>
          <BreaksCreator CompanyCode={companyCode} />
        </div>
      </div>

      {/* Table — full width */}
      <div style={{ width: '100%' }}>
        <AssignScheduleTable CompanyCode={companyCode} />
      </div>

    </div>
  )
}

export default CompanyScheduler