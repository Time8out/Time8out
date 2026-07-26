import { useEffect, useState, useRef } from "react";
import { supabase } from "../../../utils/supabase";

interface Template {
  id: string;
  Name: string;
  Type: "deduction" | "bonus";
  Formula: string;
  CreatedAt: string;
}

type TokenType = "variable" | "operator" | "comparator" | "logic" | "number";
interface Token { id: string; type: TokenType; value: string; label: string; }

const TOKEN_COLORS: Record<TokenType, { bg: string; color: string; border: string }> = {
  variable:   { bg: "#EEEDFE", color: "#3C3489", border: "#AFA9EC" },
  logic:      { bg: "#F3E8FF", color: "#6B21A8", border: "#D8B4FE" },
  comparator: { bg: "#E6F1FB", color: "#0C447C", border: "#85B7EB" },
  operator:   { bg: "#FFF3ED", color: "#993C1D", border: "#F0997B" },
  number:     { bg: "#EAF3DE", color: "#27500A", border: "#97C459" },
};

const GROUPS: { label: string; type: TokenType; items: { value: string; label: string }[] }[] = [
  { label: "Variables", type: "variable", items: [
    { value: "{Salary}", label: "{Salary}" },
    { value: "{TotalHours}", label: "{TotalHours}" },
    { value: "{DeductionMinutes}", label: "{DeductionMinutes}" },
  ]},
  { label: "Logic", type: "logic", items: [
    { value: "if", label: "if" }, { value: "then", label: "then" },
    { value: "and", label: "and" }, { value: "or", label: "or" },
  ]},
  { label: "Comparators", type: "comparator", items: [
    { value: "<", label: "<" }, { value: ">", label: ">" },
    { value: "<=", label: "≤" }, { value: ">=", label: "≥" }, { value: "==", label: "=" },
  ]},
  { label: "Arithmetic", type: "operator", items: [
    { value: "+", label: "+" }, { value: "-", label: "−" },
    { value: "*", label: "×" }, { value: "/", label: "÷" },
    { value: "(", label: "(" }, { value: ")", label: ")" },
  ]},
];

function uid() { return Math.random().toString(36).slice(2, 8); }

