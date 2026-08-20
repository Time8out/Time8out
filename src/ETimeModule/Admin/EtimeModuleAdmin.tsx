import AdminHeader from "./AdminHeader"
import RightMenuAdmin from "./RightMenuAdmin"
import AmbassadorsTable from "./AmbassadorsTable"
import SubscriptionsTable from "./SubscriptionsTable"

function EtimeModuleAdmin() {
  return (
    <div>
      <AdminHeader />
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <RightMenuAdmin />
        <div style={{ flex: 1, minWidth: 0, padding: "var(--space-6)" }}>
          <div id="admin-section-ambassadors">
            <AmbassadorsTable />
          </div>
          <div id="admin-section-subscriptions" style={{ marginTop: "var(--space-6)" }}>
            <SubscriptionsTable />
          </div>
        </div>
      </div>
    </div>
  )
}

export default EtimeModuleAdmin
