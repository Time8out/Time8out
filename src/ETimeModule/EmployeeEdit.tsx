import { useState, useRef, useEffect, forwardRef } from "react";
import { supabase } from "../../utils/supabase";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

/* ══════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════ */
export interface Employee {
  id?: number;
  FirstName: string;
  LastName: string;
  UserName: string;
  Email: string;
  Password: string;
  CompanyName: string;
  CompanyCode: string;
  UserType: string;
  EmployeeID?: string | null;
  ProximityNumber?: string | null;
  System: { EmployeeTime: string; GymTracker: string; ESLScheduler: string }[];
}

interface EmployeeEditProps {
  employee: Employee;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

/* ══════════════════════════════════════════════════
   QR CODE — real encoding via `qrcode` library
   Renders into a <canvas> then displayed as <img>
══════════════════════════════════════════════════ */
function QRCodeImage({ value, size = 148 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(console.error);
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}

// Expose a ref-compatible wrapper so downloadAsPNG can grab a canvas
const QRCodeCanvas = forwardRef<HTMLCanvasElement, { value: string; size?: number }>(
  ({ value, size = 148 }, ref) => {
    useEffect(() => {
      const el = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!el || !value) return;
      QRCode.toCanvas(el, value, {
        width: size,
        margin: 2,
        color: { dark: "#111827", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }).catch(console.error);
    }, [value, size, ref]);

    return (
      <canvas
        ref={ref}
        width={size}
        height={size}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
    );
  }
);

/* ══════════════════════════════════════════════════
   BARCODE — real Code 128 via `bwip-js` library
   Renders directly into a <canvas>
══════════════════════════════════════════════════ */
const BarcodeCanvas = forwardRef<HTMLCanvasElement, { value: string; width?: number; barHeight?: number }>(
  ({ value, width = 230, barHeight = 64 }, ref) => {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = (ref as React.RefObject<HTMLCanvasElement>) ?? internalRef;

    useEffect(() => {
      const el = canvasRef.current;
      if (!el || !value) return;
      try {
        bwipjs.toCanvas(el, {
          bcid: "code128",
          text: value,
          scale: 3,
          height: barHeight / 4,   // bwip-js height is in mm-ish units
          includetext: true,
          textxalign: "center",
          textsize: 9,
          textfont: "Courier",
          paddingwidth: 8,
          paddingheight: 4,
          backgroundcolor: "ffffff",
          barcolor: "111827",
          textcolor: "374151",
        });
      } catch (e) {
        console.error("[BarcodeCanvas] bwip-js error:", e);
      }
    }, [value, barHeight]);

    return (
      <canvas
        ref={canvasRef}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      />
    );
  }
);

/* ══════════════════════════════════════════════════
   DOWNLOAD — canvas → 4× high-res PNG
══════════════════════════════════════════════════ */
function downloadCanvasAsPNG(canvas: HTMLCanvasElement, filename: string) {
  // bwip-js and qrcode both render at their own resolution directly into canvas
  // so we can just export the canvas data URL directly
  const a = document.createElement("a");
  a.download = filename;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function EmployeeEdit({ employee, onClose, onUpdated, onDeleted }: EmployeeEditProps) {
  const [editForm, setEditForm] = useState<Partial<Employee>>({ ...employee });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  const empId = (editForm.EmployeeID ?? "").trim();
  const hasId = empId.length > 0;
  const displayName = `${employee.FirstName} ${employee.LastName}`;
  const dlName = (prefix: string) => `${prefix}_${empId}_${displayName.replace(/\s+/g, "_")}.png`;

  async function handleUpdate() {
    setLoading(true); setMsg(null);
    const { error } = await supabase.from("users").update({
      FirstName: editForm.FirstName, LastName: editForm.LastName, UserName: editForm.UserName,
      Email: editForm.Email, UserType: editForm.UserType, Password: editForm.Password,
      EmployeeID: empId || null,
      ProximityNumber: (editForm.ProximityNumber ?? "").trim() || null,
    }).eq("Email", employee.Email);
    if (error) setMsg({ type: "error", text: error.message });
    else { setMsg({ type: "success", text: "Updated successfully!" }); onUpdated(); setTimeout(onClose, 1200); }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove ${displayName} from your company?`)) return;
    setLoading(true);
    const { error } = await supabase.from("users").delete().eq("Email", employee.Email);
    if (!error) { onDeleted(); onClose(); }
    else setMsg({ type: "error", text: error.message });
    setLoading(false);
  }

  const isOwner = employee.UserType === "Special";

  return (
    <>
      <style>{`
        .ee-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 200; padding: 12px; animation: ee-fade 0.15s ease;
        }
        @keyframes ee-fade { from{opacity:0} to{opacity:1} }

        .ee-modal {
          background: var(--color-white); border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl); width: 100%; max-width: 560px;
          max-height: 94vh; overflow-y: auto;
          animation: ee-up 0.22s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes ee-up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }

        .ee-band { height: 4px; background: var(--gradient-brand); border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
        .ee-body { padding: 15px; }

        @media (max-width: 480px) {
          .ee-body { padding: var(--space-4) var(--space-4) var(--space-6); }
          .ee-overlay { padding: 8px; align-items: flex-end; }
          .ee-modal { border-radius: var(--radius-xl) var(--radius-xl) 0 0; max-height: 96vh; }
        }

        .ee-head { display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-5); flex-wrap: wrap; }
        .ee-avatar {
          width:48px; height:48px; border-radius:50%; background:var(--gradient-brand);
          display:flex; align-items:center; justify-content:center;
          color:white; font-size:16px; font-weight:700; flex-shrink:0;
        }
        .ee-head-text { min-width: 0; }
        .ee-name { font-size:var(--font-size-base); font-weight:700; color:var(--color-text); letter-spacing:-0.01em; line-height:1.2; }
        .ee-meta { font-size:var(--font-size-xs); color:var(--color-text-muted); margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ee-owner-badge {
          display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700;
          letter-spacing:0.05em; text-transform:uppercase; padding:3px 9px;
          border-radius:var(--radius-full); background:var(--brand-orange-muted);
          color:var(--brand-orange-dark); margin-top:var(--space-1); width:fit-content;
        }

        .ee-divider {
          display:flex; align-items:center; gap:var(--space-3);
          margin:var(--space-5) 0 var(--space-4);
          font-size:var(--font-size-xs); font-weight:700;
          letter-spacing:0.08em; text-transform:uppercase; color:var(--color-text-muted);
        }
        .ee-divider::before,.ee-divider::after { content:''; flex:1; height:1px; background:var(--color-border); }

        .ee-row { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-3); }
        @media (max-width: 400px) { .ee-row { grid-template-columns: 1fr; } }

        .ee-field { display:flex; flex-direction:column; gap:var(--space-2); margin-bottom:var(--space-3); }
        .ee-label { font-size:var(--font-size-sm); font-weight:600; color:var(--color-text-secondary); }
        .ee-label-hint { font-size:var(--font-size-xs); font-weight:400; color:var(--color-text-faint); margin-left:5px; }
        .ee-hint { font-size:var(--font-size-xs); color:var(--color-text-faint); line-height:1.55; margin-top:2px; }
        .ee-warn { font-size:var(--font-size-xs); color:#b45309; font-weight:600; margin-top:2px; display:flex; align-items:center; gap:4px; }

        .ee-alert { padding:var(--space-3) var(--space-4); border-radius:var(--radius-md); font-size:var(--font-size-sm); font-weight:500; margin-bottom:var(--space-4); line-height:1.5; }
        .ee-alert.error   { background:var(--color-danger-light);  color:var(--color-danger); }
        .ee-alert.success { background:var(--color-success-light); color:var(--color-success); }
        .ee-alert.warning { background:rgba(234,179,8,0.08); color:#92400e; border:1px solid rgba(234,179,8,0.35); }

        .ee-pw-wrap { position:relative; }
        .ee-pw-wrap input { padding-right:40px; }
        .ee-pw-eye {
          position:absolute; right:12px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer; color:var(--color-text-faint);
          display:flex; align-items:center; transition:color var(--transition-fast); padding:0;
        }
        .ee-pw-eye:hover { color:var(--brand-orange); }

        .ee-prox-row { display:flex; align-items:center; gap:var(--space-2); }
        .ee-prox-row input { flex:1; min-width:0; }
        .ee-prox-chip {
          display:inline-flex; align-items:center; gap:4px; padding:4px 8px;
          border-radius:var(--radius-full); background:rgba(59,130,246,0.08);
          border:1px solid rgba(59,130,246,0.2); font-size:10px; font-weight:700;
          color:#1d4ed8; white-space:nowrap; flex-shrink:0;
        }

        .ee-codes-shell {
          background:var(--color-bg); border:1px solid var(--color-border);
          border-radius:var(--radius-lg); overflow:hidden; margin-bottom:var(--space-3);
        }
        .ee-codes-note {
          padding:var(--space-3) var(--space-4);
          border-bottom:1px solid var(--color-border);
          border-left:3px solid var(--brand-orange);
          background:var(--color-white);
          font-size:var(--font-size-xs); color:var(--color-text-muted); line-height:1.7;
        }
        .ee-codes-note strong { color:var(--color-text); }
        .ee-codes-grid {
          display:grid; grid-template-columns:1fr 1fr;
          gap:1px; background:var(--color-border);
        }
        @media (max-width: 480px) { .ee-codes-grid { grid-template-columns:1fr; } }

        .ee-code-panel { background:var(--color-white); display:flex; flex-direction:column; }
        .ee-code-head {
          display:flex; align-items:center; justify-content:space-between;
          padding:8px 12px; border-bottom:1px solid var(--color-border); background:var(--color-bg);
          gap: var(--space-2); flex-wrap: wrap;
        }
        .ee-code-title {
          font-size:var(--font-size-xs); font-weight:700;
          letter-spacing:0.07em; text-transform:uppercase; color:var(--color-text-muted);
          display:flex; align-items:center; gap:6px;
        }
        .ee-code-body {
          flex:1; padding:var(--space-3);
          display:flex; align-items:center; justify-content:center; min-height:110px;
          overflow: hidden;
        }
        @media (max-width: 480px) {
          .ee-code-body canvas { max-width: 100%; height: auto; }
        }
        .ee-code-empty {
          display:flex; flex-direction:column; align-items:center; gap:8px;
          color:var(--color-text-faint); text-align:center; font-size:var(--font-size-xs); line-height:1.5;
        }
        .ee-code-empty-icon { font-size:18px; opacity:0.3; }

        .ee-dl-btn {
          display:inline-flex; align-items:center; gap:4px; padding:4px 8px;
          border-radius:var(--radius-sm); border:1px solid var(--color-border);
          background:var(--color-white); font-size:10px; font-weight:600;
          color:var(--color-text-secondary); cursor:pointer; font-family:var(--font-base);
          transition:all var(--transition-fast); white-space:nowrap; flex-shrink:0;
        }
        .ee-dl-btn:hover:not(:disabled) { background:var(--brand-orange); color:white; border-color:var(--brand-orange); }
        .ee-dl-btn:disabled { opacity:0.35; cursor:not-allowed; }

        .ee-footer {
          display:flex; align-items:center; gap:var(--space-3);
          padding-top:var(--space-4); border-top:1px solid var(--color-border); margin-top:var(--space-2);
          flex-wrap: wrap;
        }
        @media (max-width: 400px) {
          .ee-footer { flex-direction: column-reverse; align-items: stretch; }
          .ee-footer .btn { width: 100%; justify-content: center; }
          .ee-footer-spacer { display: none; }
        }
      `}</style>

      <div className="ee-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ee-modal">
          <div className="ee-band" />
          <div className="ee-body">

            {/* Header */}
            <div className="ee-head">
              <div className="ee-avatar">{employee.FirstName?.[0]}{employee.LastName?.[0]}</div>
              <div className="ee-head-text">
                <div className="ee-name">{displayName}</div>
                <div className="ee-meta">@{employee.UserName} · {employee.Email}</div>
                {isOwner && <div className="ee-owner-badge">⭐ Owner</div>}
              </div>
            </div>

            {msg && <div className={`ee-alert ${msg.type}`}>{msg.text}</div>}

            {!hasId && (
              <div className="ee-alert warning">
                ⚠️ <strong>No Employee ID assigned.</strong> Set one below to generate this employee's QR code and barcode for time logging.
              </div>
            )}

            {/* ─── Employee Info ─── */}
            <div className="ee-divider">Employee Info</div>

            <div className="ee-row">
              <div className="ee-field" style={{ marginBottom: 0 }}>
                <label className="ee-label">First Name</label>
                <input className="form-input" value={editForm.FirstName ?? ""}
                  onChange={e => setEditForm(p => ({ ...p, FirstName: e.target.value }))} />
              </div>
              <div className="ee-field" style={{ marginBottom: 0 }}>
                <label className="ee-label">Last Name</label>
                <input className="form-input" value={editForm.LastName ?? ""}
                  onChange={e => setEditForm(p => ({ ...p, LastName: e.target.value }))} />
              </div>
            </div>

            <div className="ee-row" style={{ marginTop: "var(--space-3)" }}>
              <div className="ee-field" style={{ marginBottom: 0 }}>
                <label className="ee-label">Username</label>
                <input className="form-input" value={editForm.UserName ?? ""}
                  onChange={e => setEditForm(p => ({ ...p, UserName: e.target.value }))} />
              </div>
              <div className="ee-field" style={{ marginBottom: 0 }}>
                <label className="ee-label">Role</label>
                {isOwner ? (
                  <input className="form-input" value="Owner" disabled
                    style={{ background: "var(--color-bg-alt)", color: "var(--color-text-muted)", cursor: "not-allowed" }} />
                ) : (
                  <select className="form-select" value={editForm.UserType ?? "Employee"}
                    onChange={e => setEditForm(p => ({ ...p, UserType: e.target.value }))}>
                    <option value="Employee">Employee</option>
                    <option value="Privilege">Admin</option>
                  </select>
                )}
              </div>
            </div>

            <div className="ee-field" style={{ marginTop: "var(--space-3)" }}>
              <label className="ee-label">Email</label>
              <input className="form-input" type="email" value={editForm.Email ?? ""}
                onChange={e => setEditForm(p => ({ ...p, Email: e.target.value }))} />
            </div>

            <div className="ee-field">
              <label className="ee-label">Password</label>
              <div className="ee-pw-wrap">
                <input className="form-input" type={showPassword ? "text" : "password"}
                  value={editForm.Password ?? ""}
                  onChange={e => setEditForm(p => ({ ...p, Password: e.target.value }))} />
                <button className="ee-pw-eye" type="button" onClick={() => setShowPassword(v => !v)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword
                      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* ─── Identification ─── */}
            <div className="ee-divider">Identification</div>

            <div className="ee-field">
              <label className="ee-label">Employee ID <span className="ee-label-hint">(used for scanning & time logging)</span></label>
              <input className={`form-input${!hasId ? " is-error" : ""}`} placeholder="e.g. EMP-001"
                value={editForm.EmployeeID ?? ""}
                onChange={e => setEditForm(p => ({ ...p, EmployeeID: e.target.value }))} spellCheck={false} />
              {!hasId
                ? <span className="ee-warn">⚠ Required for the clock-in/out scanning system.</span>
                : <span className="ee-hint">Encoded in the QR code and barcode below for scanning.</span>
              }
            </div>

            <div className="ee-field">
              <label className="ee-label">Proximity Card Number <span className="ee-label-hint">(RFID / access card)</span></label>
              <div className="ee-prox-row">
                <input className="form-input" placeholder="e.g. 0004872631"
                  value={editForm.ProximityNumber ?? ""}
                  onChange={e => setEditForm(p => ({ ...p, ProximityNumber: e.target.value }))} spellCheck={false} />
                {(editForm.ProximityNumber ?? "").trim() && (
                  <span className="ee-prox-chip">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Card set
                  </span>
                )}
              </div>
              <span className="ee-hint">The number on the employee's proximity / RFID card. Time8out does not issue cards — assigned externally.</span>
            </div>

            {/* ─── ID Card Codes ─── */}
            <div className="ee-divider">ID Card Codes</div>

            <div className="ee-codes-shell">
              <div className="ee-codes-note">
                <strong>How to use:</strong> Download the QR code or barcode as a high-resolution PNG and print it on the employee's physical ID card. The scanning station reads either code to log their time in/out. Both encode the <strong>Employee ID</strong> — save changes first before downloading.
              </div>
              <div className="ee-codes-grid">

                {/* QR Code */}
                <div className="ee-code-panel">
                  <div className="ee-code-head">
                    <span className="ee-code-title">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                      </svg>
                      QR Code
                    </span>
                    <button
                      className="ee-dl-btn"
                      disabled={!hasId}
                      title={hasId ? "Download QR as PNG" : "Set Employee ID first"}
                      onClick={() => qrRef.current && downloadCanvasAsPNG(qrRef.current, dlName("QR"))}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download PNG
                    </button>
                  </div>
                  <div className="ee-code-body">
                    {hasId
                      ? <QRCodeCanvas ref={qrRef} value={empId} size={130} />
                      : <div className="ee-code-empty"><div className="ee-code-empty-icon">⬜</div><div>Set Employee ID<br />to generate QR</div></div>
                    }
                  </div>
                </div>

                {/* Barcode */}
                <div className="ee-code-panel">
                  <div className="ee-code-head">
                    <span className="ee-code-title">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="3" x2="3" y2="21"/><line x1="6" y1="3" x2="6" y2="21"/>
                        <line x1="10" y1="3" x2="10" y2="21"/><line x1="14" y1="3" x2="14" y2="21"/>
                        <line x1="17" y1="3" x2="17" y2="21"/><line x1="21" y1="3" x2="21" y2="21"/>
                      </svg>
                      Barcode (128)
                    </span>
                    <button
                      className="ee-dl-btn"
                      disabled={!hasId}
                      title={hasId ? "Download barcode as PNG" : "Set Employee ID first"}
                      onClick={() => barcodeRef.current && downloadCanvasAsPNG(barcodeRef.current, dlName("Barcode"))}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download PNG
                    </button>
                  </div>
                  <div className="ee-code-body">
                    {hasId
                      ? <BarcodeCanvas ref={barcodeRef} value={empId} barHeight={64} />
                      : <div className="ee-code-empty"><div className="ee-code-empty-icon" style={{ fontFamily: "monospace", letterSpacing: "3px" }}>▌▌▌▌▌▌</div><div>Set Employee ID<br />to generate barcode</div></div>
                    }
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="ee-footer">
              {!isOwner && (
                <button className="btn btn-delete-outline btn-sm" onClick={handleDelete} disabled={loading}>Remove</button>
              )}
              <div className="ee-footer-spacer" style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleUpdate} disabled={loading}>
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}