export default function FormulaTemplateManager() {
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"deduction" | "bonus">("deduction");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [numberDraft, setNumberDraft] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function bootstrap() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) { setError("No session found."); setLoading(false); return; }
      const decoded = atob(raw);
      const email = decoded.split(":")[1];
      const { data: user } = await supabase.from("users").select("CompanyCode").eq("Email", email).single();
      if (!user) { setError("Could not load user."); setLoading(false); return; }
      setCompanyCode(user.CompanyCode);
      await fetchTemplates(user.CompanyCode);
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function fetchTemplates(code: string) {
    const { data } = await supabase
      .from("FormulaTemplates")
      .select("*")
      .eq("CompanyCode", code)
      .order("CreatedAt", { ascending: false });
    setTemplates(data ?? []);
  }

  function addToken(tokenType: TokenType, value: string, label: string) {
    setTokens(prev => [...prev, { id: uid(), type: tokenType, value, label }]);
  }
  function removeToken(id: string) { setTokens(prev => prev.filter(t => t.id !== id)); }
  function removeLastToken() { setTokens(prev => prev.slice(0, -1)); }
  function addNumber() {
    const v = numberDraft.trim();
    if (!v || isNaN(Number(v))) return;
    addToken("number", v, v);
    setNumberDraft("");
    numberInputRef.current?.focus();
  }

  async function handleSave() {
    if (!name.trim()) { setMsg({ type: "error", text: "Please enter a template name." }); return; }
    if (tokens.length === 0) { setMsg({ type: "error", text: "Please build a formula." }); return; }
    setSaveLoading(true); setMsg(null);
    const formula = tokens.map(t => t.value).join(" ");
    const { error: e } = await supabase.from("FormulaTemplates").insert([{
      CompanyCode: companyCode,
      Name: name.trim(),
      Type: type,
      Formula: formula,
    }]);
    if (e) { setMsg({ type: "error", text: e.message }); }
    else {
      setMsg({ type: "success", text: "Template saved!" });
      setName(""); setTokens([]); setType("deduction");
      await fetchTemplates(companyCode!);
      setTimeout(() => { setShowForm(false); setMsg(null); }, 1200);
    }
    setSaveLoading(false);
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    await supabase.from("FormulaTemplates").delete().eq("id", id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    setConfirmDeleteId(null);
    setDeleteLoading(false);
  }

  const formulaStr = tokens.map(t => t.value).join(" ");
  const deductionTemplates = templates.filter(t => t.Type === "deduction");
  const bonusTemplates = templates.filter(t => t.Type === "bonus");

  return (
    <>
      <style>{`
        .ftm-page{padding:clamp(var(--space-4),4vw,var(--space-6));font-family:var(--font-base);width:100%;max-width:100%;box-sizing:border-box}
        .ftm-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-6);gap:var(--space-4);flex-wrap:wrap}
        .ftm-title{font-size:var(--font-size-2xl);font-weight:700;color:var(--color-text);letter-spacing:-.02em;margin-bottom:4px}
        .ftm-sub{font-size:var(--font-size-sm);color:var(--color-text-muted)}

        .ftm-section{margin-bottom:var(--space-6)}
        .ftm-section-header{display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)}
        .ftm-section-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase}
        .ftm-section-count{font-size:11px;font-weight:700;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:1px 8px;color:var(--color-text-muted)}

        .ftm-empty{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .ftm-card{background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-2)}
        .ftm-card:last-child{margin-bottom:0}
        .ftm-card-icon{width:32px;height:32px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .ftm-card-icon.deduction{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15)}
        .ftm-card-icon.bonus{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.15)}
        .ftm-card-info{flex:1;min-width:0}
        .ftm-card-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:3px}
        .ftm-card-formula{font-size:11px;font-family:monospace;color:var(--color-text-muted);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px;display:inline-block;word-break:break-all}
        .ftm-card-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .ftm-delete-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap}
        .ftm-delete-btn:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}
        .ftm-confirm-row{display:flex;align-items:center;gap:6px}
        .ftm-confirm-text{font-size:11px;color:#dc2626;font-weight:600}
        .ftm-confirm-yes{padding:4px 10px;border-radius:var(--radius-md);border:none;background:#dc2626;font-size:11px;font-weight:700;color:white;cursor:pointer;font-family:var(--font-base)}
        .ftm-confirm-yes:disabled{opacity:.5}
        .ftm-confirm-no{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base)}

        /* Form modal */
        .ftm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:300;animation:ftmFade .15s ease;padding:16px}
        @keyframes ftmFade{from{opacity:0}to{opacity:1}}
        .ftm-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:560px;max-height:94vh;overflow-y:auto;animation:ftmUp .2s cubic-bezier(.22,1,.36,1)}
        @keyframes ftmUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .ftm-modal-band{height:4px;background:var(--gradient-brand);border-radius:var(--radius-xl) var(--radius-xl) 0 0}
        .ftm-modal-body{padding:var(--space-6)}
        .ftm-modal-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:var(--space-5);letter-spacing:-.01em}

        .ftm-type-toggle{display:flex;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:3px;gap:3px;margin-bottom:var(--space-4)}
        .ftm-type-btn{flex:1;padding:7px 12px;border-radius:calc(var(--radius-lg) - 2px);border:none;font-size:var(--font-size-xs);font-weight:700;cursor:pointer;font-family:var(--font-base);transition:all .15s;color:var(--color-text-muted);background:transparent}
        .ftm-type-btn.active{background:var(--color-white);color:var(--color-text);box-shadow:0 1px 4px rgba(0,0,0,0.08);border:1px solid var(--color-border)}

        .ftm-canvas-wrap{border:1.5px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:var(--space-4)}
        .ftm-canvas-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase;padding:8px 14px 0}
        .ftm-canvas{min-height:56px;padding:8px 12px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
        .ftm-canvas-ph{font-size:13px;color:var(--color-text-faint);font-style:italic}
        .ftm-canvas-footer{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-bg-alt);border-top:1px solid var(--color-border)}
        .ftm-formula-text{font-size:11px;font-family:monospace;color:var(--color-text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ftm-canvas-actions{display:flex;gap:6px;flex-shrink:0}
        .ftm-canvas-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:12px;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-base);transition:all .15s}
        .ftm-canvas-btn:hover{background:rgba(239,68,68,0.07);color:#ef4444;border-color:rgba(239,68,68,0.3)}

        .ftm-token{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:99px;font-size:13px;font-weight:700;border:1.5px solid;white-space:nowrap;animation:tokenPop .12s cubic-bezier(.22,1,.36,1)}
        @keyframes tokenPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
        .ftm-token-x{background:none;border:none;cursor:pointer;opacity:0;font-size:10px;padding:0;line-height:1;transition:opacity .15s;margin-left:1px}
        .ftm-token:hover .ftm-token-x{opacity:.7}
        .ftm-token-x:hover{opacity:1 !important}

        .ftm-picker{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)}
        .ftm-picker-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}
        @media(max-width:480px){.ftm-picker-grid{grid-template-columns:1fr}}
        .ftm-group-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
        .ftm-chip-row{display:flex;flex-wrap:wrap;gap:5px}
        .ftm-chip{padding:6px 13px;border-radius:99px;font-size:13px;font-weight:700;border:1.5px solid;cursor:pointer;font-family:var(--font-base);transition:transform .1s,opacity .1s}
        .ftm-chip:hover{transform:translateY(-1px);opacity:.9}
        .ftm-chip:active{transform:scale(.95)}
        .ftm-number-section{margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border)}
        .ftm-number-row{display:flex;gap:var(--space-2);align-items:center}
        .ftm-number-row input{flex:1}
        .ftm-number-add{padding:8px 16px;border-radius:var(--radius-md);background:var(--color-white);border:1px solid var(--color-border);font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-base);white-space:nowrap}
        .ftm-number-add:hover{background:var(--color-border)}

        .ftm-divider{height:1px;background:var(--color-border);margin:var(--space-4) 0}
        .ftm-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .ftm-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4)}
        .ftm-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .ftm-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .ftm-modal-footer{display:flex;justify-content:flex-end;gap:var(--space-3);padding-top:var(--space-4);border-top:1px solid var(--color-border)}
      `}</style>

      <div className="ftm-page">
        <div className="ftm-header">
          <div>
            <h1 className="ftm-title">Formula Templates</h1>
            <p className="ftm-sub">Create reusable deduction and bonus formulas for your company.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setMsg(null); setTokens([]); setName(""); setType("deduction"); }}>
            + New Template
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "var(--space-8)" }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 10 }} />)}
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <>
            {/* Deduction Templates */}
            <div className="ftm-section">
              <div className="ftm-section-header">
                <span className="ftm-section-label">Deduction Templates</span>
                <span className="ftm-section-count">{deductionTemplates.length}</span>
              </div>
              {deductionTemplates.length === 0 ? (
                <div className="ftm-empty">No deduction templates yet.</div>
              ) : deductionTemplates.map(t => (
                <div key={t.id} className="ftm-card">
                  <div className="ftm-card-icon deduction">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  <div className="ftm-card-info">
                    <div className="ftm-card-name">{t.Name}</div>
                    <span className="ftm-card-formula">= {t.Formula}</span>
                  </div>
                  <div className="ftm-card-actions">
                    {confirmDeleteId === t.id ? (
                      <div className="ftm-confirm-row">
                        <span className="ftm-confirm-text">Remove?</span>
                        <button className="ftm-confirm-yes" disabled={deleteLoading} onClick={() => handleDelete(t.id)}>{deleteLoading ? "…" : "Yes"}</button>
                        <button className="ftm-confirm-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button className="ftm-delete-btn" onClick={() => setConfirmDeleteId(t.id)}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bonus Templates */}
            <div className="ftm-section">
              <div className="ftm-section-header">
                <span className="ftm-section-label">Bonus & Incentive Templates</span>
                <span className="ftm-section-count">{bonusTemplates.length}</span>
              </div>
              {bonusTemplates.length === 0 ? (
                <div className="ftm-empty">No bonus templates yet.</div>
              ) : bonusTemplates.map(t => (
                <div key={t.id} className="ftm-card">
                  <div className="ftm-card-icon bonus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  <div className="ftm-card-info">
                    <div className="ftm-card-name">{t.Name}</div>
                    <span className="ftm-card-formula">= {t.Formula}</span>
                  </div>
                  <div className="ftm-card-actions">
                    {confirmDeleteId === t.id ? (
                      <div className="ftm-confirm-row">
                        <span className="ftm-confirm-text">Remove?</span>
                        <button className="ftm-confirm-yes" disabled={deleteLoading} onClick={() => handleDelete(t.id)}>{deleteLoading ? "…" : "Yes"}</button>
                        <button className="ftm-confirm-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <button className="ftm-delete-btn" onClick={() => setConfirmDeleteId(t.id)}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── New Template Modal ── */}
      {showForm && (
        <div className="ftm-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="ftm-modal">
            <div className="ftm-modal-band" />
            <div className="ftm-modal-body">
              <div className="ftm-modal-title">New Formula Template</div>

              <div className="ftm-type-toggle">
                <button className={`ftm-type-btn${type === "deduction" ? " active" : ""}`} onClick={() => setType("deduction")}>− Deduction</button>
                <button className={`ftm-type-btn${type === "bonus" ? " active" : ""}`} onClick={() => setType("bonus")}>+ Bonus & Incentive</button>
              </div>

              <div className="ftm-canvas-wrap">
                <div className="ftm-canvas-label">Formula</div>
                <div className="ftm-canvas">
                  {tokens.length === 0
                    ? <span className="ftm-canvas-ph">Click the blocks below to start building…</span>
                    : tokens.map(t => {
                        const c = TOKEN_COLORS[t.type];
                        return (
                          <span key={t.id} className="ftm-token" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
                            {t.label}
                            <button className="ftm-token-x" style={{ color: c.color }} onClick={() => removeToken(t.id)}>✕</button>
                          </span>
                        );
                      })
                  }
                </div>
                <div className="ftm-canvas-footer">
                  <span className="ftm-formula-text">{formulaStr ? `= ${formulaStr}` : "Your formula will appear here"}</span>
                  <div className="ftm-canvas-actions">
                    <button className="ftm-canvas-btn" onClick={removeLastToken}>⌫ Undo</button>
                    <button className="ftm-canvas-btn" onClick={() => setTokens([])}>Clear</button>
                  </div>
                </div>
              </div>

              <div className="ftm-picker">
                <div className="ftm-picker-grid">
                  {GROUPS.map(group => {
                    const c = TOKEN_COLORS[group.type];
                    return (
                      <div key={group.label}>
                        <div className="ftm-group-label">{group.label}</div>
                        <div className="ftm-chip-row">
                          {group.items.map(item => (
                            <button key={item.value} className="ftm-chip"
                              style={{ color: c.color, borderColor: c.border, background: c.bg }}
                              onClick={() => addToken(group.type, item.value, item.label)}
                            >{item.label}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="ftm-number-section">
                  <div className="ftm-group-label">Number value</div>
                  <div className="ftm-number-row">
                    <input ref={numberInputRef} className="form-input" type="number"
                      placeholder="Type a number and press Enter or click Add"
                      value={numberDraft}
                      onChange={e => setNumberDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addNumber(); }}
                    />
                    <button className="ftm-number-add" onClick={addNumber}>+ Add</button>
                  </div>
                </div>
              </div>

              <div className="ftm-divider" />

              <label className="ftm-label">Template name *</label>
              <input className="form-input" placeholder="e.g. Tax 5%, Perfect Attendance Bonus"
                value={name} onChange={e => setName(e.target.value)}
                style={{ marginBottom: "var(--space-4)" }}
              />

              {msg && <div className={`ftm-alert ${msg.type}`}>{msg.text}</div>}

              <div className="ftm-modal-footer">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saveLoading || tokens.length === 0 || !name.trim()}>
                  {saveLoading ? "Saving…" : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}