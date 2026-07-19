import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Webpage from './MainWeb/Webpage'
import LoginRegister from './Login'
import PrivateRoute from './PrivateRoute'
import ETimeModule from './ETimeModule'
import BarcodeScanner from './scanner/Barcodescanner'
import QRcodeScanner from './scanner/Qrcodescanner'
import RFIDScanner from './scanner/Rfidscanner'
import AdminAccess from './AdminAccess'
import EtimeModuleAdmin from './ETimeModule/Admin/EtimeModuleAdmin'
import CompanyDetails from './ETimeModule/Admin/CompanyDetails'
function App() {

  return (
    <>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Webpage />} />
        <Route path="/login" element={<LoginRegister />} />
        <Route path="/scanner/barcode" element={<BarcodeScanner />} />
        <Route path="/scanner/qr" element={<QRcodeScanner />} />
        <Route path="/scanner/rfid" element={<RFIDScanner />} />
        <Route path="/AdminAccess" element={<AdminAccess />} />
        <Route element={<PrivateRoute />}>
          <Route path="/ETimeModule/*" element={<ETimeModule />} />
          <Route path="/ETimeModuleAdmin/*" element={<EtimeModuleAdmin />} />
          <Route path="/CompanyDetails" element={<CompanyDetails />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
