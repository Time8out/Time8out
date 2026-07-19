import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../utils/supabase";

interface Company {
  CompanyName: string;
  CompanyCode: string;
}

function SubscriptionsTable() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("CompanyName, CompanyCode");

        if (error) {
          setError("Could not load subscriptions.");
          setLoading(false);
          return;
        }

        const seen = new Map<string, Company>();
        (data ?? []).forEach((row: Company) => {
          if (row.CompanyCode && !seen.has(row.CompanyCode)) {
            seen.set(row.CompanyCode, {
              CompanyName: row.CompanyName,
              CompanyCode: row.CompanyCode,
            });
          }
        });

        setCompanies(Array.from(seen.values()));
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, []);

  return (
    <>
      <style>{`
        .sub-header { margin-bottom: var(--space-4); }
        .sub-title { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-bottom: 4px; }
        .sub-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
        .sub-table-wrap { background: var(--color-white); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
        .sub-table { width: 100%; border-collapse: collapse; }
        .sub-table thead tr { border-bottom: 2px solid var(--color-border); }
        .sub-table th { text-align: left; font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.07em; text-transform: uppercase; padding: 10px 14px; white-space: nowrap; }
        .sub-table td { padding: 13px 14px; font-size: var(--font-size-sm); color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
        .sub-table tbody tr:last-child td { border-bottom: none; }
        .sub-table tbody tr:hover td { color: var(--color-text); background: var(--brand-orange-light); }
        .sub-code { background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; font-size: var(--font-size-xs); font-family: monospace; color: var(--brand-orange); }
      `}</style>

      <div style={{ marginTop: "var(--space-8)" }}>
        <div className="sub-header">
          <div className="sub-title">Subscriptions</div>
          <div className="sub-subtitle">One row per company, based on the users table.</div>
        </div>

        <div className="sub-table-wrap">
          {loading ? (
            <div style={{ padding: "var(--space-8)" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 10 }} />
              ))}
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: "var(--space-4)" }}>{error}</div>
          ) : companies.length === 0 ? (
            <div style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              No companies found.
            </div>
          ) : (
            <table className="sub-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Company Code</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.CompanyCode}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/CompanyDetails", {
                      state: { CompanyName: c.CompanyName, CompanyCode: c.CompanyCode },
                    })}
                  >
                    <td>{c.CompanyName}</td>
                    <td><span className="sub-code">{c.CompanyCode}</span></td>
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

export default SubscriptionsTable
