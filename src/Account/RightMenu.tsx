import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../utils/supabase";

const MENU_ICONS: Record<string, string> = {
  "Profile": "👤",
  Attendance: "🗓",
  Schedule: "📋",
  Overtime: "⏱",
  "Attendance Control": "🛠",
  "Manage Employee": "👥",
  "Company Scheduler": "🏢",
  "Scanner": "🕠",
  "Salary Adjustments": "💰",
  "Formula Templates": "📐",
  "Pay Structure": "⚙",
  "Holidays": "🎉",
  "Over-Time Approval": "✅",
  "Generate Payslip": "🧾",
  "Salary Advance": "💵",
  "Salary Advance Approval": "🧮",
};

const MENU_PATHS: Record<string, string> = {
  "Profile": "/ETimeModule/Profile",
  Attendance: "/ETimeModule/EmployeeTime",
  Schedule: "/ETimeModule/Schedule",
  Overtime: "/ETimeModule/Overtime",
  "Attendance Control": "/ETimeModule/AttendanceControl",
  "Manage Employee": "/ETimeModule/ManageEmployee",
  "Company Scheduler": "/ETimeModule/CompanyScheduler",
  "Salary Adjustments": "/ETimeModule/SalaryAdjustments",
  "Formula Templates": "/ETimeModule/FormulaTemplateManager",
  "Pay Structure": "/ETimeModule/PaySettings",
  "Holidays": "/ETimeModule/Holidays",
  "Over-Time Approval": "/ETimeModule/OverTimeApproval",
  "Scanner": "/ETimeModule/Scanner",
  "Generate Payslip": "/ETimeModule/AdminPayslip",
  "Salary Advance": "/ETimeModule/SalaryAdvance",
  "Salary Advance Approval": "/ETimeModule/SalaryAdvanceApproval",
};

// Menus visible to employees only
const EMPLOYEE_MENUS = ["Profile", "Attendance", "Overtime", "Salary Advance"];

// Presentation-only grouping — purely how the sidebar organizes whatever
// menu names come back from the RightMenus table / EMPLOYEE_MENUS. Adding a
// menu name to a group here does not grant access to it; it's still gated
// by whether that name is present in `menus`.
const MENU_GROUPS: { label: string; items: string[] }[] = [
  { label: "My Workspace", items: ["Profile", "Attendance", "Overtime", "Salary Advance"] },
  { label: "Approvals", items: ["Over-Time Approval", "Salary Advance Approval"] },
  { label: "Employees", items: ["Manage Employee", "Attendance Control"] },
  { label: "Scheduling", items: ["Company Scheduler", "Holidays", "Scanner", "Schedule"] },
  { label: "Payroll", items: ["Pay Structure", "Salary Adjustments", "Formula Templates", "Generate Payslip"] },
];

interface RightMenuProps {
  onNavigate?: () => void;
}

