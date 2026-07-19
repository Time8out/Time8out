import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../utils/supabase";
import type { Employee } from "../EmployeeEdit";

interface Props {
  employee: Employee;
  onClose: () => void;
}

interface DeductionEntry { Name: string; Formula: string; }

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

export default function Deduction({ employee, onClose }: Props) {
  const [existingDeductions, setExistingDeductions] = useState<DeductionEntry[]>(
    (employee as any).Deductions ?? []
  );
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [numberDraft, setNumberDraft] = useState("");
  const [deductionName, setDeductionName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<{ id: string; Name: string; Formula: string }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    // Fetch deduction templates for this company
    async function loadTemplates() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) return;
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users").select("CompanyCode").eq("Email", email).single();
      if (!user) return;
      const { data } = await supabase.from("FormulaTemplates")
        .select("id, Name, Formula")
        .eq("CompanyCode", user.CompanyCode)
        .eq("Type", "deduction")
        .order("Name", { ascending: true });
      setTemplates(data ?? []);
    }
    loadTemplates();
  }, []);

  function applyTemplate(template: { Name: string; Formula: string }) {
    // Parse formula string back into tokens
    const parts = template.Formula.split(" ").filter(Boolean);
    const newTokens = parts.map(part => {
      const id = uid();
      if (["{Salary}", "{TotalHours}", "{DeductionMinutes}"].includes(part)) return { id, type: "variable" as TokenType, value: part, label: part };
      if (["if", "then", "and", "or"].includes(part)) return { id, type: "logic" as TokenType, value: part, label: part };
      if (["<", ">", "<=", ">=", "=="].includes(part)) return { id, type: "comparator" as TokenType, value: part, label: part === "<=" ? "≤" : part === ">=" ? "≥" : part };
      if (["+", "-", "*", "/", "(", ")"].includes(part)) return { id, type: "operator" as TokenType, value: part, label: part === "-" ? "−" : part === "*" ? "×" : part === "/" ? "÷" : part };
      if (!isNaN(Number(part))) return { id, type: "number" as TokenType, value: part, label: part };
      return { id, type: "variable" as TokenType, value: part, label: part };
    });
    setTokens(newTokens);
    setDeductionName(template.Name);
    setShowTemplates(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showTemplates) { setShowTemplates(false); return; }
        if (confirmDeleteIndex !== null) { setConfirmDeleteIndex(null); return; }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmDeleteIndex, showTemplates]);

  function addToken(type: TokenType, value: string, label: string) {
    setTokens(prev => [...prev, { id: uid(), type, value, label }]);
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

  async function handleDeleteDeduction(index: number) {
    setDeleteLoading(true);
    const updated = existingDeductions.filter((_, i) => i !== index);
    const { error } = await supabase.from("users").update({ Deductions: updated }).eq("Email", employee.Email);
    if (!error) {
      setExistingDeductions(updated);
      setConfirmDeleteIndex(null);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setMsg({ type: "error", text: error.message });
    }
    setDeleteLoading(false);
  }

  const formulaStr = tokens.map(t => t.value).join(" ");
  const canSave = formulaStr.trim() !== "" && deductionName.trim() !== "";

  async function handleSave() {
    if (!deductionName.trim()) { setMsg({ type: "error", text: "Please enter a name for this deduction." }); return; }
    if (tokens.length === 0) { setMsg({ type: "error", text: "Please build a formula first." }); return; }
    setLoading(true); setMsg(null);
    const newEntry: DeductionEntry = { Name: deductionName.trim(), Formula: formulaStr };
    const updated = [...existingDeductions, newEntry];
    const { error } = await supabase.from("users").update({ Deductions: updated }).eq("Email", employee.Email);
    if (error) { setMsg({ type: "error", text: error.message }); }
    else {
      setExistingDeductions(updated);
      setTokens([]);
      setDeductionName("");
      setMsg({ type: "success", text: "Deduction saved!" });
      setTimeout(() => window.location.reload(), 1500);
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        .ded-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:300;animation:dedFadeIn .15s ease;padding:16px}
        @keyframes dedFadeIn{from{opacity:0}to{opacity:1}}
        .ded-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:580px;max-height:94vh;overflow-y:auto;animation:dedSlideUp .2s cubic-bezier(.22,1,.36,1)}
        @keyframes dedSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .ded-band{height:4px;background:#ef4444;border-radius:var(--radius-xl) var(--radius-xl) 0 0}
        .ded-body{padding:var(--space-6)}
        .ded-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:2px;letter-spacing:-.01em}
        .ded-sub{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-5)}
        .ded-emp-pill{display:inline-flex;align-items:center;gap:var(--space-2);background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-full);padding:4px 12px 4px 6px;margin-bottom:var(--space-5)}
        .ded-emp-avatar{width:24px;height:24px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;flex-shrink:0}
        .ded-emp-name{font-size:var(--font-size-xs);font-weight:700;color:#b91c1c}

        /* Existing deductions list */
        .ded-existing-wrap{margin-bottom:var(--space-5)}
        .ded-sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .ded-sec-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase}
        .ded-sec-count{font-size:11px;font-weight:700;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:1px 8px;color:var(--color-text-muted)}
        .ded-empty-state{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .ded-entry{display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-white);margin-bottom:var(--space-2);transition:border-color .15s}
        .ded-entry:last-child{margin-bottom:0}
        .ded-entry-icon{width:32px;height:32px;border-radius:var(--radius-md);background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .ded-entry-info{flex:1;min-width:0}
        .ded-entry-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:3px}
        .ded-entry-formula{font-size:11px;font-family:monospace;color:var(--color-text-muted);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px;display:inline-block;word-break:break-all}
        .ded-entry-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .ded-remove-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap}
        .ded-remove-btn:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}

        /* Confirm delete inline */
        .ded-confirm-row{display:flex;align-items:center;gap:6px;animation:dedFadeIn .15s ease}
        .ded-confirm-text{font-size:11px;color:#dc2626;font-weight:600}
        .ded-confirm-yes{padding:4px 10px;border-radius:var(--radius-md);border:none;background:#dc2626;font-size:11px;font-weight:700;color:white;cursor:pointer;font-family:var(--font-base);transition:opacity .15s}
        .ded-confirm-yes:hover{opacity:.85}
        .ded-confirm-yes:disabled{opacity:.5}
        .ded-confirm-no{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base)}

        .ded-divider{height:1px;background:var(--color-border);margin:var(--space-5) 0}
        .ded-add-header{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}

        /* Canvas */
        .ded-template-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .ded-template-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-base);transition:all .15s;position:relative}
        .ded-template-btn:hover{border-color:var(--brand-orange);color:var(--brand-orange)}
        .ded-template-dropdown{position:absolute;top:calc(100% + 4px);right:0;background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);min-width:240px;z-index:500;box-shadow:var(--shadow-lg);overflow:hidden}
        .ded-template-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--color-border);transition:background .15s}
        .ded-template-item:last-child{border-bottom:none}
        .ded-template-item:hover{background:var(--color-bg-alt)}
        .ded-template-item-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .ded-template-item-formula{font-size:11px;font-family:monospace;color:var(--color-text-muted);margin-top:2px}
        .ded-template-empty{padding:12px 14px;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .ded-canvas-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase;padding:8px 14px 0}
        .ded-canvas{min-height:64px;padding:8px 12px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
        .ded-canvas-ph{font-size:13px;color:var(--color-text-faint);font-style:italic}
        .ded-canvas-footer{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-bg-alt);border-top:1px solid var(--color-border)}
        .ded-formula-text{font-size:11px;font-family:monospace;color:var(--color-text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ded-canvas-actions{display:flex;gap:6px;flex-shrink:0}
        .ded-backspace{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:12px;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-base);transition:all .15s}
        .ded-backspace:hover{background:rgba(239,68,68,0.07);color:#ef4444;border-color:rgba(239,68,68,0.3)}
        .ded-clear-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:12px;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-base);transition:all .15s}
        .ded-clear-btn:hover{background:rgba(239,68,68,0.07);color:#ef4444;border-color:rgba(239,68,68,0.3)}

        /* Token */
        .ded-token{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:99px;font-size:13px;font-weight:700;border:1.5px solid;white-space:nowrap;animation:tokenPop .12s cubic-bezier(.22,1,.36,1)}
        @keyframes tokenPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
        .ded-token-x{background:none;border:none;cursor:pointer;opacity:0;font-size:10px;padding:0;line-height:1;transition:opacity .15s;margin-left:1px}
        .ded-token:hover .ded-token-x{opacity:.7}
        .ded-token-x:hover{opacity:1 !important}

        /* Picker */
        .ded-picker{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)}
        .ded-picker-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}
        @media(max-width:480px){.ded-picker-grid{grid-template-columns:1fr}}
        .ded-group-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
        .ded-chip-row{display:flex;flex-wrap:wrap;gap:5px}
        .ded-chip{padding:6px 13px;border-radius:99px;font-size:13px;font-weight:700;border:1.5px solid;cursor:pointer;font-family:var(--font-base);transition:transform .1s,opacity .1s,box-shadow .1s}
        .ded-chip:hover{transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,0.08);opacity:.9}
        .ded-chip:active{transform:scale(.95)}
        .ded-number-section{margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border)}
        .ded-number-row{display:flex;gap:var(--space-2);align-items:center}
        .ded-number-row input{flex:1}
        .ded-number-add{padding:8px 16px;border-radius:var(--radius-md);background:var(--color-white);border:1px solid var(--color-border);font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-base);white-space:nowrap;transition:background .15s}
        .ded-number-add:hover{background:var(--color-border)}

        .ded-name-row{display:flex;gap:var(--space-3);align-items:flex-end;margin-bottom:var(--space-4)}
        .ded-name-field{flex:1}
        .ded-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .ded-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4);line-height:1.5}
        .ded-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .ded-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .ded-footer{display:flex;justify-content:flex-end;align-items:center;padding-top:var(--space-4);border-top:1px solid var(--color-border);margin-top:var(--space-2);gap:var(--space-3)}
      `}</style>

      <div className="ded-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
        <div className="ded-modal">
          <div className="ded-band" />
          <div className="ded-body">

            <div className="ded-title">Deductions</div>
            <div className="ded-sub">Manage and add deduction formulas for this employee.</div>

            <div className="ded-emp-pill">
              <div className="ded-emp-avatar">{employee.FirstName?.[0]}{employee.LastName?.[0]}</div>
              <span className="ded-emp-name">{employee.FirstName} {employee.LastName}</span>
            </div>

            {/* ── Existing Deductions ── */}
            <div className="ded-existing-wrap">
              <div className="ded-sec-header">
                <span className="ded-sec-label">Existing Deductions</span>
                <span className="ded-sec-count">{existingDeductions.length}</span>
              </div>

              {existingDeductions.length === 0 ? (
                <div className="ded-empty-state">No deductions added yet for this employee.</div>
              ) : (
                existingDeductions.map((d, i) => (
                  <div key={i} className="ded-entry">
                    <div className="ded-entry-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                    </div>
                    <div className="ded-entry-info">
                      <div className="ded-entry-name">{d.Name}</div>
                      <span className="ded-entry-formula">= {d.Formula}</span>
                    </div>
                    <div className="ded-entry-actions">
                      {confirmDeleteIndex === i ? (
                        <div className="ded-confirm-row">
                          <span className="ded-confirm-text">Remove?</span>
                          <button className="ded-confirm-yes" disabled={deleteLoading} onClick={() => handleDeleteDeduction(i)}>
                            {deleteLoading ? "…" : "Yes"}
                          </button>
                          <button className="ded-confirm-no" onClick={() => setConfirmDeleteIndex(null)}>No</button>
                        </div>
                      ) : (
                        <button className="ded-remove-btn" onClick={() => setConfirmDeleteIndex(i)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="ded-divider" />

            {/* ── Add New ── */}
            <div className="ded-add-header">Add new deduction</div>

            {/* Template picker */}
            <div className="ded-template-row">
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Build manually or use a saved template</span>
              <div style={{ position: "relative" }}>
                <button className="ded-template-btn" onClick={() => setShowTemplates(p => !p)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Use Template ▾
                </button>
                {showTemplates && (
                  <div className="ded-template-dropdown">
                    {templates.length === 0
                      ? <div className="ded-template-empty">No deduction templates yet.</div>
                      : templates.map(t => (
                          <div key={t.id} className="ded-template-item" onClick={() => applyTemplate(t)}>
                            <div className="ded-template-item-name">{t.Name}</div>
                            <div className="ded-template-item-formula">= {t.Formula}</div>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Canvas */}
            <div className="ded-canvas-wrap">
              <div className="ded-canvas-label">Formula</div>
              <div className="ded-canvas">
                {tokens.length === 0
                  ? <span className="ded-canvas-ph">Click the blocks below to start building…</span>
                  : tokens.map(t => {
                      const c = TOKEN_COLORS[t.type];
                      return (
                        <span key={t.id} className="ded-token" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
                          {t.label}
                          <button className="ded-token-x" style={{ color: c.color }} onClick={() => removeToken(t.id)}>✕</button>
                        </span>
                      );
                    })
                }
              </div>
              <div className="ded-canvas-footer">
                <span className="ded-formula-text">
                  {formulaStr ? `= ${formulaStr}` : "Your formula will appear here"}
                </span>
                <div className="ded-canvas-actions">
                  <button className="ded-backspace" onClick={removeLastToken}>⌫ Undo</button>
                  <button className="ded-clear-btn" onClick={() => setTokens([])}>Clear</button>
                </div>
              </div>
            </div>

            {/* Picker */}
            <div className="ded-picker">
              <div className="ded-picker-grid">
                {GROUPS.map(group => {
                  const c = TOKEN_COLORS[group.type];
                  return (
                    <div key={group.label}>
                      <div className="ded-group-label">{group.label}</div>
                      <div className="ded-chip-row">
                        {group.items.map(item => (
                          <button key={item.value} className="ded-chip"
                            style={{ color: c.color, borderColor: c.border, background: c.bg }}
                            onClick={() => addToken(group.type, item.value, item.label)}
                          >{item.label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ded-number-section">
                <div className="ded-group-label">Number value</div>
                <div className="ded-number-row">
                  <input ref={numberInputRef} className="form-input" type="number"
                    placeholder="Type a number and press Enter or click Add"
                    value={numberDraft}
                    onChange={e => setNumberDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addNumber(); }}
                  />
                  <button className="ded-number-add" onClick={addNumber}>+ Add</button>
                </div>
              </div>
            </div>

            {/* Name + Save inline */}
            <div className="ded-name-row">
              <div className="ded-name-field">
                <label className="ded-label">Deduction name *</label>
                <input className="form-input" placeholder="e.g. Late deduction, Loan payment"
                  value={deductionName} onChange={e => setDeductionName(e.target.value)} />
              </div>
            </div>

            {msg && <div className={`ded-alert ${msg.type}`}>{msg.text}</div>}

            <div className="ded-footer">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading || !canSave}>
                {loading ? "Saving…" : "Save Deduction"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}