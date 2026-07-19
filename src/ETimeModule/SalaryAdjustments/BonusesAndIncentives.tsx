import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../utils/supabase";
import type { Employee } from "../EmployeeEdit";

interface Props {
  employee: Employee;
  onClose: () => void;
}

interface BonusEntry { Name: string; Formula: string; }

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

export default function BonusesAndIncentives({ employee, onClose }: Props) {
  const [existingBonuses, setExistingBonuses] = useState<BonusEntry[]>(
    (employee as any).BonusAndIncentives ?? []
  );
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [numberDraft, setNumberDraft] = useState("");
  const [bonusName, setBonusName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<{ id: string; Name: string; Formula: string }[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      const raw = sessionStorage.getItem("t8_session");
      if (!raw) return;
      const email = atob(raw).split(":")[1];
      const { data: user } = await supabase.from("users").select("CompanyCode").eq("Email", email).single();
      if (!user) return;
      const { data } = await supabase.from("FormulaTemplates")
        .select("id, Name, Formula")
        .eq("CompanyCode", user.CompanyCode)
        .eq("Type", "bonus")
        .order("Name", { ascending: true });
      setTemplates(data ?? []);
    }
    loadTemplates();
  }, []);

  function applyTemplate(template: { Name: string; Formula: string }) {
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
    setBonusName(template.Name);
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

  async function handleDeleteBonus(index: number) {
    setDeleteLoading(true);
    const updated = existingBonuses.filter((_, i) => i !== index);
    const { error } = await supabase.from("users").update({ BonusAndIncentives: updated }).eq("Email", employee.Email);
    if (!error) {
      setExistingBonuses(updated);
      setConfirmDeleteIndex(null);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setMsg({ type: "error", text: error.message });
    }
    setDeleteLoading(false);
  }

  const formulaStr = tokens.map(t => t.value).join(" ");
  const canSave = formulaStr.trim() !== "" && bonusName.trim() !== "";

  async function handleSave() {
    if (!bonusName.trim()) { setMsg({ type: "error", text: "Please enter a name for this bonus." }); return; }
    if (tokens.length === 0) { setMsg({ type: "error", text: "Please build a formula first." }); return; }
    setLoading(true); setMsg(null);
    const newEntry: BonusEntry = { Name: bonusName.trim(), Formula: formulaStr };
    const updated = [...existingBonuses, newEntry];
    const { error } = await supabase.from("users").update({ BonusAndIncentives: updated }).eq("Email", employee.Email);
    if (error) { setMsg({ type: "error", text: error.message }); }
    else {
      setExistingBonuses(updated);
      setTokens([]);
      setBonusName("");
      setMsg({ type: "success", text: "Bonus saved!" });
      setTimeout(() => window.location.reload(), 1500);
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        .bni-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:300;animation:bniFadeIn .15s ease;padding:16px}
        @keyframes bniFadeIn{from{opacity:0}to{opacity:1}}
        .bni-modal{background:var(--color-white);border-radius:var(--radius-xl);box-shadow:var(--shadow-xl);width:100%;max-width:580px;max-height:94vh;overflow-y:auto;animation:bniSlideUp .2s cubic-bezier(.22,1,.36,1)}
        @keyframes bniSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .bni-band{height:4px;background:#22c55e;border-radius:var(--radius-xl) var(--radius-xl) 0 0}
        .bni-body{padding:var(--space-6)}
        .bni-title{font-size:var(--font-size-lg);font-weight:700;color:var(--color-text);margin-bottom:2px;letter-spacing:-.01em}
        .bni-sub{font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:var(--space-5)}
        .bni-emp-pill{display:inline-flex;align-items:center;gap:var(--space-2);background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-full);padding:4px 12px 4px 6px;margin-bottom:var(--space-5)}
        .bni-emp-avatar{width:24px;height:24px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;flex-shrink:0}
        .bni-emp-name{font-size:var(--font-size-xs);font-weight:700;color:#15803d}

        /* Existing list */
        .bni-existing-wrap{margin-bottom:var(--space-5)}
        .bni-sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .bni-sec-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase}
        .bni-sec-count{font-size:11px;font-weight:700;background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:99px;padding:1px 8px;color:var(--color-text-muted)}
        .bni-empty-state{background:var(--color-bg-alt);border:1px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .bni-entry{display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-3) var(--space-4);border:1px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-white);margin-bottom:var(--space-2);transition:border-color .15s}
        .bni-entry:last-child{margin-bottom:0}
        .bni-entry-icon{width:32px;height:32px;border-radius:var(--radius-md);background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .bni-entry-info{flex:1;min-width:0}
        .bni-entry-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:3px}
        .bni-entry-formula{font-size:11px;font-family:monospace;color:var(--color-text-muted);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:4px;padding:2px 8px;display:inline-block;word-break:break-all}
        .bni-entry-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .bni-remove-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base);transition:all .15s;white-space:nowrap}
        .bni-remove-btn:hover{background:rgba(239,68,68,0.07);color:#dc2626;border-color:rgba(239,68,68,0.3)}
        .bni-confirm-row{display:flex;align-items:center;gap:6px;animation:bniFadeIn .15s ease}
        .bni-confirm-text{font-size:11px;color:#dc2626;font-weight:600}
        .bni-confirm-yes{padding:4px 10px;border-radius:var(--radius-md);border:none;background:#dc2626;font-size:11px;font-weight:700;color:white;cursor:pointer;font-family:var(--font-base);transition:opacity .15s}
        .bni-confirm-yes:hover{opacity:.85}
        .bni-confirm-yes:disabled{opacity:.5}
        .bni-confirm-no{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:transparent;font-size:11px;font-weight:700;color:var(--color-text-muted);cursor:pointer;font-family:var(--font-base)}

        .bni-divider{height:1px;background:var(--color-border);margin:var(--space-5) 0}
        .bni-add-header{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text);margin-bottom:var(--space-4)}

        /* Canvas */
        .bni-template-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
        .bni-template-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-base);transition:all .15s;position:relative}
        .bni-template-btn:hover{border-color:#22c55e;color:#15803d}
        .bni-template-dropdown{position:absolute;top:calc(100% + 4px);right:0;background:var(--color-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);min-width:240px;z-index:500;box-shadow:var(--shadow-lg);overflow:hidden}
        .bni-template-item{padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--color-border);transition:background .15s}
        .bni-template-item:last-child{border-bottom:none}
        .bni-template-item:hover{background:var(--color-bg-alt)}
        .bni-template-item-name{font-size:var(--font-size-sm);font-weight:700;color:var(--color-text)}
        .bni-template-item-formula{font-size:11px;font-family:monospace;color:var(--color-text-muted);margin-top:2px}
        .bni-template-empty{padding:12px 14px;font-size:var(--font-size-sm);color:var(--color-text-faint);font-style:italic}
        .bni-canvas-label{font-size:10px;font-weight:700;color:var(--color-text-muted);letter-spacing:.08em;text-transform:uppercase;padding:8px 14px 0}
        .bni-canvas{min-height:64px;padding:8px 12px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
        .bni-canvas-ph{font-size:13px;color:var(--color-text-faint);font-style:italic}
        .bni-canvas-footer{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--color-bg-alt);border-top:1px solid var(--color-border)}
        .bni-formula-text{font-size:11px;font-family:monospace;color:var(--color-text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .bni-canvas-actions{display:flex;gap:6px;flex-shrink:0}
        .bni-backspace{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:12px;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-base);transition:all .15s}
        .bni-backspace:hover{background:rgba(239,68,68,0.07);color:#ef4444;border-color:rgba(239,68,68,0.3)}
        .bni-clear-btn{padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--color-border);background:var(--color-white);font-size:12px;cursor:pointer;color:var(--color-text-secondary);font-family:var(--font-base);transition:all .15s}
        .bni-clear-btn:hover{background:rgba(239,68,68,0.07);color:#ef4444;border-color:rgba(239,68,68,0.3)}

        /* Token */
        .bni-token{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:99px;font-size:13px;font-weight:700;border:1.5px solid;white-space:nowrap;animation:tokenPop .12s cubic-bezier(.22,1,.36,1)}
        @keyframes tokenPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
        .bni-token-x{background:none;border:none;cursor:pointer;opacity:0;font-size:10px;padding:0;line-height:1;transition:opacity .15s;margin-left:1px}
        .bni-token:hover .bni-token-x{opacity:.7}
        .bni-token-x:hover{opacity:1 !important}

        /* Picker */
        .bni-picker{background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)}
        .bni-picker-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}
        @media(max-width:480px){.bni-picker-grid{grid-template-columns:1fr}}
        .bni-group-label{font-size:10px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
        .bni-chip-row{display:flex;flex-wrap:wrap;gap:5px}
        .bni-chip{padding:6px 13px;border-radius:99px;font-size:13px;font-weight:700;border:1.5px solid;cursor:pointer;font-family:var(--font-base);transition:transform .1s,opacity .1s,box-shadow .1s}
        .bni-chip:hover{transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,0.08);opacity:.9}
        .bni-chip:active{transform:scale(.95)}
        .bni-number-section{margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border)}
        .bni-number-row{display:flex;gap:var(--space-2);align-items:center}
        .bni-number-row input{flex:1}
        .bni-number-add{padding:8px 16px;border-radius:var(--radius-md);background:var(--color-white);border:1px solid var(--color-border);font-size:var(--font-size-xs);font-weight:700;color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-base);white-space:nowrap;transition:background .15s}
        .bni-number-add:hover{background:var(--color-border)}

        .bni-name-row{display:flex;gap:var(--space-3);align-items:flex-end;margin-bottom:var(--space-4)}
        .bni-name-field{flex:1}
        .bni-label{font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:var(--space-2)}
        .bni-alert{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--font-size-sm);font-weight:500;margin-bottom:var(--space-4);line-height:1.5}
        .bni-alert.error{background:var(--color-danger-light);color:var(--color-danger)}
        .bni-alert.success{background:var(--color-success-light);color:var(--color-success)}
        .bni-footer{display:flex;justify-content:flex-end;align-items:center;padding-top:var(--space-4);border-top:1px solid var(--color-border);margin-top:var(--space-2);gap:var(--space-3)}
      `}</style>

      <div className="bni-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
        <div className="bni-modal">
          <div className="bni-band" />
          <div className="bni-body">

            <div className="bni-title">Bonuses & Incentives</div>
            <div className="bni-sub">Manage and add bonus formulas for this employee.</div>

            <div className="bni-emp-pill">
              <div className="bni-emp-avatar">{employee.FirstName?.[0]}{employee.LastName?.[0]}</div>
              <span className="bni-emp-name">{employee.FirstName} {employee.LastName}</span>
            </div>

            {/* ── Existing Bonuses ── */}
            <div className="bni-existing-wrap">
              <div className="bni-sec-header">
                <span className="bni-sec-label">Existing Bonuses & Incentives</span>
                <span className="bni-sec-count">{existingBonuses.length}</span>
              </div>

              {existingBonuses.length === 0 ? (
                <div className="bni-empty-state">No bonuses added yet for this employee.</div>
              ) : (
                existingBonuses.map((b, i) => (
                  <div key={i} className="bni-entry">
                    <div className="bni-entry-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                    </div>
                    <div className="bni-entry-info">
                      <div className="bni-entry-name">{b.Name}</div>
                      <span className="bni-entry-formula">= {b.Formula}</span>
                    </div>
                    <div className="bni-entry-actions">
                      {confirmDeleteIndex === i ? (
                        <div className="bni-confirm-row">
                          <span className="bni-confirm-text">Remove?</span>
                          <button className="bni-confirm-yes" disabled={deleteLoading} onClick={() => handleDeleteBonus(i)}>
                            {deleteLoading ? "…" : "Yes"}
                          </button>
                          <button className="bni-confirm-no" onClick={() => setConfirmDeleteIndex(null)}>No</button>
                        </div>
                      ) : (
                        <button className="bni-remove-btn" onClick={() => setConfirmDeleteIndex(i)}>Remove</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bni-divider" />

            {/* ── Add New ── */}
            <div className="bni-add-header">Add new bonus or incentive</div>

            {/* Template picker */}
            <div className="bni-template-row">
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Build manually or use a saved template</span>
              <div style={{ position: "relative" }}>
                <button className="bni-template-btn" onClick={() => setShowTemplates(p => !p)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Use Template ▾
                </button>
                {showTemplates && (
                  <div className="bni-template-dropdown">
                    {templates.length === 0
                      ? <div className="bni-template-empty">No bonus templates yet.</div>
                      : templates.map(t => (
                          <div key={t.id} className="bni-template-item" onClick={() => applyTemplate(t)}>
                            <div className="bni-template-item-name">{t.Name}</div>
                            <div className="bni-template-item-formula">= {t.Formula}</div>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Canvas */}
            <div className="bni-canvas-wrap">
              <div className="bni-canvas-label">Formula</div>
              <div className="bni-canvas">
                {tokens.length === 0
                  ? <span className="bni-canvas-ph">Click the blocks below to start building…</span>
                  : tokens.map(t => {
                      const c = TOKEN_COLORS[t.type];
                      return (
                        <span key={t.id} className="bni-token" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
                          {t.label}
                          <button className="bni-token-x" style={{ color: c.color }} onClick={() => removeToken(t.id)}>✕</button>
                        </span>
                      );
                    })
                }
              </div>
              <div className="bni-canvas-footer">
                <span className="bni-formula-text">
                  {formulaStr ? `= ${formulaStr}` : "Your formula will appear here"}
                </span>
                <div className="bni-canvas-actions">
                  <button className="bni-backspace" onClick={removeLastToken}>⌫ Undo</button>
                  <button className="bni-clear-btn" onClick={() => setTokens([])}>Clear</button>
                </div>
              </div>
            </div>

            {/* Picker */}
            <div className="bni-picker">
              <div className="bni-picker-grid">
                {GROUPS.map(group => {
                  const c = TOKEN_COLORS[group.type];
                  return (
                    <div key={group.label}>
                      <div className="bni-group-label">{group.label}</div>
                      <div className="bni-chip-row">
                        {group.items.map(item => (
                          <button key={item.value} className="bni-chip"
                            style={{ color: c.color, borderColor: c.border, background: c.bg }}
                            onClick={() => addToken(group.type, item.value, item.label)}
                          >{item.label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bni-number-section">
                <div className="bni-group-label">Number value</div>
                <div className="bni-number-row">
                  <input ref={numberInputRef} className="form-input" type="number"
                    placeholder="Type a number and press Enter or click Add"
                    value={numberDraft}
                    onChange={e => setNumberDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addNumber(); }}
                  />
                  <button className="bni-number-add" onClick={addNumber}>+ Add</button>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="bni-name-row">
              <div className="bni-name-field">
                <label className="bni-label">Bonus name *</label>
                <input className="form-input" placeholder="e.g. Performance bonus, 13th month"
                  value={bonusName} onChange={e => setBonusName(e.target.value)} />
              </div>
            </div>

            {msg && <div className={`bni-alert ${msg.type}`}>{msg.text}</div>}

            <div className="bni-footer">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={loading || !canSave}
                style={{ background: "#22c55e", borderColor: "#22c55e" }}>
                {loading ? "Saving…" : "Save Bonus"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}