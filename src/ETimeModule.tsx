import { Route, Routes } from "react-router-dom"
import Layout from "./Account/Layout"
import EmployeeTime from "./ETimeModule/EmployeeTime"
import ManageEmployee from "./ETimeModule/ManageEmployee"
import CompanyScheduler from "./ETimeModule/CompanyScheduler"
import Scanner from "./ETimeModule/Scanner"
import SalaryAdjustments from "./ETimeModule/SalaryAdjustments"
import FormulaTemplateManager from "./ETimeModule/SalaryAdjustments/Formulatemplatemanager"
import PaySettings from "./ETimeModule/SalaryAdjustments/Paysettings"
import Overtime from "./ETimeModule/Overtime"
import Holidays from "./ETimeModule/Holiday"
import OverTimeApproval from "./ETimeModule/OverTimeApproval"
import AttendanceControl from "./ETimeModule/AttendanceControl"
import Profile from "./ETimeModule/Profile"
import AdminPayslip from "./ETimeModule/AdminPayslip"
function ETimeModule() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/EmployeeTime" element={<EmployeeTime />} />
          <Route path="/ManageEmployee" element={<ManageEmployee />} />
          <Route path="/CompanyScheduler" element={<CompanyScheduler />} />
          <Route path="/Scanner" element={<Scanner />} />
          <Route path="/SalaryAdjustments" element={<SalaryAdjustments />} />
          <Route path="/FormulaTemplateManager" element={<FormulaTemplateManager />} />
          <Route path="/PaySettings" element={<PaySettings />} />
          <Route path="/Overtime" element={<Overtime />} />
          <Route path="/Holidays" element={<Holidays />} />
          <Route path="/OverTimeApproval" element={<OverTimeApproval />} />
          <Route path="/AttendanceControl" element={<AttendanceControl />} />
          <Route path="/Profile" element={<Profile />} />
          <Route path="/AdminPayslip" element={<AdminPayslip />} />
        </Routes>
      </Layout>
    </>
  )
}

export default ETimeModule
