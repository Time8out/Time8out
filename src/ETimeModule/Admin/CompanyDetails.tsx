import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../../utils/supabase";
import AdminHeader from "./AdminHeader";
import CompanySpecificDetails from "./CompanySpecificDetails";
import SubscriptionStatus from "./SubscriptionStatus";
import Ambassadorship from "./Ambassadorship";

interface CompanyDetailsState {
  CompanyName: string;
  CompanyCode: string;
}

interface CompanyUser {
  FirstName: string;
  LastName: string;
  UserName: string;
  Password: string;
  Email: string;
  UserType: string;
}

function CompanyDetails() {
  const location = useLocation();
  const state = location.state as CompanyDetailsState | null;

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      if (!state?.CompanyCode) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("users")
        .select("FirstName, LastName, UserName, Password, Email, UserType")
        .eq("CompanyCode", state.CompanyCode);

      if (error) {
        setError("Could not load users for this company.");
      } else {
        setUsers(data ?? []);
      }
      setLoading(false);
    }

    fetchUsers();
  }, [state?.CompanyCode]);

  return (
    <>
      <style>{`
        .cd-page { padding: clamp(var(--space-4), 4vw, var(--space-6)); font-family: var(--font-base); }
        .cd-top-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6); }
        @media (max-width: 900px) { .cd-top-row { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .cd-top-row { grid-template-columns: 1fr; } }
        .cd-top-card { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: var(--space-4); min-height: 140px; }
        .cd-title { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-bottom: var(--space-1); }
        .cd-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-6); }
        .cd-table-wrap { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow-x: auto; box-shadow: var(--shadow-sm); }
        .cd-table { width: 100%; border-collapse: collapse; min-width: 680px; }
        .cd-table thead tr { border-bottom: 2px solid var(--color-border); }
        .cd-table th { text-align: left; font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.07em; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
        .cd-table td { padding: 13px 14px; font-size: var(--font-size-sm); color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
        .cd-table tbody tr:last-child td { border-bottom: none; }
      `}</style>

      <AdminHeader />

      <div className="cd-page">
        <div className="cd-title">{state?.CompanyName ?? "Company Details"}</div>
        <div className="cd-subtitle">{state?.CompanyCode ? <>Code: <code className="me-code">{state.CompanyCode}</code></> : "No company selected."}</div>

        <div className="cd-top-row">
          <div className="cd-top-card"><CompanySpecificDetails /></div>
          <div className="cd-top-card"><SubscriptionStatus /></div>
          <div className="cd-top-card"><Ambassadorship /></div>
        </div>

        <div className="cd-table-wrap">
          {loading ? (
            <div style={{ padding: "var(--space-8)" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 10 }} />
              ))}
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: "var(--space-4)" }}>{error}</div>
          ) : users.length === 0 ? (
            <div style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              No users found for this company.
            </div>
          ) : (
            <table className="cd-table">
              <thead>
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Email</th>
                  <th>User Type</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i}>
                    <td>{u.FirstName}</td>
                    <td>{u.LastName}</td>
                    <td>{u.UserName}</td>
                    <td>{u.Password}</td>
                    <td>{u.Email}</td>
                    <td>{u.UserType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default CompanyDetails
