import AdminHeader from "./AdminHeader"
import AmbassadorsTable from "./AmbassadorsTable"
import SubscriptionsTable from "./SubscriptionsTable"

function EtimeModuleAdmin() {
  return (
    <div>
      <AdminHeader />
      <div style={{ padding: "var(--space-6)" }}>
        <AmbassadorsTable />
        <SubscriptionsTable />
      </div>
    </div>
  )
}

export default EtimeModuleAdmin
