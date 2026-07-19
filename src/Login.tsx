// LoginRegister.tsx — Time8out

import { useState } from "react";
import { supabase } from "../utils/supabase";
import logo from "../src/assets/logo.svg";

type Mode = "login" | "register";

type LoginForm = { email: string; password: string; };
type RegisterForm = {
  firstName: string; lastName: string; username: string;
  employeeId: string; email: string; password: string;
  confirmPassword: string; companyName: string; subscriptionPlan: string;
};
type FieldErrors<T> = Partial<Record<keyof T, string>>;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBSCRIPTION_PLANS = [
  { key: "FreeTrial", name: "Free Trial", priceLabel: "Free", cadence: "1 Month", range: "Up to 20 employees", employeeLimit: 20 },
  { key: "Bronze", name: "Bronze", priceLabel: "₱500/mo", cadence: "Monthly Subscription", range: "21 – 50 employees", employeeLimit: 50 },
  { key: "Silver", name: "Silver", priceLabel: "₱1,500/mo", cadence: "Monthly Subscription", range: "51 – 100 employees", employeeLimit: 100 },
  { key: "Platinum", name: "Platinum", priceLabel: "₱2,500/mo", cadence: "Monthly Subscription", range: "101 – 200 employees", employeeLimit: 200 },
  { key: "Gold", name: "Gold", priceLabel: "₱5,000/mo", cadence: "Monthly Subscription", range: "201 – Unlimited employees", employeeLimit: null as number | null },
] as const;

