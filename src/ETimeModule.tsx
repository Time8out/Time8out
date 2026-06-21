import { Route, Routes } from "react-router-dom"
import Layout from "./Account/Layout"
import EmployeeTime from "./ETimeModule/EmployeeTime"
import ManageEmployee from "./ETimeModule/ManageEmployee"
import CompanyScheduler from "./ETimeModule/CompanyScheduler"
import Scanner from "./ETimeModule/Scanner"
function ETimeModule() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/EmployeeTime" element={<EmployeeTime />} />
          <Route path="/ManageEmployee" element={<ManageEmployee />} />
          <Route path="/CompanyScheduler" element={<CompanyScheduler />} />
          <Route path="/Scanner" element={<Scanner />} />
        </Routes>
      </Layout>
    </>
  )
}

export default ETimeModule
