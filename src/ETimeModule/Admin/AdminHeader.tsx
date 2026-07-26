import logo from "../../assets/logo.svg";

function AdminHeader() {
  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = "/AdminAccess";
  };

  return (
    <>
      <style>{`
        .admin-nav {
          width: 100%;
          height: 60px;
          background-color: rgba(255,255,255,0.85);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          padding: 0 clamp(var(--space-4), 4vw, var(--space-6));
          justify-content: space-between;
          box-shadow: var(--shadow-xs);
          position: sticky;
          top: 0;
          z-index: 100;
          box-sizing: border-box;
          font-family: var(--font-base);
        }
        @media (max-width: 480px) {
          .admin-nav-title { display: none; }
        }
        .admin-nav-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .admin-logo img {
          height: 32px;
          object-fit: contain;
          display: block;
        }
        .admin-nav-title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-secondary);
          padding-left: var(--space-3);
          border-left: 1px solid var(--color-border);
        }
        .admin-logout {
          background: transparent;
          border: 1.5px solid var(--color-border-dark);
          border-radius: var(--radius-md);
          padding: 6px 14px;
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-base);
          white-space: nowrap;
        }
        .admin-logout:hover {
          border-color: var(--color-danger);
          color: var(--color-danger);
          background: var(--color-danger-light);
        }
      `}</style>

      <nav className="admin-nav">
        <div className="admin-nav-left">
          <a href="/" className="admin-logo" style={{ textDecoration: "none" }}>
            <img src={logo} alt="Time8out" />
          </a>
          <span className="admin-nav-title">Admin</span>
        </div>

        <button className="admin-logout" onClick={handleLogout}>
          Log out
        </button>
      </nav>
    </>
  );
}

export default AdminHeader