export default function LoginRegister() {
  const [mode, setMode] = useState<Mode>("login");

  const [login, setLogin] = useState<LoginForm>({ email: "", password: "" });
  const [loginErrors, setLoginErrors] = useState<FieldErrors<LoginForm>>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [subscriptionNotice, setSubscriptionNotice] = useState<{ type: "expired" | "reminder"; daysLeft: number } | null>(null);
  const [pendingLoginData, setPendingLoginData] = useState<any | null>(null);

  const [reg, setReg] = useState<RegisterForm>({
    firstName: "", lastName: "", username: "", employeeId: "",
    email: "", password: "", confirmPassword: "", companyName: "",
    subscriptionPlan: "FreeTrial",
  });
  const [regErrors, setRegErrors] = useState<FieldErrors<RegisterForm>>({});
  const [regLoading, setRegLoading] = useState(false);
  const [regMsg, setRegMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [showEmployeeIdWarning, setShowEmployeeIdWarning] = useState(false);

  const validateLogin = (): boolean => {
    const e: FieldErrors<LoginForm> = {};
    if (!login.email.trim()) e.email = "Email is required.";
    else if (!emailRe.test(login.email)) e.email = "Enter a valid email address.";
    if (!login.password) e.password = "Password is required.";
    setLoginErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateRegister = (skipEmployeeIdCheck = false): boolean => {
    const e: FieldErrors<RegisterForm> = {};
    if (!reg.firstName.trim()) e.firstName = "First name is required.";
    if (!reg.lastName.trim()) e.lastName = "Last name is required.";
    if (!reg.username.trim()) e.username = "Username is required.";
    else if (reg.username.length < 3) e.username = "Username must be at least 3 characters.";
    else if (!/^[a-zA-Z0-9_]+$/.test(reg.username)) e.username = "Letters, numbers, and underscores only.";
    if (!reg.email.trim()) e.email = "Email is required.";
    else if (!emailRe.test(reg.email)) e.email = "Enter a valid email address.";
    if (!reg.companyName.trim()) e.companyName = "Company name is required.";
    if (!reg.password) e.password = "Password is required.";
    else if (reg.password.length < 8) e.password = "Password must be at least 8 characters.";
    if (!reg.confirmPassword) e.confirmPassword = "Please confirm your password.";
    else if (reg.password !== reg.confirmPassword) e.confirmPassword = "Passwords do not match.";
    setRegErrors(e);
    if (Object.keys(e).length > 0) return false;
    if (!skipEmployeeIdCheck && !reg.employeeId.trim()) {
      setShowEmployeeIdWarning(true);
      return false;
    }
    return true;
  };

  const completeLogin = async (data: any) => {
    if (data.InitialLogin === null) {
      await supabase.from("users").update({ InitialLogin: true }).eq("Email", data.Email);
    } else if (data.InitialLogin === true) {
      await supabase.from("users").update({ InitialLogin: false }).eq("Email", data.Email);
    }

    const token = btoa(`t8:${data.Email}:${Date.now()}`);
    sessionStorage.setItem("t8_session", token);
    window.dispatchEvent(new Event("storage"));
    window.location.href = "/ETimeModule/EmployeeTime";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoginLoading(true);
    setLoginMsg(null);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("Email", login.email)
      .eq("Password", login.password)
      .single();

    if (error || !data) {
      setLoginMsg({ type: "error", text: "Invalid email or password." });
      setLoginLoading(false);
      return;
    }

    // The Special (owner) user's row carries the company's subscription info —
    // look it up by CompanyCode alone, since the person logging in may not be the Special user.
    const { data: specialUser } = await supabase
      .from("users")
      .select("SubscriptionLevel, BrandAmbassador")
      .eq("CompanyCode", data.CompanyCode)
      .eq("UserType", "Special")
      .maybeSingle();

    const subscription = specialUser?.SubscriptionLevel?.[0];
    const isBrandAmbassador = specialUser?.BrandAmbassador === true;

    if (subscription && subscription.Type !== "Free Trial" && !isBrandAmbassador) {
      const daysElapsed = Math.floor((Date.now() - new Date(subscription.Date).getTime()) / (1000 * 60 * 60 * 24));

      if (daysElapsed > 30) {
        setSubscriptionNotice({ type: "expired", daysLeft: 0 });
        setLoginLoading(false);
        return;
      }

      if (daysElapsed >= 25) {
        setPendingLoginData(data);
        setSubscriptionNotice({ type: "reminder", daysLeft: 30 - daysElapsed });
        setLoginLoading(false);
        return;
      }
    }

    await completeLogin(data);
    setLoginLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) return;
    await submitRegister();
  };

  const submitRegister = async () => {
    setRegLoading(true);
    setRegMsg(null);
    setShowEmployeeIdWarning(false);

    const { data: existing, error: checkError } = await supabase
      .from("users").select("Email").eq("Email", reg.email).maybeSingle();

    if (checkError) {
      setRegMsg({ type: "error", text: "Something went wrong. Please try again." });
      setRegLoading(false);
      return;
    }
    if (existing) {
      setRegErrors(prev => ({ ...prev, email: "This email is already registered." }));
      setRegLoading(false);
      return;
    }

    const initials = (reg.companyName.slice(0, 2) + reg.username.slice(0, 2)).toUpperCase();
    const datePart = Date.now().toString(36).slice(-4).toUpperCase();
    const companyCode = (initials + datePart).slice(0, 8);

    const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.key === reg.subscriptionPlan) ?? SUBSCRIPTION_PLANS[0];

    const { error: insertError } = await supabase.from("users").insert([{
      FirstName: reg.firstName,
      LastName: reg.lastName,
      UserName: reg.username,
      EmployeeID: reg.employeeId.trim() || null,
      Password: reg.password,
      CompanyName: reg.companyName,
      UserType: "Special",
      Email: reg.email,
      System: [{ EmployeeTime: "YES", GymTracker: "NO", ESLScheduler: "NO" }],
      CompanyCode: companyCode,
      SubscriptionLevel: [{
        Type: selectedPlan.name,
        EmployeeLimit: selectedPlan.employeeLimit ?? "Unlimited",
        Date: new Date().toISOString(),
      }],
    }]);

    if (insertError) {
      setRegMsg({ type: "error", text: insertError.message });
      setRegLoading(false);
      return;
    }

    const token = btoa(`t8:${reg.email}:${Date.now()}`);
    sessionStorage.setItem("t8_session", token);
    window.dispatchEvent(new Event("storage"));
    window.location.href = "/ETimeModule/EmployeeTime";
    setRegLoading(false);
  };

  const setLoginField = (field: keyof LoginForm, value: string) => {
    setLogin(p => ({ ...p, [field]: value }));
    if (loginErrors[field]) setLoginErrors(p => ({ ...p, [field]: undefined }));
    if (loginMsg) setLoginMsg(null);
  };

  const setRegField = (field: keyof RegisterForm, value: string) => {
    setReg(p => ({ ...p, [field]: value }));
    if (regErrors[field]) setRegErrors(p => ({ ...p, [field]: undefined }));
    if (regMsg) setRegMsg(null);
    if (field === "employeeId" && value.trim()) setShowEmployeeIdWarning(false);
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
        .auth-header-inner{max-width:1200px;margin:0 auto;padding:0 var(--space-6);height:68px;display:flex;align-items:center;justify-content:space-between}
        .auth-logo{display:flex;align-items:center;gap:var(--space-2);text-decoration:none}
        .auth-logo img{height:45px;width:auto}
        .auth-back{display:inline-flex;align-items:center;gap:var(--space-2);text-decoration:none;font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-muted);transition:color var(--transition-fast)}
        .auth-back:hover{color:var(--brand-orange)}
        .auth-main{flex:1;display:flex;align-items:center;justify-content:center;padding:var(--space-10) var(--space-4)}
        .auth-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);width:100%;max-width:480px;overflow:hidden;animation:auth-rise 0.35s cubic-bezier(0.22,1,0.36,1) forwards}
        @keyframes auth-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .auth-card.register{max-width:540px}
        .auth-card-band{height:4px;background:var(--gradient-brand)}
        .auth-card-body{padding:var(--space-8) var(--space-8) var(--space-10)}
        @media(max-width:480px){.auth-card-body{padding:var(--space-6) var(--space-5) var(--space-8)}}
        .auth-tabs{display:flex;background:var(--color-bg);border-radius:var(--radius-md);padding:3px;margin-bottom:var(--space-8);border:1px solid var(--color-border)}
        .auth-tab{flex:1;padding:9px var(--space-4);border-radius:calc(var(--radius-md) - 2px);border:none;background:transparent;font-family:var(--font-base);font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-muted);cursor:pointer;transition:background var(--transition-fast),color var(--transition-fast),box-shadow var(--transition-fast)}
        .auth-tab.active{background:var(--color-white);color:var(--brand-orange);box-shadow:var(--shadow-sm)}
        .auth-title{font-size:var(--font-size-xl);font-weight:700;letter-spacing:-0.02em;color:var(--color-text);margin-bottom:var(--space-1)}
        .auth-subtitle{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-6);line-height:1.6}
        .auth-form{display:flex;flex-direction:column;gap:var(--space-4)}
        .auth-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}
        @media(max-width:480px){.auth-row{grid-template-columns:1fr}}
        .auth-field{display:flex;flex-direction:column;gap:var(--space-2)}
        .auth-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary)}
        .auth-label span{color:var(--brand-orange);margin-left:2px}
        .auth-label .auth-label-optional{color:var(--color-text-faint);font-weight:400;font-size:var(--font-size-xs);margin-left:5px}
        .auth-input-wrap{position:relative}
        .auth-input-wrap input{padding-right:42px}
        .auth-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;padding:0;cursor:pointer;color:var(--color-text-faint);display:flex;align-items:center;transition:color var(--transition-fast)}
        .auth-eye:hover{color:var(--brand-orange)}
        .auth-error{font-size:var(--font-size-xs);color:var(--color-danger);font-weight:600;display:flex;align-items:center;gap:4px}
        .auth-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;line-height:1.5;display:flex;align-items:flex-start;gap:var(--space-2)}
        .auth-alert.error{background:var(--color-danger-light);color:var(--color-danger);border:1px solid rgba(220,38,38,0.2)}
        .auth-alert.success{background:var(--color-success-light);color:var(--color-success);border:1px solid rgba(22,163,74,0.2)}
        .auth-alert.warning{background:rgba(234,179,8,0.08);color:#92400e;border:1px solid rgba(234,179,8,0.35)}
        .auth-warning-actions{display:flex;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap}
        .auth-warning-btn{padding:7px 14px;border-radius:var(--radius-md);font-size:var(--font-size-xs);font-weight:700;cursor:pointer;border:none;font-family:var(--font-base);transition:opacity var(--transition-fast),transform var(--transition-fast)}
        .auth-warning-btn:hover{opacity:0.85;transform:translateY(-1px)}
        .auth-warning-btn.primary{background:var(--gradient-orange);color:white;box-shadow:var(--shadow-brand-orange)}
        .auth-warning-btn.ghost{background:transparent;color:#92400e;border:1.5px solid rgba(234,179,8,0.4)}
        .auth-forgot{text-align:right;margin-top:calc(-1 * var(--space-2))}
        .auth-forgot a{font-size:var(--font-size-xs);color:var(--color-text-muted);text-decoration:none;font-weight:500;transition:color var(--transition-fast)}
        .auth-forgot a:hover{color:var(--brand-orange)}
        .auth-submit{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);width:100%;padding:13px;border-radius:var(--radius-md);border:none;background:var(--gradient-orange);color:var(--color-white);font-family:var(--font-base);font-size:var(--font-size-base);font-weight:700;cursor:pointer;box-shadow:var(--shadow-brand-orange);margin-top:var(--space-2);transition:transform var(--transition-fast),box-shadow var(--transition-fast),opacity var(--transition-fast)}
        .auth-submit:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(233,82,14,0.4)}
        .auth-submit:active:not(:disabled){transform:translateY(0)}
        .auth-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .auth-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .auth-footer-note{margin-top:var(--space-5);text-align:center;font-size:var(--font-size-xs);color:var(--color-text-faint);line-height:1.6}
        .auth-footer-note a{color:var(--brand-orange);text-decoration:none;font-weight:600}
        .auth-footer-note a:hover{text-decoration:underline}
        .auth-divider{display:flex;align-items:center;gap:var(--space-3);margin:var(--space-2) 0;font-size:var(--font-size-xs);color:var(--color-text-faint);font-weight:500;letter-spacing:0.04em;text-transform:uppercase}
        .auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:var(--color-border)}
        .auth-strength{display:flex;gap:4px;margin-top:4px}
        .auth-strength-bar{flex:1;height:3px;border-radius:var(--radius-full);background:var(--color-border);transition:background var(--transition-base)}
        .auth-strength-bar.weak{background:var(--color-danger)}
        .auth-strength-bar.fair{background:var(--color-warning)}
        .auth-strength-bar.strong{background:var(--color-success)}
        .auth-strength-label{font-size:var(--font-size-xs);color:var(--color-text-faint);margin-top:3px}
        .auth-terms{font-size:var(--font-size-xs);color:var(--color-text-faint);line-height:1.6;text-align:center}
        .auth-terms a{color:var(--color-text-muted);text-decoration:underline}
        .auth-plans-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)}
        @media(max-width:480px){.auth-plans-grid{grid-template-columns:1fr}}
        .auth-plan-card{text-align:left;cursor:pointer;border:1.5px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-white);padding:var(--space-3) var(--space-4);font-family:var(--font-base);transition:border-color var(--transition-fast),box-shadow var(--transition-fast)}
        .auth-plan-card:hover{border-color:var(--brand-orange)}
        .auth-plan-card.selected{border-color:var(--brand-orange);box-shadow:0 0 0 2px var(--brand-orange-light)}
        .auth-plan-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .auth-plan-price{font-size:var(--font-size-sm);font-weight:600;color:var(--brand-orange);margin-top:2px}
        .auth-plan-cadence{font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:4px}
        .auth-plan-range{font-size:var(--font-size-xs);color:var(--color-text-faint);margin-top:2px}

        .sub-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:300;padding:16px}
        .sub-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:420px;overflow:hidden}
        .sub-modal-band{height:4px;background:var(--gradient-brand)}
        .sub-modal-band.expired{background:var(--color-danger)}
        .sub-modal-body{padding:var(--space-6) var(--space-6) var(--space-8);text-align:center}
        .sub-modal-icon{font-size:32px;margin-bottom:var(--space-3)}
        .sub-modal-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:var(--space-2);letter-spacing:-0.01em}
        .sub-modal-text{font-size:var(--font-size-sm);color:var(--color-text-muted);line-height:1.6;margin-bottom:var(--space-6)}
        .sub-modal-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:13px;border-radius:var(--radius-md);border:none;font-family:var(--font-base);font-size:var(--font-size-base);font-weight:700;cursor:pointer;transition:transform var(--transition-fast)}
        .sub-modal-btn:hover{transform:translateY(-2px)}
        .sub-modal-btn.primary{background:var(--gradient-orange);color:var(--color-white);box-shadow:var(--shadow-brand-orange)}
        .sub-modal-btn.danger{background:var(--color-danger);color:var(--color-white)}
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
          <div className={`auth-card${mode === "register" ? " register" : ""}`}>
            <div className="auth-card-band" />
            <div className="auth-card-body">

              <div className="auth-tabs" role="tablist">
                <button role="tab" className={`auth-tab${mode === "login" ? " active" : ""}`}
                  onClick={() => { setMode("login"); setLoginMsg(null); setRegMsg(null); setShowEmployeeIdWarning(false); }}
                  aria-selected={mode === "login"}>Log in</button>
                <button role="tab" className={`auth-tab${mode === "register" ? " active" : ""}`}
                  onClick={() => { setMode("register"); setLoginMsg(null); setRegMsg(null); }}
                  aria-selected={mode === "register"}>Create account</button>
              </div>

              {/* ── LOGIN ── */}
              {mode === "login" && (
                <>
                  <div className="auth-title">Welcome back</div>
                  <div className="auth-subtitle">Sign in to your Time8out account.</div>

                  {loginMsg && (
                    <div className={`auth-alert ${loginMsg.type}`} style={{ marginBottom: "var(--space-4)" }}>
                      {loginMsg.type === "error" ? "⚠" : "✓"} {loginMsg.text}
                    </div>
                  )}

                  <form className="auth-form" onSubmit={handleLogin} noValidate>
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="login-email">Email address <span>*</span></label>
                      <input id="login-email" type="email"
                        className={`form-input${loginErrors.email ? " is-error" : ""}`}
                        placeholder="juan@company.ph" value={login.email}
                        onChange={e => setLoginField("email", e.target.value)}
                        autoComplete="email" autoFocus />
                      {loginErrors.email && <span className="auth-error">⚠ {loginErrors.email}</span>}
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="login-password">Password <span>*</span></label>
                      <div className="auth-input-wrap">
                        <input id="login-password" type={showLoginPw ? "text" : "password"}
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

                    <div className="auth-forgot"><a href="/forgot-password">Forgot password?</a></div>

                    <button type="submit" className="auth-submit" disabled={loginLoading}>
                      {loginLoading ? <><span className="auth-spinner" /> Signing in…</> : "Sign in →"}
                    </button>
                  </form>

                  <div className="auth-divider" style={{ marginTop: "var(--space-6)" }}>or</div>
                  <p className="auth-footer-note">
                    Don't have an account?{" "}
                    <a href="#" onClick={e => { e.preventDefault(); setMode("register"); }}>Create one free</a>
                  </p>
                </>
              )}

              {/* ── REGISTER ── */}
              {mode === "register" && (
                <>
                  <div className="auth-title">Create your account</div>
                  <div className="auth-subtitle">Start your free Time8out trial — no credit card required.</div>

                  {regMsg && (
                    <div className={`auth-alert ${regMsg.type}`} style={{ marginBottom: "var(--space-4)" }}>
                      {regMsg.type === "error" ? "⚠" : "✓"} {regMsg.text}
                    </div>
                  )}

                  {showEmployeeIdWarning && (
                    <div className="auth-alert warning" style={{ marginBottom: "var(--space-4)", flexDirection: "column", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                        <div>
                          <strong>Employee ID is recommended for time logging.</strong><br />
                          Without it, the scanning system won't be able to identify you during clock-in/out.
                        </div>
                      </div>
                      <div className="auth-warning-actions">
                        <button type="button" className="auth-warning-btn ghost"
                          onClick={() => setShowEmployeeIdWarning(false)}>← Add Employee ID</button>
                        <button type="button" className="auth-warning-btn primary"
                          onClick={submitRegister} disabled={regLoading}>
                          {regLoading ? "Creating…" : "Continue anyway →"}
                        </button>
                      </div>
                    </div>
                  )}

                  <form className="auth-form" onSubmit={handleRegister} noValidate>
                    <div className="auth-row">
                      <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-first">First name <span>*</span></label>
                        <input id="reg-first" type="text"
                          className={`form-input${regErrors.firstName ? " is-error" : ""}`}
                          placeholder="Juan" value={reg.firstName}
                          onChange={e => setRegField("firstName", e.target.value)}
                          autoComplete="given-name" autoFocus />
                        {regErrors.firstName && <span className="auth-error">⚠ {regErrors.firstName}</span>}
                      </div>
                      <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-last">Last name <span>*</span></label>
                        <input id="reg-last" type="text"
                          className={`form-input${regErrors.lastName ? " is-error" : ""}`}
                          placeholder="dela Cruz" value={reg.lastName}
                          onChange={e => setRegField("lastName", e.target.value)}
                          autoComplete="family-name" />
                        {regErrors.lastName && <span className="auth-error">⚠ {regErrors.lastName}</span>}
                      </div>
                    </div>

                    <div className="auth-row">
                      <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-username">Username <span>*</span></label>
                        <input id="reg-username" type="text"
                          className={`form-input${regErrors.username ? " is-error" : ""}`}
                          placeholder="juandc" value={reg.username}
                          onChange={e => setRegField("username", e.target.value)}
                          autoComplete="username" spellCheck={false} />
                        {regErrors.username && <span className="auth-error">⚠ {regErrors.username}</span>}
                      </div>
                      <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-company">Company name <span>*</span></label>
                        <input id="reg-company" type="text"
                          className={`form-input${regErrors.companyName ? " is-error" : ""}`}
                          placeholder="Dela Cruz Corp" value={reg.companyName}
                          onChange={e => setRegField("companyName", e.target.value)}
                          autoComplete="organization" />
                        {regErrors.companyName && <span className="auth-error">⚠ {regErrors.companyName}</span>}
                      </div>
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="reg-employee-id">
                        Employee ID <span className="auth-label-optional">(recommended)</span>
                      </label>
                      <input id="reg-employee-id" type="text"
                        className={`form-input${showEmployeeIdWarning && !reg.employeeId.trim() ? " is-error" : ""}`}
                        placeholder="e.g. EMP-001" value={reg.employeeId}
                        onChange={e => setRegField("employeeId", e.target.value)}
                        spellCheck={false} />
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)", lineHeight: 1.5 }}>
                        Used by the scanning system to identify you during clock-in/out.
                      </span>
                    </div>

                    <div className="auth-field">
                      <label className="auth-label">Choose your plan <span>*</span></label>
                      <div className="auth-plans-grid">
                        {SUBSCRIPTION_PLANS.map(plan => (
                          <button
                            type="button"
                            key={plan.key}
                            className={`auth-plan-card${reg.subscriptionPlan === plan.key ? " selected" : ""}`}
                            onClick={() => setRegField("subscriptionPlan", plan.key)}
                          >
                            <div className="auth-plan-name">{plan.name}</div>
                            <div className="auth-plan-price">{plan.priceLabel}</div>
                            <div className="auth-plan-cadence">{plan.cadence}</div>
                            <div className="auth-plan-range">{plan.range}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="reg-email">Email address <span>*</span></label>
                      <input id="reg-email" type="email"
                        className={`form-input${regErrors.email ? " is-error" : ""}`}
                        placeholder="juan@company.ph" value={reg.email}
                        onChange={e => setRegField("email", e.target.value)}
                        autoComplete="email" />
                      {regErrors.email && <span className="auth-error">⚠ {regErrors.email}</span>}
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="reg-password">Password <span>*</span></label>
                      <div className="auth-input-wrap">
                        <input id="reg-password" type={showRegPw ? "text" : "password"}
                          className={`form-input${regErrors.password ? " is-error" : ""}`}
                          placeholder="Min. 8 characters" value={reg.password}
                          onChange={e => setRegField("password", e.target.value)}
                          autoComplete="new-password" />
                        <button type="button" className="auth-eye"
                          onClick={() => setShowRegPw(v => !v)}
                          aria-label={showRegPw ? "Hide password" : "Show password"}>
                          <EyeIcon open={showRegPw} />
                        </button>
                      </div>
                      {reg.password.length > 0 && (() => {
                        const len = reg.password.length;
                        const score = [len >= 8, /[A-Z]/.test(reg.password), /[0-9]/.test(reg.password), /[^a-zA-Z0-9]/.test(reg.password)].filter(Boolean).length;
                        const level = score <= 1 ? "weak" : score <= 2 ? "fair" : "strong";
                        return (
                          <>
                            <div className="auth-strength">
                              {[0,1,2,3].map(i => (
                                <div key={i} className={`auth-strength-bar${((level==="weak"&&i<1)||(level==="fair"&&i<2)||(level==="strong"&&i<4)) ? ` ${level}` : ""}`} />
                              ))}
                            </div>
                            <div className="auth-strength-label">{{ weak:"Weak", fair:"Fair", strong:"Strong" }[level]} password</div>
                          </>
                        );
                      })()}
                      {regErrors.password && <span className="auth-error">⚠ {regErrors.password}</span>}
                    </div>

                    <div className="auth-field">
                      <label className="auth-label" htmlFor="reg-confirm">Confirm password <span>*</span></label>
                      <div className="auth-input-wrap">
                        <input id="reg-confirm" type={showRegConfirm ? "text" : "password"}
                          className={`form-input${regErrors.confirmPassword ? " is-error" : ""}`}
                          placeholder="Repeat your password" value={reg.confirmPassword}
                          onChange={e => setRegField("confirmPassword", e.target.value)}
                          autoComplete="new-password" />
                        <button type="button" className="auth-eye"
                          onClick={() => setShowRegConfirm(v => !v)}
                          aria-label={showRegConfirm ? "Hide password" : "Show password"}>
                          <EyeIcon open={showRegConfirm} />
                        </button>
                      </div>
                      {regErrors.confirmPassword && <span className="auth-error">⚠ {regErrors.confirmPassword}</span>}
                    </div>

                    <p className="auth-terms">
                      By creating an account you agree to our{" "}
                      <a href="/terms">Terms of Service</a> and{" "}
                      <a href="/privacy">Privacy Policy</a>.
                    </p>

                    <button type="submit" className="auth-submit"
                      disabled={regLoading || showEmployeeIdWarning}>
                      {regLoading ? <><span className="auth-spinner" /> Creating account…</> : "Create account →"}
                    </button>
                  </form>

                  <div className="auth-divider" style={{ marginTop: "var(--space-6)" }}>or</div>
                  <p className="auth-footer-note">
                    Already have an account?{" "}
                    <a href="#" onClick={e => { e.preventDefault(); setMode("login"); }}>Sign in</a>
                  </p>
                </>
              )}

            </div>
          </div>
        </main>
      </div>

      {subscriptionNotice && (
        <div className="sub-overlay">
          <div className="sub-modal">
            <div className={`sub-modal-band${subscriptionNotice.type === "expired" ? " expired" : ""}`} />
            <div className="sub-modal-body">
              <div className="sub-modal-icon">{subscriptionNotice.type === "expired" ? "🚫" : "⏰"}</div>
              {subscriptionNotice.type === "expired" ? (
                <>
                  <div className="sub-modal-title">Subscription expired</div>
                  <div className="sub-modal-text">
                    Your company's subscription has expired. Please renew your subscription before you can log in.
                  </div>
                  <button className="sub-modal-btn danger" onClick={() => { setSubscriptionNotice(null); setPendingLoginData(null); }}>
                    Okay
                  </button>
                </>
              ) : (
                <>
                  <div className="sub-modal-title">Renew your subscription soon</div>
                  <div className="sub-modal-text">
                    Your company's subscription will expire in <strong>{subscriptionNotice.daysLeft} day{subscriptionNotice.daysLeft !== 1 ? "s" : ""}</strong>. Please renew it soon to keep using Time8out without interruption.
                  </div>
                  <button
                    className="sub-modal-btn primary"
                    onClick={async () => {
                      const data = pendingLoginData;
                      setSubscriptionNotice(null);
                      setPendingLoginData(null);
                      if (data) await completeLogin(data);
                    }}
                  >
                    Continue →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}