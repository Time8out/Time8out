// AdminAccess.tsx — Time8out

import { useState } from "react";
import logo from "./assets/logo.svg";

const ADMIN_USERNAME = "Marbel120722";
const ADMIN_PASSWORD = "051721";

type LoginForm = { username: string; password: string; };
type FieldErrors = Partial<Record<keyof LoginForm, string>>;

export default function AdminAccess() {
  const [login, setLogin] = useState<LoginForm>({ username: "", password: "" });
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showLoginPw, setShowLoginPw] = useState(false);

  const validateLogin = (): boolean => {
    const e: FieldErrors = {};
    if (!login.username.trim()) e.username = "Username is required.";
    if (!login.password) e.password = "Password is required.";
    setLoginErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoginLoading(true);
    setLoginMsg(null);

    if (login.username !== ADMIN_USERNAME || login.password !== ADMIN_PASSWORD) {
      setLoginMsg({ type: "error", text: "Wrong password. Please try to login again." });
      setLoginLoading(false);
      return;
    }

    const token = btoa(`t8:${login.username}:${Date.now()}`);
    sessionStorage.setItem("t8_session", token);
    window.dispatchEvent(new Event("storage"));
    window.location.href = "/ETimeModuleAdmin";
    setLoginLoading(false);
  };

  const setLoginField = (field: keyof LoginForm, value: string) => {
    setLogin(p => ({ ...p, [field]: value }));
    if (loginErrors[field]) setLoginErrors(p => ({ ...p, [field]: undefined }));
    if (loginMsg) setLoginMsg(null);
  };

  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
      ) : (
        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
      )}
    </svg>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

        .auth-page{min-height:100vh;display:flex;flex-direction:column;background:var(--color-bg);font-family:var(--font-base)}
        .auth-accent-bar{height:3px;background:var(--gradient-brand);width:100%;flex-shrink:0}
        .auth-header{background:var(--color-white);box-shadow:var(--shadow-md);flex-shrink:0}
        .auth-header-inner{max-width:1200px;margin:0 auto;padding:0 clamp(var(--space-4),4vw,var(--space-6));height:68px;display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)}
        .auth-logo{display:flex;align-items:center;gap:var(--space-2);text-decoration:none}
        .auth-logo img{height:45px;width:auto}
        .auth-back{display:inline-flex;align-items:center;gap:var(--space-2);text-decoration:none;font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-muted);transition:color var(--transition-fast)}
        .auth-back:hover{color:var(--brand-orange)}
        .auth-main{flex:1;display:flex;align-items:center;justify-content:center;padding:var(--space-10) var(--space-4)}
        .auth-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);width:100%;max-width:480px;overflow:hidden;animation:auth-rise 0.35s cubic-bezier(0.22,1,0.36,1) forwards}
        @keyframes auth-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .auth-card-band{height:4px;background:var(--gradient-brand)}
        .auth-card-body{padding:var(--space-8) var(--space-8) var(--space-10)}
        @media(max-width:480px){.auth-card-body{padding:var(--space-6) var(--space-5) var(--space-8)}}
        .auth-title{font-size:var(--font-size-xl);font-weight:700;letter-spacing:-0.02em;color:var(--color-text);margin-bottom:var(--space-1)}
        .auth-subtitle{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-6);line-height:1.6}
        .auth-form{display:flex;flex-direction:column;gap:var(--space-4)}
        .auth-field{display:flex;flex-direction:column;gap:var(--space-2)}
        .auth-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary)}
        .auth-label span{color:var(--brand-orange);margin-left:2px}
        .auth-input-wrap{position:relative}
        .auth-input-wrap input{padding-right:42px}
        .auth-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;padding:0;cursor:pointer;color:var(--color-text-faint);display:flex;align-items:center;transition:color var(--transition-fast)}
        .auth-eye:hover{color:var(--brand-orange)}
        .auth-error{font-size:var(--font-size-xs);color:var(--color-danger);font-weight:600;display:flex;align-items:center;gap:4px}
        .auth-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;line-height:1.5;display:flex;align-items:flex-start;gap:var(--space-2)}
        .auth-alert.error{background:var(--color-danger-light);color:var(--color-danger);border:1px solid rgba(220,38,38,0.2)}
        .auth-alert.success{background:var(--color-success-light);color:var(--color-success);border:1px solid rgba(22,163,74,0.2)}
        .auth-submit{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);width:100%;padding:13px;border-radius:var(--radius-md);border:none;background:var(--gradient-orange);color:var(--color-white);font-family:var(--font-base);font-size:var(--font-size-base);font-weight:700;cursor:pointer;box-shadow:var(--shadow-brand-orange);margin-top:var(--space-2);transition:transform var(--transition-fast),box-shadow var(--transition-fast),opacity var(--transition-fast)}
        .auth-submit:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(233,82,14,0.4)}
        .auth-submit:active:not(:disabled){transform:translateY(0)}
        .auth-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .auth-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .auth-footer-note{margin-top:var(--space-5);text-align:center;font-size:var(--font-size-xs);color:var(--color-text-faint);line-height:1.6}
      `}</style>

      <div className="auth-page">
        <div className="auth-accent-bar" />
        <header className="auth-header">
          <div className="auth-header-inner">
            <a href="/" className="auth-logo">
              <img src={logo} alt="Time8out" />
            </a>
            <a href="/" className="auth-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to home
            </a>
          </div>
        </header>

        <main className="auth-main">
          <div className="auth-card">
            <div className="auth-card-band" />
            <div className="auth-card-body">

              <div className="auth-title">Admin Access</div>
              <div className="auth-subtitle">Sign in to the Time8out admin module.</div>

              {loginMsg && (
                <div className={`auth-alert ${loginMsg.type}`} style={{ marginBottom: "var(--space-4)" }}>
                  {loginMsg.type === "error" ? "⚠" : "✓"} {loginMsg.text}
                </div>
              )}

              <form className="auth-form" onSubmit={handleLogin} noValidate>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="admin-username">Username <span>*</span></label>
                  <input id="admin-username" type="text"
                    className={`form-input${loginErrors.username ? " is-error" : ""}`}
                    placeholder="Username" value={login.username}
                    onChange={e => setLoginField("username", e.target.value)}
                    autoComplete="username" spellCheck={false} autoFocus />
                  {loginErrors.username && <span className="auth-error">⚠ {loginErrors.username}</span>}
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="admin-password">Password <span>*</span></label>
                  <div className="auth-input-wrap">
                    <input id="admin-password" type={showLoginPw ? "text" : "password"}
                      className={`form-input${loginErrors.password ? " is-error" : ""}`}
                      placeholder="Your password" value={login.password}
                      onChange={e => setLoginField("password", e.target.value)}
                      autoComplete="current-password" />
                    <button type="button" className="auth-eye"
                      onClick={() => setShowLoginPw(v => !v)}
                      aria-label={showLoginPw ? "Hide password" : "Show password"}>
                      <EyeIcon open={showLoginPw} />
                    </button>
                  </div>
                  {loginErrors.password && <span className="auth-error">⚠ {loginErrors.password}</span>}
                </div>

                <button type="submit" className="auth-submit" disabled={loginLoading}>
                  {loginLoading ? <><span className="auth-spinner" /> Signing in…</> : "Sign in →"}
                </button>
              </form>

              <p className="auth-footer-note">Authorized personnel only.</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