function RightMenu({ onNavigate }: RightMenuProps) {
  const [menus, setMenus] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);
  const [autoLogoutLoading, setAutoLogoutLoading] = useState(false);
  const [autoLogoutSaving, setAutoLogoutSaving] = useState(false);
  // Collapsed by default except "My Workspace" — the active-group effect
  // below still force-expands whichever group holds the current page.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(MENU_GROUPS.filter(g => g.label !== "My Workspace").map(g => g.label))
  );

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
          .select("System, UserType, CompanyCode")
          .eq("Email", email)
          .single();

        if (userError || !userData) {
          setError("User not found.");
          setLoading(false);
          return;
        }

        // Employee — only show Profile, Attendance, Overtime
        if (userData.UserType === "Employee") {
          setMenus(EMPLOYEE_MENUS);
          setLoading(false);
          return;
        }

        setCompanyCode(userData.CompanyCode);
        setIsAdmin(true);

        // Privilege or Special — show all menus from RightMenus table
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

  useEffect(() => {
    if (!isAdmin || !companyCode) return;
    async function fetchAutoLogoutSetting() {
      setAutoLogoutLoading(true);
      const { data } = await supabase
        .from("users")
        .select("AutoLogoutEnabled")
        .eq("CompanyCode", companyCode)
        .eq("UserType", "Special")
        .maybeSingle();
      setAutoLogoutEnabled(data?.AutoLogoutEnabled !== false);
      setAutoLogoutLoading(false);
    }
    fetchAutoLogoutSetting();
  }, [isAdmin, companyCode]);

  async function toggleAutoLogout() {
    if (!companyCode || autoLogoutSaving) return;
    const next = !autoLogoutEnabled;
    setAutoLogoutSaving(true);
    setAutoLogoutEnabled(next);
    // The cron only ever reads this off the "Special" (owner) row — this
    // update also mirrors it onto every other employee under the same
    // CompanyCode purely so the raw Supabase table reads as an obviously
    // company-wide setting instead of looking like one person's toggle.
    const { error: updateError } = await supabase
      .from("users")
      .update({ AutoLogoutEnabled: next })
      .eq("CompanyCode", companyCode);
    if (updateError) {
      setAutoLogoutEnabled(!next);
    }
    setAutoLogoutSaving(false);
  }

  const handleMenuClick = (menu: string) => {
    navigate(MENU_PATHS[menu] ?? "#");
    onNavigate?.();
  };

  function renderMenuButton(menu: string) {
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
  }

  // Group the flat `menus` list for display. Anything returned by
  // RightMenus that isn't in MENU_GROUPS (e.g. a future menu added to the
  // DB but not yet categorized here) falls into "Other" rather than
  // silently disappearing.
  const groupedMenuNames = new Set(MENU_GROUPS.flatMap(g => g.items));
  const ungrouped = menus.filter(m => !groupedMenuNames.has(m));
  const visibleGroups = [
    ...MENU_GROUPS,
    ...(ungrouped.length > 0 ? [{ label: "Other", items: ungrouped }] : []),
  ]
    .map(group => ({ label: group.label, items: group.items.filter(m => menus.includes(m)) }))
    .filter(group => group.items.length > 0);

  function toggleGroup(label: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Whichever group holds the currently active page should never stay
  // collapsed — otherwise navigating somewhere could hide the very item
  // that's highlighted as active.
  useEffect(() => {
    const activeMenu = Object.entries(MENU_PATHS).find(([, path]) => path === location.pathname)?.[0];
    if (!activeMenu) return;
    const activeGroup = visibleGroups.find(g => g.items.includes(activeMenu));
    if (!activeGroup) return;
    setCollapsedGroups(prev => {
      if (!prev.has(activeGroup.label)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup.label);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (loading) {
    return (
      <aside className="rm-sidebar" style={styles.sidebar}>
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
      <aside className="rm-sidebar" style={styles.sidebar}>
        <p style={styles.error}>{error}</p>
      </aside>
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .rm-sidebar { width: 260px !important; }
        }
        .rm-autologout { flex-shrink: 0; padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border); }
        .rm-autologout-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        .rm-autologout-text { min-width: 0; }
        .rm-autologout-label { font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-secondary); }
        .rm-autologout-sub { font-size: 10px; color: var(--color-text-faint); margin-top: 2px; line-height: 1.4; }
        .rm-toggle { position: relative; width: 36px; height: 20px; flex-shrink: 0; cursor: pointer; display: inline-block; }
        .rm-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .rm-toggle-track { position: absolute; inset: 0; border-radius: 99px; background: var(--color-border); transition: background .2s; }
        .rm-toggle input:checked + .rm-toggle-track { background: var(--brand-orange); }
        .rm-toggle input:disabled + .rm-toggle-track { opacity: .6; cursor: not-allowed; }
        .rm-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .2s; pointer-events: none; }
        .rm-toggle input:checked ~ .rm-toggle-thumb { transform: translateX(16px); }
        .rm-group { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--space-4); }
        .rm-group:last-child { margin-bottom: 0; }
        .rm-group-label { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); width: 100%; background: transparent; border: none; cursor: pointer; font-family: var(--font-base); font-size: 10px; font-weight: 700; color: var(--color-text-faint); text-transform: uppercase; letter-spacing: .07em; padding: 4px var(--space-3) 6px; transition: color var(--transition-fast); }
        .rm-group-label:hover { color: var(--color-text-muted); }
        .rm-group-chevron { flex-shrink: 0; transition: transform .18s ease; }
        .rm-group-chevron.collapsed { transform: rotate(-90deg); }
      `}</style>
      <aside className="rm-sidebar" style={styles.sidebar}>
      <div style={styles.header}>
        <span className="text-xs text-muted">Menu</span>
      </div>

      <nav style={styles.nav}>
        {visibleGroups.map(group => {
          const isCollapsed = visibleGroups.length > 1 && collapsedGroups.has(group.label);
          return (
            <div key={group.label} className="rm-group">
              {visibleGroups.length > 1 && (
                <button className="rm-group-label" onClick={() => toggleGroup(group.label)}>
                  {group.label}
                  <svg className={`rm-group-chevron${isCollapsed ? " collapsed" : ""}`} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
              {!isCollapsed && group.items.map(menu => renderMenuButton(menu))}
            </div>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="rm-autologout">
          <div className="rm-autologout-row">
            <div className="rm-autologout-text">
              <div className="rm-autologout-label">Auto Logout</div>
              <div className="rm-autologout-sub">Auto clock-out employees who forget to time out</div>
            </div>
            <label className="rm-toggle">
              <input
                type="checkbox"
                checked={autoLogoutEnabled}
                disabled={autoLogoutLoading || autoLogoutSaving}
                onChange={toggleAutoLogout}
              />
              <div className="rm-toggle-track" />
              <div className="rm-toggle-thumb" />
            </label>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "220px",
    height: "calc(100vh - 60px)",
    // Prevents the parent flex row (.layout-body) from stretching this to
    // match a taller sibling (.layout-content) when a page's content is
    // longer than the viewport — without this, the aside's own fixed
    // height leaves blank space below it inside the stretched wrapper.
    alignSelf: "flex-start",
    position: "sticky",
    top: 60,
    backgroundColor: "var(--color-white)",
    borderRight: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    padding: "var(--space-6) 0 0",
    fontFamily: "var(--font-base)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  header: {
    padding: "0 var(--space-5) var(--space-4) var(--space-5)",
    borderBottom: "1px solid var(--color-border)",
    marginBottom: "var(--space-3)",
    flexShrink: 0,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "0 var(--space-3)",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
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