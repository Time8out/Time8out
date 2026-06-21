import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../utils/supabase";

const MENU_ICONS: Record<string, string> = {
  Attendance: "🗓",
  Schedule: "📋",
  Leave: "🏖",
  Overtime: "⏱",
  Dispute: "⚠",
  "Manage Employee": "👥",
 "Company Scheduler": "🏢",
 "Scanner": "🕠",
};

const MENU_PATHS: Record<string, string> = {
  Attendance: "/ETimeModule/EmployeeTime",
  Schedule: "/ETimeModule/Schedule",
  Leave: "/ETimeModule/Leave",
  Overtime: "/ETimeModule/Overtime",
  Dispute: "/ETimeModule/Dispute",
  "Manage Employee": "/ETimeModule/ManageEmployee",
  "Company Scheduler": "/ETimeModule/CompanyScheduler",
  "Scanner": "/ETimeModule/Scanner",
};

interface RightMenuProps {
  /** Called after a menu item is tapped — used by Layout to close the mobile drawer */
  onNavigate?: () => void;
}

function RightMenu({ onNavigate }: RightMenuProps) {
  const [menus, setMenus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function fetchMenus() {
      try {
        const raw = sessionStorage.getItem("t8_session");

        if (!raw) {
          setError("No session found.");
          setLoading(false);
          return;
        }

        const decoded = atob(raw);
        const email = decoded.split(":")[1];

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("System")
          .eq("Email", email)
          .single();

        if (userError || !userData) {
          setError("User not found.");
          setLoading(false);
          return;
        }

        const systemObj = userData.System[0];
        const systemType = Object.keys(systemObj).find(
          (key) => systemObj[key] === "YES"
        );

        if (!systemType) {
          setError("No active system found.");
          setLoading(false);
          return;
        }

        const { data: menuData, error: menuError } = await supabase
          .from("RightMenus")
          .select("Menus")
          .eq("SystemType", systemType)
          .single();

        if (menuError || !menuData) {
          setError("Menus not found.");
          setLoading(false);
          return;
        }

        setMenus(menuData.Menus);
      } catch (err) {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    fetchMenus();
  }, []);

  const handleMenuClick = (menu: string) => {
    navigate(MENU_PATHS[menu] ?? "#");
    onNavigate?.(); // close drawer on mobile
  };

  if (loading) {
    return (
      <aside style={styles.sidebar}>
        <div style={styles.loadingWrap}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={styles.skeletonItem} />
          ))}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside style={styles.sidebar}>
        <p style={styles.error}>{error}</p>
      </aside>
    );
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <span className="text-xs text-muted">Menu</span>
      </div>

      <nav style={styles.nav}>
        {menus.map((menu) => {
          const isActive = location.pathname === MENU_PATHS[menu];
          return (
            <button
              key={menu}
              onClick={() => handleMenuClick(menu)}
              style={{
                ...styles.menuItem,
                ...(isActive ? styles.menuItemActive : {}),
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--brand-orange-light)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--brand-orange)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--color-text-secondary)";
                }
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              <span style={styles.icon}>{MENU_ICONS[menu] ?? "◆"}</span>
              <span style={styles.label}>{menu}</span>
              {isActive && <span style={styles.activePip} />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "220px",
    height: "100%",
    minHeight: "calc(100vh - 60px)",
    backgroundColor: "var(--color-white)",
    borderRight: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    padding: "var(--space-6) 0",
    fontFamily: "var(--font-base)",
    boxSizing: "border-box",
    // On mobile this sits inside a fixed drawer so it fills the drawer height
    overflowY: "auto",
  },
  header: {
    padding: "0 var(--space-5) var(--space-4) var(--space-5)",
    borderBottom: "1px solid var(--color-border)",
    marginBottom: "var(--space-3)",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "0 var(--space-3)",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "10px var(--space-3)",
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "transparent",
    color: "var(--color-text-secondary)",
    fontSize: "var(--font-size-sm)",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition:
      "background var(--transition-fast), color var(--transition-fast), transform var(--transition-fast)",
  },
  menuItemActive: {
    background: "var(--brand-orange-light)",
    color: "var(--brand-orange)",
    fontWeight: 600,
  },
  icon: {
    fontSize: "15px",
    width: "20px",
    textAlign: "center",
    flexShrink: 0,
  },
  label: {
    flex: 1,
  },
  activePip: {
    width: "6px",
    height: "6px",
    borderRadius: "var(--radius-full)",
    backgroundColor: "var(--brand-orange)",
    flexShrink: 0,
  },
  loadingWrap: {
    padding: "var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  skeletonItem: {
    height: "38px",
    borderRadius: "var(--radius-md)",
  },
  error: {
    color: "var(--color-danger)",
    fontSize: "var(--font-size-sm)",
    padding: "var(--space-5)",
  },
};

export default RightMenu;