import { useState } from "react";

const MENU_ICONS: Record<string, string> = {
  Ambassadors: "👥",
  Subscriptions: "💳",
};

const MENU_SECTIONS: Record<string, string> = {
  Ambassadors: "admin-section-ambassadors",
  Subscriptions: "admin-section-subscriptions",
};

const MENUS = Object.keys(MENU_ICONS);

function RightMenuAdmin() {
  const [active, setActive] = useState<string>(MENUS[0]);

  const handleMenuClick = (menu: string) => {
    setActive(menu);
    document
      .getElementById(MENU_SECTIONS[menu])
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .rma-sidebar { width: 260px !important; }
        }
      `}</style>
      <aside className="rma-sidebar" style={styles.sidebar}>
        <div style={styles.header}>
          <span className="text-xs text-muted">Menu</span>
        </div>

        <nav style={styles.nav}>
          {MENUS.map((menu) => {
            const isActive = active === menu;
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
              >
                <span style={styles.icon}>{MENU_ICONS[menu]}</span>
                <span style={styles.label}>{menu}</span>
                {isActive && <span style={styles.activePip} />}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "220px",
    flexShrink: 0,
    height: "100%",
    minHeight: "calc(100vh - 60px)",
    backgroundColor: "var(--color-white)",
    borderRight: "1px solid var(--color-border)",
    display: "flex",
    flexDirection: "column",
    padding: "var(--space-6) 0",
    fontFamily: "var(--font-base)",
    boxSizing: "border-box",
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
      "background var(--transition-fast), color var(--transition-fast)",
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
};

export default RightMenuAdmin;
